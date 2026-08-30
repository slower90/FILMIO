import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import {
  buildFreeClassicsSearchUrl,
  createFreeClassicsRouter,
  FREE_CLASSICS_CACHE_TTL_MS,
  normalizeFreeClassicDoc,
} from "./free-classics";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function request(router: ReturnType<typeof createFreeClassicsRouter>): Promise<globalThis.Response> {
  const app = express();
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  try {
    return await fetch(`http://127.0.0.1:${address.port}/free-classics`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("normalizes curated archive metadata into safe poster and embed URLs", () => {
  assert.deepEqual(
    normalizeFreeClassicDoc({
      identifier: "the-film/1939",
      title: ["  The Film  "],
      description: "A  classic\nfilm",
      year: "1939",
      creator: ["Studio"],
    }),
    {
      identifier: "the-film/1939",
      title: "The Film",
      description: "A classic film",
      year: 1939,
      creator: "Studio",
      posterUrl: "https://archive.org/services/img/the-film%2F1939",
      embedUrl: "https://archive.org/embed/the-film%2F1939",
    },
  );
  assert.equal(normalizeFreeClassicDoc({ identifier: "missing-title" }), null);
});

test("uses the curated feature-films search instead of an unrestricted archive query", () => {
  const url = new URL(buildFreeClassicsSearchUrl());
  assert.equal(url.searchParams.get("q"), "mediatype:movies AND collection:feature_films");
  assert.equal(url.searchParams.get("rows"), "50");
  assert.deepEqual(url.searchParams.getAll("fl[]"), [
    "identifier",
    "title",
    "description",
    "year",
    "creator",
  ]);
});

test("serves normalized items and caches the upstream response for six hours", async () => {
  let calls = 0;
  let now = 1_000;
  const router = createFreeClassicsRouter({
    now: () => now,
    fetchFn: async () => {
      calls += 1;
      return response({
        response: {
          docs: [
            { identifier: "one", title: "One", year: 1940 },
            { identifier: "bad" },
            { identifier: "one", title: "Duplicate" },
          ],
        },
      });
    },
  });

  const first = await request(router);
  const second = await request(router);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual((await first.json()).items, [
    {
      identifier: "one",
      title: "One",
      description: null,
      year: 1940,
      creator: null,
      posterUrl: "https://archive.org/services/img/one",
      embedUrl: "https://archive.org/embed/one",
    },
  ]);

  now += FREE_CLASSICS_CACHE_TTL_MS + 1;
  const third = await request(router);
  assert.equal(third.status, 200);
  assert.equal(calls, 2);
});

test("returns a gateway error when the first archive request fails", async () => {
  const router = createFreeClassicsRouter({
    fetchFn: async () => response({ error: "down" }, 503),
  });
  const result = await request(router);
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { error: "Free Classics catalog is unavailable" });
});