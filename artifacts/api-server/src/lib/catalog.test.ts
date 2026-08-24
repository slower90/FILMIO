import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CatalogClient,
  catalogIdentity,
  createCompatibleProvider,
  createOmdbProvider,
  defaultBuildUrl,
  mergeCatalogItems,
  normalizeTitle,
} from "./catalog";

const provider = (name: string) => ({
  name,
  baseUrl: "https://catalog.test",
  buildUrl: (base: string, path: string) => `${base}${path}`,
});

test("preserves a provider base path when catalog routes start with a slash", () => {
  assert.equal(
    defaultBuildUrl("https://api.example.test/3", "/movie/550", { api_key: "test" }),
    "https://api.example.test/3/movie/550?api_key=test",
  );
});

test("uses fallback after primary failure and fills missing fields during merge", async () => {
  let primaryCalls = 0;
  const primary = provider("primary");
  const fallback = provider("fallback");
  const client = new CatalogClient({
    providers: [primary, fallback],
    timeoutMs: 50,
  });
  // The test provider is represented by a fetch double.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (primaryCalls++ === 0) throw new Error("timeout");
    return Response.json({ results: [{ id: 2 }] });
  }) as typeof fetch;
  try {
    const result = await client.fetch<{ results: Array<{ id: number }> }>("/search");
    assert.deepEqual(result.results, [{ id: 2 }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deduplicates stable identities and preserves primary values", () => {
  assert.equal(normalizeTitle(" Spider-Man: Homecoming "), "spiderman homecoming");
  assert.deepEqual(
    mergeCatalogItems(
      [[{ id: 1, title: "A", overview: "" }], [{ id: 1, title: "Other", overview: "Plot" }, { id: 2, title: "B" }]],
      (item) => item.id,
    ),
    [{ id: 1, title: "A", overview: "Plot" }, { id: 2, title: "B" }],
  );
  assert.equal(catalogIdentity({ title: "A Film", releaseDate: "2024-02-01" }), "a film:2024");
});

test("rejects malformed payloads and reports all-provider failure", async () => {
  const client = new CatalogClient({
    providers: [{
      name: "broken",
      baseUrl: "https://catalog.test",
      buildUrl: (base, path) => `${base}${path}`,
    }],
    timeoutMs: 50,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json(["not", "an", "object"])) as typeof fetch;
  try {
    await assert.rejects(client.fetch("/details/1"), /All catalog providers failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serves stale data when every provider is down", async () => {
  let available = true;
  const client = new CatalogClient({
    providers: [{
      name: "primary",
      baseUrl: "https://catalog.test",
      buildUrl: (base, path) => `${base}${path}`,
    }],
    ttlMs: 1,
    timeoutMs: 50,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (!available) throw new Error("down");
    return Response.json({ results: [{ id: 1 }] });
  }) as typeof fetch;
  try {
    assert.deepEqual(await client.fetch("/popular"), { results: [{ id: 1 }] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    available = false;
    assert.deepEqual(await client.fetch("/popular"), { results: [{ id: 1 }] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retains fresh and stale source metadata for callers", async () => {
  let available = true;
  const client = new CatalogClient({
    providers: [provider("primary")],
    ttlMs: 1,
    timeoutMs: 50,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (!available) throw new Error("down");
    return Response.json({ results: [{ id: 1 }] });
  }) as typeof fetch;
  try {
    const fresh = await client.fetchWithMetadata("/popular");
    assert.equal(fresh.source, "primary");
    assert.equal(fresh.stale, false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    available = false;
    const stale = await client.fetchWithMetadata("/popular");
    assert.equal(stale.source, "cache");
    assert.equal(stale.stale, true);
    assert.equal(stale.fetchedAt, fresh.fetchedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps the OMDb search adapter into the existing movie and TV result shape", async () => {
  const client = new CatalogClient({
    providers: [createOmdbProvider("server-only-test-key")],
    timeoutMs: 50,
  });
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return Response.json({
      Search: [{ imdbID: "tt123", Title: "A Film", Year: "2024", Poster: "https://img.test/a.jpg", Type: "movie" }],
      totalResults: "1",
      Response: "True",
    });
  }) as typeof fetch;
  try {
    const result = await client.fetch<{ results: Array<Record<string, any>> }>("/search/movie", { query: "A Film", page: 1 });
    assert.equal(result.results[0].id, "tt123");
    assert.equal(result.results[0].title, "A Film");
    assert.equal(result.results[0].poster_path, "https://img.test/a.jpg");
    assert.match(requestedUrls[0], /apikey=server-only-test-key/);
    assert.match(requestedUrls[0], /s=A\+Film/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps a compatible provider's camelCase records without replacing missing fields with guesses", async () => {
  const client = new CatalogClient({
    providers: [createCompatibleProvider({ name: "approved-backup", baseUrl: "https://catalog.test" })],
    timeoutMs: 50,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({
    items: [{ id: "movie-1", name: "A Film", posterPath: "/poster.jpg", releaseDate: "2024-01-01" }],
    totalResults: 1,
  })) as typeof fetch;
  try {
    const result = await client.fetch<{ results: Array<Record<string, any>> }>("/search/movie", { query: "film" });
    assert.deepEqual(result.results[0], {
      id: "movie-1",
      name: "A Film",
      title: "A Film",
      posterPath: "/poster.jpg",
      releaseDate: "2024-01-01",
      poster_path: "/poster.jpg",
      backdrop_path: null,
      overview: "",
      release_date: "2024-01-01",
      first_air_date: "2024-01-01",
      vote_average: 0,
      genre_ids: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps compatible provider trailers and watch providers for movie details", async () => {
  const client = new CatalogClient({
    providers: [createCompatibleProvider({ name: "approved-backup", baseUrl: "https://catalog.test" })],
    timeoutMs: 50,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({
    id: 123,
    videos: { items: [{ videoId: "trailer-1", youtubeKey: "abc123", title: "Trailer", source: "YouTube" }] },
    watchProviders: {
      regions: {
        IN: {
          flatrate: [{ providerId: 8, providerName: "Netflix", logoPath: "/netflix.png" }],
          link: "https://watch.test/movie/123",
        },
      },
    },
  })) as typeof fetch;
  try {
    const result = await client.fetch<any>("/movie/123");
    assert.deepEqual(result.videos.results, [{
      videoId: "trailer-1",
      youtubeKey: "abc123",
      title: "Trailer",
      source: "YouTube",
      id: "trailer-1",
      key: "abc123",
      name: "Trailer",
      site: "YouTube",
      type: "",
      official: false,
    }]);
    assert.deepEqual(result["watch/providers"].results.IN.flatrate, [{
      providerId: 8,
      providerName: "Netflix",
      logoPath: "/netflix.png",
      provider_id: 8,
      provider_name: "Netflix",
      logo_path: "/netflix.png",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OMDb fails closed for unsupported trailers and availability instead of returning fabricated data", async () => {
  const provider = createOmdbProvider("server-only-test-key");
  assert.throws(
    () => provider.buildUrl(provider.baseUrl, "/movie/123/videos", {}),
    /does not support/,
  );
});