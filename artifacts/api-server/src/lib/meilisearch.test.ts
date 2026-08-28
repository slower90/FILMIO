import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getSearchIndexStatus,
  isMeilisearchConfigured,
  resetMeilisearchClientForTests,
  searchMeilisearch,
} from "./meilisearch";

const originalHost = process.env.MEILISEARCH_HOST;
const originalApiKey = process.env.MEILISEARCH_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  resetMeilisearchClientForTests();
  if (originalHost === undefined) delete process.env.MEILISEARCH_HOST;
  else process.env.MEILISEARCH_HOST = originalHost;
  if (originalApiKey === undefined) delete process.env.MEILISEARCH_API_KEY;
  else process.env.MEILISEARCH_API_KEY = originalApiKey;
  globalThis.fetch = originalFetch;
});

test("does not call Meilisearch when credentials are missing", async () => {
  delete process.env.MEILISEARCH_HOST;
  delete process.env.MEILISEARCH_API_KEY;
  assert.equal(isMeilisearchConfigured(), false);
  assert.equal(await searchMeilisearch("intersteller", 10), null);
});

test("configures the index and maps a Meilisearch hit to the API shape", async () => {
  process.env.MEILISEARCH_HOST = "https://search.example.test";
  process.env.MEILISEARCH_API_KEY = "test-only-key";
  const requests: Array<{ method: string; path: string; body: string }> = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      body: typeof init?.body === "string" ? init.body : "",
    });

    if (url.pathname.endsWith("/settings") && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify({ searchableAttributes: ["title"] }), { status: 200 });
    }
    if (url.pathname.endsWith("/settings") && init?.method === "PATCH") {
      return new Response(JSON.stringify({ taskUid: 1, status: "enqueued" }), { status: 202 });
    }
    if (url.pathname === "/tasks/1") {
      return new Response(JSON.stringify({
        uid: 1,
        indexUid: "filmio_search",
        status: "succeeded",
        type: "settingsUpdate",
      }), { status: 200 });
    }
    if (url.pathname.endsWith("/search") && init?.method === "POST") {
      return new Response(JSON.stringify({
        hits: [{
          id: "tmdb:42",
          source: "tmdb",
          providerId: 42,
          mediaType: "movie",
          title: "Interstellar",
          filmioRating: 8.7,
          posterPath: "/poster.jpg",
          backdropPath: null,
          overview: "A journey through space.",
          releaseYear: 2014,
        }],
        estimatedTotalHits: 1,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected test request" }), { status: 500 });
  };

  const result = await searchMeilisearch("intersteller", 10);
  assert.deepEqual(result, {
    results: [{
      id: 42,
      title: "Interstellar",
      posterPath: "/poster.jpg",
      backdropPath: null,
      overview: "A journey through space.",
      releaseDate: "2014-01-01",
      voteAverage: 8.7,
      genreIds: [],
    }],
    totalResults: 1,
  });
  assert.ok(requests.some((request) => request.path.endsWith("/settings") && request.method === "PATCH"));
  assert.ok(requests.some((request) => request.path.endsWith("/search") && request.method === "POST"));
  assert.equal(JSON.parse(requests.find((request) => request.path.endsWith("/settings") && request.method === "PATCH")!.body).searchableAttributes[0], "title");
});

test("reports fallback mode when Meilisearch is not configured", async () => {
  delete process.env.MEILISEARCH_HOST;
  delete process.env.MEILISEARCH_API_KEY;

  assert.deepEqual(await getSearchIndexStatus(), {
    configured: false,
    reachable: false,
    status: "fallback",
    mode: "fallback",
    lastSuccessfulSyncAt: null,
    indexedDocuments: null,
    isIndexing: null,
  });
});

test("reports Meilisearch health and catalog stats without exposing credentials", async () => {
  process.env.MEILISEARCH_HOST = "https://search.example.test";
  process.env.MEILISEARCH_API_KEY = "test-only-key";
  const requests: Array<{ path: string; headers: unknown }> = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ path: url.pathname, headers: init?.headers });
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "available" }), { status: 200 });
    }
    if (url.pathname === "/stats") {
      return new Response(JSON.stringify({
        lastUpdate: "2026-08-27T12:00:00.000Z",
        indexes: {
          filmio_search: {
            numberOfDocuments: 42,
            isIndexing: false,
          },
        },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected test request" }), { status: 500 });
  };

  const result = await getSearchIndexStatus();

  assert.deepEqual(result, {
    configured: true,
    reachable: true,
    status: "healthy",
    mode: "meilisearch",
    lastSuccessfulSyncAt: "2026-08-27T12:00:00.000Z",
    indexedDocuments: 42,
    isIndexing: false,
  });
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ headers }) => !JSON.stringify(headers).includes("test-only-key")));
});

test("reports a reachable but actively indexing catalog as degraded", async () => {
  process.env.MEILISEARCH_HOST = "https://search.example.test";
  process.env.MEILISEARCH_API_KEY = "test-only-key";

  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "available" }), { status: 200 });
    }
    if (path === "/stats") {
      return new Response(JSON.stringify({
        lastUpdate: "2026-08-27T12:00:00.000Z",
        indexes: {
          filmio_search: {
            numberOfDocuments: 42,
            isIndexing: true,
          },
        },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected test request" }), { status: 500 });
  };

  assert.deepEqual(await getSearchIndexStatus(), {
    configured: true,
    reachable: true,
    status: "degraded",
    mode: "meilisearch",
    lastSuccessfulSyncAt: "2026-08-27T12:00:00.000Z",
    indexedDocuments: 42,
    isIndexing: true,
  });
});
