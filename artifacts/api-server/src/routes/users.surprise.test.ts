import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import { clerkMiddleware } from "@clerk/express";
import usersRouter from "./users";

const LENSES = [
  "tonight",
  "15-minutes",
  "90-minutes",
  "3-hours",
  "obscure",
  "emotional",
  "visually-insane",
  "everyone-missed",
  "india",
  "outside-taste",
] as const;

function makeServer() {
  const app = express();
  app.use(clerkMiddleware());
  app.use(usersRouter);
  return app.listen(0);
}

function surpriseUrl(server: ReturnType<typeof makeServer>, lens: string) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}/surprise-me?lens=${encodeURIComponent(lens)}&seed=test-seed`;
}

function mockCatalogFetch(runtime = 104) {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/discover/movie")) {
      return Response.json({
        page: 1,
        total_pages: 1,
        results: [{
          id: 777,
          title: "A Verified Film",
          poster_path: "/verified-poster.jpg",
          backdrop_path: "/verified-backdrop.jpg",
          overview: "A real catalog candidate.",
          release_date: "2024-01-01",
          vote_average: 7.4,
          popularity: 12,
        }],
      });
    }
    if (/\/movie\/\d+$/.test(url.pathname)) {
      return Response.json({
        id: 777,
        title: "A Verified Film",
        poster_path: "/verified-poster.jpg",
        backdrop_path: "/verified-backdrop.jpg",
        overview: "A real catalog candidate.",
        release_date: "2024-01-01",
        runtime,
        vote_average: 7.4,
        genres: [{ id: 18, name: "Drama" }],
      });
    }
    return new Response("unexpected upstream path", { status: 404 });
  }) as typeof fetch;
}

test("every supported lens returns exactly one verified movie", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = mockCatalogFetch();
  const server = makeServer();

  try {
    for (const lens of LENSES) {
      const response = await originalFetch(surpriseUrl(server, lens));
      assert.equal(response.status, 200, lens);
      const body = await response.json() as any;
      assert.equal(body.lens, lens);
      assert.equal(body.movie.id, 777);
      assert.equal(body.movie.runtime, 104);
      assert.equal(body.movie.genres[0].name, "Drama");
      assert.equal(typeof body.explanation, "string");
      assert.ok(body.signals.length > 0);
    }
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});

test("marks a short-window result as nearest when no exact runtime exists", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = mockCatalogFetch(104);
  const server = makeServer();

  try {
    const response = await originalFetch(surpriseUrl(server, "15-minutes"));
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.runtimeMatch, "nearest-available");
    assert.equal(body.requestedRuntime, 15);
    assert.match(body.explanation, /No exact 15-minute film/);
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});

test("rejects unknown lenses without contacting the catalog", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test-key";
  let upstreamCalls = 0;
  globalThis.fetch = (async () => {
    upstreamCalls += 1;
    return Response.json({});
  }) as typeof fetch;
  const server = makeServer();

  try {
    const response = await originalFetch(surpriseUrl(server, "roulette"));
    assert.equal(response.status, 400);
    assert.equal(upstreamCalls, 0);
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});

test("returns a safe temporary-unavailable response when the provider is down", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response("provider unavailable", { status: 503 })) as typeof fetch;
  const server = makeServer();

  try {
    const response = await originalFetch(surpriseUrl(server, "tonight"));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "The live catalog could not find a safe Surprise Me pick right now.",
    });
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});