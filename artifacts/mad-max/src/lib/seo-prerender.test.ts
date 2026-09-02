import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { IndexHtmlTransformContext, Plugin } from "vite";
import { seoPrerenderPlugin, staticRouteFile } from "../../vite-seo-plugin";

const SOURCE_HTML = `<!doctype html>
<html>
  <head>
    <title>MAD MAX</title>
    <meta name="description" content="Homepage description" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="MAD MAX" />
    <meta property="og:description" content="Homepage description" />
    <meta property="og:url" content="https://vishnuva.in/" />
    <meta property="og:type" content="website" />
    <meta name="twitter:title" content="MAD MAX" />
    <meta name="twitter:description" content="Homepage description" />
    <link rel="canonical" href="https://vishnuva.in/" />
    <script type="application/ld+json">{"@type":"WebSite"}</script>
  </head>
  <body><div id="root"></div></body>
</html>`;

type JsonResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

function jsonResponse(value: unknown): JsonResponse {
  return { ok: true, json: async () => value };
}

function createFixtureFetch() {
  return async (input: string | URL | Request): Promise<JsonResponse> => {
    const url = new URL(String(input));
    const route = `${url.pathname}${url.search}`;

    const fixtures: Record<string, unknown> = {
      "/api/movies/101/overview?type=movie": {
        movie: {
          id: 101,
          title: "The Long Take",
          overview: "A carefully observed story about making movies.",
          releaseDate: "2024-06-14",
          voteAverage: 8.4,
        },
        credits: { cast: [{ id: 201, name: "Ava Director" }] },
      },
      "/api/movies/202/overview?type=tv": {
        movie: {
          id: 202,
          name: "The Night Shift",
          overview: "A TV series about the people who keep a city moving.",
          releaseDate: "2025-01-09",
          voteAverage: 7.9,
        },
      },
      "/api/movies/303/overview?type=movie": {
        movie: { id: 303, title: "Journal Movie" },
      },
      "/api/movies/404/story?type=movie": {
        status: "ready",
        headline: "Inside The Long Take",
        dek: "A source-backed look at the craft behind The Long Take.",
        movie: {
          id: 404,
          title: "The Long Take",
          overview: "The overview for the Journal fixture.",
          releaseDate: "2024-06-14",
          mediaType: "movie",
        },
        sections: [{ title: "The craft", body: "Every frame has a reason." }],
      },
      "/api/movies/505/story?type=tv": {
        status: "ready",
        headline: "Inside The Night Shift",
        dek: "The FILMIO Journal follows this TV series from page to screen.",
        movie: {
          id: 505,
          title: "The Night Shift",
          overview: "The TV Journal fixture overview.",
          releaseDate: "2025-01-09",
          mediaType: "tv",
        },
      },
      "/api/movies/actors/606/credits": {
        actor: {
          name: "Ava Performer",
          biography: "A performer known for precise and memorable work.",
        },
        results: [{ id: 101, title: "The Long Take" }],
      },
      "/api/movies/genres": {
        genres: [{ id: 18, name: "Drama" }],
      },
      "/api/movies/by-genre?genreId=18&page=1": {
        results: [{ id: 101, title: "The Long Take" }],
      },
      "/api/free-classics?limit=200": {
        items: [{
          identifier: "film-1",
          title: "The Public Domain Film",
          description: "A public-domain classic preserved for free online viewing.",
          year: 1931,
          posterUrl: "https://archive.org/services/img/film-1",
          source: "archive",
          sourceLabel: "Internet Archive",
          sourceUrl: "https://archive.org/details/film-1",
          licenseLabel: "Public Domain",
        }],
      },
      "/api/free-classics/archive/film-1": {
        identifier: "film-1",
        title: "The Public Domain Film",
        description: "A public-domain classic preserved for free online viewing.",
        year: 1931,
        posterUrl: "https://archive.org/services/img/film-1",
        source: "archive",
        sourceLabel: "Internet Archive",
        sourceUrl: "https://archive.org/details/film-1",
        licenseLabel: "Public Domain",
      },
    };

    const fixture = fixtures[route];
    return jsonResponse(fixture ?? {});
  };
}

