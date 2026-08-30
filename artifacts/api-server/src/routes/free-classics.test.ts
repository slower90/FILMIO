import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";
import {
  buildFreeClassicsSearchUrl,
  buildWikimediaSearchUrl,
  buildYoutubeSearchUrl,
  createFreeClassicsRouter,
  FREE_CLASSICS_CACHE_TTL_MS,
  buildNfbOembedUrl,
  normalizeNfbOembedDoc,
  normalizeFreeClassicDoc,
  selectArchiveMediaUrl,
} from "./free-classics";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function request(
  router: ReturnType<typeof createFreeClassicsRouter>,
  query = "",
): Promise<globalThis.Response> {
  const app = express();
  app.use(router);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  try {
    return await fetch(`http://127.0.0.1:${address.port}/free-classics${query}`);
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
      mediaUrl: null,
      source: "archive",
      sourceLabel: "Internet Archive",
      sourceUrl: "https://archive.org/details/the-film%2F1939",
      playback: "iframe",
      licenseLabel: "Public Domain",
    },
  );
  assert.equal(normalizeFreeClassicDoc({ identifier: "missing-title" }), null);
});

test("selects a public Archive video file and safely encodes its path", () => {
  assert.equal(
    selectArchiveMediaUrl("feature/film", [
      { name: "feature-film_meta.sqlite" },
      { name: "poster.jpg" },
      { name: "private.mp4", private: "true" },
      { name: "The Feature Film.mp4" },
    ]),
    "https://archive.org/download/feature%2Ffilm/The%20Feature%20Film.mp4",
  );
  assert.equal(selectArchiveMediaUrl("no-video", [{ name: "captions.srt" }]), null);
});

test("uses bounded curated Archive collections instead of an unrestricted query", () => {
  const collections = [
    ["feature_films", "mediatype:movies AND collection:feature_films"],
    ["classic_tv", "mediatype:movies AND collection:classic_tv"],
    ["documentary", "mediatype:movies AND collection:documentary"],
    ["animationandcartoons", "mediatype:movies AND collection:animationandcartoons"],
  ] as const;

  for (const [collection, query] of collections) {
    const url = new URL(buildFreeClassicsSearchUrl(collection));
    assert.equal(url.searchParams.get("q"), query);
    assert.equal(url.searchParams.get("rows"), "200");
    assert.deepEqual(url.searchParams.getAll("fl[]"), [
      "identifier",
      "title",
      "description",
      "year",
      "creator",
    ]);
  }
});

test("builds restricted Wikimedia and YouTube source queries", () => {
  const commonsSearches = [
    "filetype:video public domain film",
    "filetype:video documentary public domain",
    "filetype:video animation public domain",
    "filetype:video CC BY film",
  ];
  for (const search of commonsSearches) {
    const commons = new URL(buildWikimediaSearchUrl(search));
    assert.equal(commons.searchParams.get("gsrsearch"), search);
    assert.equal(commons.searchParams.get("gsrnamespace"), "6");
    assert.equal(commons.searchParams.get("gsrlimit"), "500");
    assert.equal(commons.searchParams.get("iiprop"), "url|mime|extmetadata");
  }

  const youtube = new URL(buildYoutubeSearchUrl("channel-123", "secret"));
  assert.equal(youtube.searchParams.get("channelId"), "channel-123");
  assert.equal(youtube.searchParams.get("videoEmbeddable"), "true");
  assert.equal(youtube.searchParams.get("type"), "video");
});

test("normalizes official NFB oEmbed metadata into compliant embed playback", () => {
  const filmUrl = "https://www.nfb.ca/film/example_film/";
  const oembedUrl = new URL(buildNfbOembedUrl(filmUrl));
  assert.equal(oembedUrl.origin + oembedUrl.pathname, "https://www.nfb.ca/remote/services/oembed/");
  assert.equal(oembedUrl.searchParams.get("url"), filmUrl);
  assert.equal(oembedUrl.searchParams.get("format"), "json");
  assert.deepEqual(normalizeNfbOembedDoc({
    title: "Example Film",
    description: "An official NFB film.",
    thumbnail_url: "https://www.nfb.ca/images/example.jpg",
    author_name: "NFB",
    year: "1967",
  }, filmUrl), {
    identifier: filmUrl,
    title: "Example Film",
    description: "An official NFB film.",
    year: 1967,
    creator: "NFB",
    posterUrl: "https://www.nfb.ca/images/example.jpg",
    embedUrl: "https://www.nfb.ca/film/example_film/embed/player/",
    mediaUrl: null,
    source: "nfb",
    sourceLabel: "NFB.ca",
    sourceUrl: filmUrl,
    playback: "iframe",
    licenseLabel: "NFB official free-to-watch",
  });
});

