import assert from "node:assert/strict";
import express from "express";
import { afterEach, test } from "node:test";
import moviesRouter from "./movies";

type CollectionCase = {
  collection: string;
  path: string;
  mediaType: "movie" | "tv";
  params?: Record<string, string>;
  query?: string;
};

const collections: CollectionCase[] = [
  { collection: "trending", path: "/3/trending/movie/week", mediaType: "movie" },
  { collection: "popular", path: "/3/movie/popular", mediaType: "movie" },
  { collection: "top-rated", path: "/3/movie/top_rated", mediaType: "movie" },
  { collection: "tv-popular", path: "/3/tv/popular", mediaType: "tv" },
  { collection: "tv-top-rated", path: "/3/tv/top_rated", mediaType: "tv" },
  { collection: "tv-upcoming", path: "/3/tv/on_the_air", mediaType: "tv" },
  {
    collection: "upcoming",
    path: "/3/movie/upcoming",
    mediaType: "movie",
    params: { region: "IN" },
  },
  {
    collection: "in-theaters",
    path: "/3/movie/now_playing",
    mediaType: "movie",
    params: { region: "IN" },
  },
  {
    collection: "free",
    path: "/3/discover/movie",
    mediaType: "movie",
    params: {
      watch_region: "IN",
      with_watch_monetization_types: "free|ads",
      sort_by: "popularity.desc",
    },
  },
  {
    collection: "indian",
    path: "/3/discover/movie",
    mediaType: "movie",
    query: "&language=HI",
    params: {
      with_origin_country: "IN",
      region: "IN",
      sort_by: "popularity.desc",
      with_original_language: "hi",
    },
  },
];

function makeServer() {
  const app = express();
  app.use(moviesRouter);
  return app.listen(0);
}

function catalogUrl(server: ReturnType<typeof makeServer>, collection: string, query = "") {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}/movies/catalog?collection=${collection}${query}`;
}

function providerResult(mediaType: "movie" | "tv", id: number) {
  return mediaType === "tv"
    ? { id, name: `Series ${id}`, first_air_date: "2024-02-03" }
    : { id, title: `Film ${id}`, release_date: "2024-02-03" };
}

afterEach(() => {
  // Every test installs its own upstream double. Restoring it here prevents
  // a failed assertion from leaking a mock into another route test.
  globalThis.fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

test("maps every supported catalogue collection to its provider request", async () => {
  const requestedUrls: URL[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url);
    const collection = collections.find((entry) => url.pathname === entry.path);
    assert.ok(collection, `unexpected provider path: ${url.pathname}`);
    return Response.json({
      page: 3,
      total_pages: 9,
      total_results: 234,
      results: [providerResult(collection.mediaType, requestedUrls.length)],
    });
  }) as typeof fetch;

  const server = makeServer();
  try {
    for (const collection of collections) {
      const response = await originalFetch(
        catalogUrl(
          server,
          collection.collection,
          `${collection.query ?? ""}&page=3&limit=2`,
        ),
      );
      assert.equal(response.status, 200, collection.collection);
      const payload = await response.json() as {
        results: Array<{ id: number; title: string; releaseDate: string }>;
        page: number;
        totalPages: number;
        totalResults: number;
      };

      assert.equal(payload.page, 3);
      assert.equal(payload.totalPages, 9);
      assert.equal(payload.totalResults, 234);
      assert.equal(payload.results.length, 1);
      assert.equal(
        payload.results[0].title,
        `${collection.mediaType === "tv" ? "Series" : "Film"} ${requestedUrls.length}`,
      );
      assert.equal(payload.results[0].releaseDate, "2024-02-03");

      const request = requestedUrls.at(-1);
      assert.ok(request);
      assert.equal(request.pathname, collection.path);
      assert.equal(request.searchParams.get("page"), "3");
      assert.equal(request.searchParams.get("api_key") !== null, true);
      for (const [key, value] of Object.entries(collection.params ?? {})) {
        assert.equal(request.searchParams.get(key), value, `${collection.collection} ${key}`);
      }
      if (collection.collection !== "indian") {
        assert.equal(request.searchParams.get("with_original_language"), null);
      }
    }
  } finally {
    server.close();
  }

  assert.equal(requestedUrls.length, collections.length);
});

test("removes duplicate provider records without changing stable order or page size", async () => {
  globalThis.fetch = (async () => Response.json({
    page: 4,
    total_pages: 8,
    total_results: 160,
    results: [
      { id: 401, title: "First" },
      { id: 402, title: "Second" },
      { id: 401, title: "Duplicate first", overview: "Additional provider data" },
      { id: 403, title: "Third" },
    ],
  })) as typeof fetch;

  const server = makeServer();
  try {
    const response = await originalFetch(catalogUrl(server, "popular", "&page=4&limit=2"));
    assert.equal(response.status, 200);
    const payload = await response.json() as {
      results: Array<{ id: number; title: string; overview: string }>;
      page: number;
      totalPages: number;
      totalResults: number;
    };

    assert.equal(payload.page, 4);
    assert.equal(payload.totalPages, 8);
    assert.equal(payload.totalResults, 160);
    assert.deepEqual(payload.results, [
      {
        id: 401,
        title: "First",
        posterPath: null,
        backdropPath: null,
        overview: "Additional provider data",
        releaseDate: "",
        voteAverage: 0,
        genreIds: [],
      },
      {
        id: 402,
        title: "Second",
        posterPath: null,
        backdropPath: null,
        overview: "",
        releaseDate: "",
        voteAverage: 0,
        genreIds: [],
      },
    ]);
  } finally {
    server.close();
  }
});

test("returns a safe gateway error when the catalogue provider fails", async () => {
  globalThis.fetch = (async () =>
    new Response("provider diagnostic that must not reach viewers", {
      status: 503,
      headers: { "content-type": "text/plain" },
    })) as typeof fetch;

  const server = makeServer();
  try {
    const response = await originalFetch(catalogUrl(server, "popular", "&page=2&limit=10"));
    const body = await response.text();

    assert.equal(response.status, 502);
    assert.deepEqual(JSON.parse(body), { error: "Catalog page unavailable" });
    assert.doesNotMatch(body, /provider diagnostic/);
  } finally {
    server.close();
  }
});