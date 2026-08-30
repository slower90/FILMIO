import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import {
  buildFreeClassicsSearchUrl,
  buildWikimediaSearchUrl,
  buildYoutubeSearchUrl,
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

test("normalizes curated archive metadata into source-aware playback metadata", () => {
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
      source: "archive",
      sourceLabel: "Internet Archive",
      sourceUrl: "https://archive.org/details/the-film%2F1939",
      playback: "iframe",
      licenseLabel: "Public Domain",
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

test("builds restricted Wikimedia and YouTube source queries", () => {
  const commons = new URL(buildWikimediaSearchUrl());
  assert.match(commons.searchParams.get("gsrsearch") ?? "", /Public domain films/);
  assert.equal(commons.searchParams.get("gsrnamespace"), "6");
  assert.equal(commons.searchParams.get("iiprop"), "url|mime|extmetadata");

  const youtube = new URL(buildYoutubeSearchUrl("channel-123", "secret"));
  assert.equal(youtube.searchParams.get("channelId"), "channel-123");
  assert.equal(youtube.searchParams.get("videoEmbeddable"), "true");
  assert.equal(youtube.searchParams.get("type"), "video");
});

test("merges healthy archive and Wikimedia items while ignoring duplicate source records", async () => {
  let calls = 0;
  const router = createFreeClassicsRouter({
    enableYoutube: false,
    now: () => 1_000,
    fetchFn: async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("commons.wikimedia.org")) {
        return response({
          query: {
            pages: [{
              pageid: 42,
              title: "File:Commons Film.webm",
              fullurl: "https://commons.wikimedia.org/wiki/File:Commons_Film.webm",
              imageinfo: [{
                url: "https://upload.wikimedia.org/commons/commons-film.webm",
                thumburl: "https://upload.wikimedia.org/commons/commons-film.jpg",
                mime: "video/webm",
                extmetadata: {
                  LicenseShortName: { value: "CC BY-SA 4.0" },
                  ImageDescription: { value: "A <b>free</b> film." },
                  Date: { value: "1941" },
                },
              }],
            }],
          },
        });
      }
      return response({
        response: {
          docs: [
            { identifier: "one", title: "One", year: 1940 },
            { identifier: "one", title: "Duplicate" },
          ],
        },
      });
    },
  });

  const result = await request(router);
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(await result.json(), {
    items: [
      {
        identifier: "one",
        title: "One",
        description: null,
        year: 1940,
        creator: null,
        posterUrl: "https://archive.org/services/img/one",
        embedUrl: "https://archive.org/embed/one",
        source: "archive",
        sourceLabel: "Internet Archive",
        sourceUrl: "https://archive.org/details/one",
        playback: "iframe",
        licenseLabel: "Public Domain",
      },
      {
        identifier: "42",
        title: "Commons Film",
        description: "A free film.",
        year: 1941,
        creator: null,
        posterUrl: "https://upload.wikimedia.org/commons/commons-film.jpg",
        embedUrl: "https://upload.wikimedia.org/commons/commons-film.webm",
        source: "wikimedia",
        sourceLabel: "Wikimedia Commons",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Commons_Film.webm",
        playback: "video",
        licenseLabel: "CC BY-SA 4.0",
      },
    ],
    fetchedAt: "1970-01-01T00:00:01.000Z",
  });
});

test("uses curated YouTube items without accepting entries with no legal label", async () => {
  const router = createFreeClassicsRouter({
    enableArchive: false,
    enableWikimedia: false,
    curatedYoutubeItems: [
      { videoId: "abc1234", title: "Verified Film", channelTitle: "Official Free Films", licenseLabel: "Public Domain", year: 1930 },
      { videoId: "bad1234", title: "Unverified Film" },
    ],
    fetchFn: async () => {
      throw new Error("No upstream request expected");
    },
  });

  const result = await request(router);
  assert.equal(result.status, 200);
  const payload = (await result.json()) as { items: Array<Record<string, unknown>> };
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].source, "youtube");
  assert.equal(payload.items[0].embedUrl, "https://www.youtube.com/embed/abc1234?rel=0");
  assert.equal(payload.items[0].licenseLabel, "Public Domain");
});

test("keeps serving a healthy source when another provider fails", async () => {
  const router = createFreeClassicsRouter({
    enableYoutube: false,
    fetchFn: async (input) => String(input).includes("commons.wikimedia.org")
      ? response({ error: "down" }, 503)
      : response({ response: { docs: [{ identifier: "one", title: "One" }] } }),
  });

  const result = await request(router);
  assert.equal(result.status, 200);
  const payload = (await result.json()) as { items: unknown[] };
  assert.equal(payload.items.length, 1);
});

test("serves normalized items and caches the upstream response for six hours", async () => {
  let calls = 0;
  let now = 1_000;
  const router = createFreeClassicsRouter({
    enableWikimedia: false,
    enableYoutube: false,
    now: () => now,
    fetchFn: async () => {
      calls += 1;
      return response({ response: { docs: [{ identifier: "one", title: "One" }] } });
    },
  });

  const first = await request(router);
  const second = await request(router);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);

  now += FREE_CLASSICS_CACHE_TTL_MS + 1;
  const third = await request(router);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(third.status, 200);
  assert.equal(calls, 2);
});

test("serves the last good catalog when an expired refresh fails", async () => {
  let now = 1_000;
  let shouldFail = false;
  const router = createFreeClassicsRouter({
    enableWikimedia: false,
    enableYoutube: false,
    now: () => now,
    fetchFn: async () => {
      if (shouldFail) throw new Error("upstream unavailable");
      return response({ response: { docs: [{ identifier: "one", title: "One" }] } });
    },
  });

  assert.equal((await request(router)).status, 200);
  now += FREE_CLASSICS_CACHE_TTL_MS + 1;
  shouldFail = true;
  const stale = await request(router);
  assert.equal(stale.status, 200);
  const stalePayload = (await stale.json()) as { items: Array<{ identifier: string }> };
  assert.equal(stalePayload.items[0].identifier, "one");
});

test("returns a gateway error when every configured source fails on first load", async () => {
  const router = createFreeClassicsRouter({
    enableYoutube: false,
    fetchFn: async () => response({ error: "down" }, 503),
  });
  const result = await request(router);
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), { error: "Free Classics catalog is unavailable" });
});