async function renderRoute(routePath: string) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = createFixtureFetch() as typeof fetch;
  try {
    const plugin = seoPrerenderPlugin();
    const transform = plugin.transformIndexHtml;
    assert.equal(typeof transform, "function");
    return await (transform as (html: string, ctx: IndexHtmlTransformContext) => Promise<string>)(
      SOURCE_HTML,
      { path: routePath } as IndexHtmlTransformContext,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function jsonLdFrom(html: string): Record<string, unknown> {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "route should contain structured data");
  return JSON.parse(match[1]) as Record<string, unknown>;
}

function jsonLdTypes(jsonLd: Record<string, unknown>) {
  if (typeof jsonLd["@type"] === "string") return [jsonLd["@type"]];
  return ((jsonLd["@graph"] as Array<Record<string, unknown>> | undefined) ?? [])
    .map((entry) => entry["@type"])
    .filter((type): type is string => typeof type === "string");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

test("keeps movie, TV, actor, genre, and Journal metadata route-specific", async () => {
  const cases = [
    {
      route: "/movies/101/the-long-take",
      title: "The Long Take - Ratings, Reviews & Where to Watch | FILMIO",
      description: "A carefully observed story about making movies.",
      canonical: "https://vishnuva.in/movies/101/the-long-take",
      structuredType: "Movie",
    },
    {
      route: "/movies/202/the-night-shift?type=tv",
      title: "The Night Shift - Ratings, Reviews & Where to Watch | FILMIO",
      description: "A TV series about the people who keep a city moving.",
      canonical: "https://vishnuva.in/movies/202/the-night-shift?type=tv",
      structuredType: "TVSeries",
    },
    {
      route: "/actors/606",
      title: "Ava Performer Movies & Filmography | FILMIO",
      description: "A performer known for precise and memorable work.",
      canonical: "https://vishnuva.in/actors/606",
      structuredType: "Person",
    },
    {
      route: "/genre/18",
      title: "Drama Movies, Ratings & Reviews | FILMIO",
      description: "Browse drama movies, ratings, reviews, and recommendations on FILMIO.",
      canonical: "https://vishnuva.in/genre/18",
      structuredType: "CollectionPage",
    },
    {
      route: "/blog/movies/404/the-long-take",
      title: "Inside The Long Take | FILMIO Journal",
      description: "A source-backed look at the craft behind The Long Take.",
      canonical: "https://vishnuva.in/blog/movies/404/the-long-take",
      structuredType: "BlogPosting",
    },
  ];

  for (const fixture of cases) {
    const html = await renderRoute(fixture.route);
    assert.ok(html.includes(`<title>${escapeHtml(fixture.title)}</title>`), `${fixture.route} should have its own title`);
    assert.ok(html.includes(`name="description" content="${escapeHtml(fixture.description)}"`), `${fixture.route} should have its own description`);
    assert.ok(html.includes(`rel="canonical" href="${fixture.canonical}"`), `${fixture.route} should have its own canonical`);
    assert.ok(jsonLdTypes(jsonLdFrom(html)).includes(fixture.structuredType), `${fixture.route} should have ${fixture.structuredType} structured data`);
    assert.doesNotMatch(html, /<title>MAD MAX<\/title>/);
    assert.match(html, /id="seo-prerender"/);
  }
});

test("prerenders Free Classics collection and Movie schema", async () => {
  const collectionHtml = await renderRoute("/free-classics");
  assert.match(collectionHtml, /<title>Watch Free Classic Movies Online - Public Domain Cinema \| FILMIO<\/title>/);
  assert.match(collectionHtml, /name="description" content="Watch free classic movies online from public-domain cinema sources/);
  assert.ok(jsonLdTypes(jsonLdFrom(collectionHtml)).includes("CollectionPage"));
  assert.match(collectionHtml, /href="\/free-classics\/archive\/film-1"/);

  const detailHtml = await renderRoute("/free-classics/archive/film-1");
  const detailJsonLd = jsonLdFrom(detailHtml);
  assert.match(detailHtml, /<title>The Public Domain Film - Watch Free Classic Movie Online \| FILMIO<\/title>/);
  assert.ok(jsonLdTypes(detailJsonLd).includes("Movie"));
  assert.equal(detailJsonLd.name, "The Public Domain Film");
  assert.equal(detailJsonLd.image, "https://archive.org/services/img/film-1");
  assert.equal(detailJsonLd.isAccessibleForFree, true);
});

test("keeps the homepage metadata aligned with the SEO brief", async () => {
  const html = await readFile(path.resolve(import.meta.dirname, "../../index.html"), "utf8");
  assert.match(html, /<title>FILMIO - Discover, Rate &amp; Review Movies, TV Shows &amp; Anime \| Free Classic Movies<\/title>/);
  assert.match(html, /<meta name="description" content="Discover movies, watch free classic films, and explore Indian films, TV shows, and anime with FILMIO ratings, reviews, trailers, and watch options\." \/>/);
});

test("prerenders static support metadata", async () => {
  const html = await renderRoute("/help");
  assert.match(html, /<title>FILMIO Help Center \| Search, Ratings &amp; Watchlists<\/title>/);
  assert.match(html, /<h1>How Can We Help\?<\/h1>/);
  assert.ok(jsonLdTypes(jsonLdFrom(html)).includes("WebPage"));
});

test("prerenders the Vishnuva company roadmap metadata", async () => {
  const html = await renderRoute("/about-vishnuva");
  assert.match(html, /<title>About Vishnuva Group \| Building Tomorrow&#39;s Everyday Life<\/title>/);
  assert.match(html, /<h1>Vishnuva Group — Building Tomorrow&#39;s Everyday Life<\/h1>/);
  assert.match(html, /Phase 1: Vishnuva Logistics \/ Movement/);
  assert.ok(jsonLdTypes(jsonLdFrom(html)).includes("WebPage"));
});

test("keeps the TV Journal type=tv query in canonical and structured data", async () => {
  const html = await renderRoute("/blog/movies/505/the-night-shift?type=tv");
  const jsonLd = jsonLdFrom(html);
  const graph = jsonLd["@graph"] as Array<Record<string, unknown>>;
  const article = graph.find((entry) => entry["@type"] === "BlogPosting");

  assert.match(html, /<title>Inside The Night Shift \| FILMIO Journal<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/vishnuva\.in\/blog\/movies\/505\/the-night-shift\?type=tv"/);
  assert.equal(article?.url, "https://vishnuva.in/blog/movies/505/the-night-shift?type=tv");
  assert.deepEqual(article?.about, { "@type": "TVSeries", name: "The Night Shift" });
});

test("keeps extensionless rewrite targets aligned with generated route files", async () => {
  const artifactTomlPath = path.resolve(import.meta.dirname, "../../.replit-artifact/artifact.toml");
  const artifactToml = await readFile(artifactTomlPath, "utf8");
  const rewrites = [...artifactToml.matchAll(
    /\[\[services\.production\.rewrites\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"/g,
  )].map((match) => ({ from: match[1], to: match[2] }));

  const expected = [
    ["/movies/*", "/movies/*/index.html"],
    ["/blog/movies/*", "/blog/movies/*/index.html"],
    ["/actors/*", "/actors/*/index.html"],
    ["/genre/*", "/genre/*/index.html"],
    ["/anime", "/anime/index.html"],
    ["/free-classics", "/free-classics/index.html"],
    ["/free-classics/*", "/free-classics/*/index.html"],
  ];

  for (const [from, to] of expected) {
    assert.ok(rewrites.some((rewrite) => rewrite.from === from && rewrite.to === to), `missing rewrite ${from} -> ${to}`);
  }
  assert.deepEqual(rewrites.at(-1), { from: "/*", to: "/index.html" }, "SPA fallback must remain last");

  const routeMappings = [
    ["/movies/101/the-long-take", "/movies/*"],
    ["/movies/202/the-night-shift?type=tv", "/movies/*"],
    ["/blog/movies/505/the-night-shift?type=tv", "/blog/movies/*"],
    ["/actors/606", "/actors/*"],
    ["/genre/18", "/genre/*"],
    ["/anime", "/anime"],
    ["/free-classics/archive/film-1", "/free-classics/*"],
  ];

  for (const [route, rewriteFrom] of routeMappings) {
    const rewrite = rewrites.find((candidate) => candidate.from === rewriteFrom);
    assert.ok(rewrite);
    const suffix = rewriteFrom === "/anime" ? "" : route.split("?")[0].slice(rewriteFrom.slice(0, -1).length);
    const target = rewrite.to.replace("*", suffix.replace(/^\/?/, ""));
    const generated = staticRouteFile(route);
    assert.ok(generated?.endsWith(`/dist/public${target}`), `${route} should map to ${target}`);
  }
});