test("keeps NFB partial failures isolated while serving healthy official films", async () => {
  const router = createFreeClassicsRouter({
    enableNfb: true,
    enableYoutube: false,
    enableWikimedia: false,
    nfbFilmUrls: [
      "https://www.nfb.ca/film/healthy_film/",
      "https://www.nfb.ca/film/unavailable_film/",
    ],
    fetchFn: async (input) => {
      const url = String(input);
      if (url.includes("remote/services/oembed") && url.includes("unavailable_film")) return response({}, 503);
      if (url.includes("remote/services/oembed")) {
        return response({
          title: "Healthy NFB Film",
          thumbnail_url: "https://www.nfb.ca/images/healthy.jpg",
          description: "Still available.",
        });
      }
      return response({ response: { docs: [] } });
    },
  });
  const result = await request(router);
  assert.equal(result.status, 200);
  const body = await result.json() as { items: Array<{ source: string; title: string }> };
  assert.deepEqual(body.items, [{
    identifier: "https://www.nfb.ca/film/healthy_film/",
    title: "Healthy NFB Film",
    description: "Still available.",
    year: null,
    creator: null,
    posterUrl: "https://www.nfb.ca/images/healthy.jpg",
    embedUrl: "https://www.nfb.ca/film/healthy_film/embed/player/",
    mediaUrl: null,
    source: "nfb",
    sourceLabel: "NFB.ca",
    sourceUrl: "https://www.nfb.ca/film/healthy_film/",
    playback: "iframe",
    licenseLabel: "NFB official free-to-watch",
  }]);
});

test("merges healthy archive and Wikimedia items while ignoring duplicate source records", async () => {
  let calls = 0;
  const router = createFreeClassicsRouter({
    enableYoutube: false,
    now: () => 1_000,
    fetchFn: async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("archive.org/metadata/")) {
        return response({ files: [{ name: "one.mp4", format: "MPEG4" }] });
      }
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
  assert.equal(calls, 9);
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
        mediaUrl: "https://archive.org/download/one/one.mp4",
        source: "archive",
        sourceLabel: "Internet Archive",
        sourceUrl: "https://archive.org/details/one",
        playback: "video",
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
        mediaUrl: "https://upload.wikimedia.org/commons/commons-film.webm",
        source: "wikimedia",
        sourceLabel: "Wikimedia Commons",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Commons_Film.webm",
        playback: "video",
        licenseLabel: "CC BY-SA 4.0",
      },
    ],
    fetchedAt: "1970-01-01T00:00:01.000Z",
    page: 1,
    totalPages: 1,
    totalResults: 2,
  });
});

test("aggregates at least 100 unique items across curated Archive collections", async () => {
  const collections = ["feature_films", "classic_tv", "documentary", "animationandcartoons"];
  const router = createFreeClassicsRouter({
    enableWikimedia: false,
    enableYoutube: false,
    fetchFn: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.startsWith("/metadata/")) return response({ files: [] });

      const collection = collections.find((candidate) => url.searchParams.get("q")?.includes(`collection:${candidate}`));
      if (!collection) throw new Error(`Unexpected Archive request: ${url}`);

      return response({
        response: {
          docs: Array.from({ length: 30 }, (_, index) => ({
            identifier: `${collection}-${index}`,
            title: `${collection} title ${index}`,
            year: 1930 + index,
          })),
        },
      });
    },
  });

  const result = await request(router, "?limit=20");
  assert.equal(result.status, 200);
  const payload = (await result.json()) as { items: unknown[]; totalResults: number; totalPages: number };
  assert.equal(payload.items.length, 20);
  assert.equal(payload.totalResults, 120);
  assert.equal(payload.totalPages, 6);
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
    fetchFn: async (input) => {
      calls += 1;
      return String(input).includes("archive.org/metadata/")
        ? response({ files: [{ name: "one.webm", format: "WebM" }] })
        : response({ response: { docs: [{ identifier: "one", title: "One" }] } });
    },
  });

  const first = await request(router);
  const second = await request(router);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
   assert.equal(calls, 5);

  now += FREE_CLASSICS_CACHE_TTL_MS + 1;
  const third = await request(router);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(third.status, 200);
   assert.equal(calls, 10);
});

test("paginates and filters the cached Free Classics catalog", async () => {
  const router = createFreeClassicsRouter({
    enableWikimedia: false,
    enableYoutube: false,
    now: () => 0,
    fetchFn: async (input) => String(input).includes("archive.org/metadata/")
      ? response({ files: [{ name: "one.mp4" }] })
      : response({
          response: {
            docs: [
              { identifier: "one", title: "One" },
              { identifier: "two", title: "Two" },
              { identifier: "three", title: "Three" },
            ],
          },
        }),
  });

  const result = await request(router, "?page=2&limit=1&source=archive");
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    items: [{
      identifier: "three",
      title: "Three",
      description: null,
      year: null,
      creator: null,
      posterUrl: "https://archive.org/services/img/three",
      embedUrl: "https://archive.org/embed/three",
      mediaUrl: "https://archive.org/download/three/one.mp4",
      source: "archive",
      sourceLabel: "Internet Archive",
      sourceUrl: "https://archive.org/details/three",
      playback: "video",
      licenseLabel: "Public Domain",
    }],
    fetchedAt: "1970-01-01T00:00:00.000Z",
    page: 2,
    totalPages: 3,
    totalResults: 3,
  });
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