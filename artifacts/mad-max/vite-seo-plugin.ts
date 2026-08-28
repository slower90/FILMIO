import type { IndexHtmlTransformContext, Plugin } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE_URL = "https://vishnuva.in";
const API_URL = process.env.SSR_API_BASE_URL ?? "http://127.0.0.1:8080/api";
const BUILD_OUTPUT_DIR = path.resolve(import.meta.dirname, "dist/public");

type Movie = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  posterPath?: string | null;
};

type MovieStory = {
  status?: "ready" | "partial" | "unavailable";
  headline?: string;
  dek?: string;
  updatedAt?: string;
  movie?: {
    id: number;
    title: string;
    overview?: string;
    releaseDate?: string;
    posterPath?: string | null;
    mediaType?: "movie" | "tv";
  };
  sections?: Array<{ title: string; body: string }>;
};

function titleFromSlug(slug: string | null, fallback: string) {
  const value = slug
    ?.split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return value || fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function posterUrl(pathname?: string | null) {
  if (!pathname) return undefined;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `https://image.tmdb.org/t/p/w500${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

type SeoPage = {
  title: string;
  description: string;
  heading: string;
  body: string;
  canonicalUrl: string;
  ogType?: "website" | "article";
  links?: Array<{ href: string; label: string }>;
  jsonLd?: Record<string, unknown>;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

function replaceOrInsert(html: string, pattern: RegExp, replacement: string) {
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace("</head>", `${replacement}\n</head>`);
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: "application/json" },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

function movieTitle(movie: Movie) {
  return movie.title || movie.name || "Movie";
}

function movieHref(movie: Movie) {
  return `/movies/${movie.id}`;
}

async function pageForPath(
  path: string,
  query: URLSearchParams,
  options: { allowStoryFallback?: boolean; fetchApiData?: boolean } = {},
): Promise<SeoPage | null> {
  const privateRoute =
    ["/search", "/watchlist", "/feed", "/chat", "/professionals", "/profile"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    ) || path.startsWith("/sign-in") || path.startsWith("/sign-up");
  if (privateRoute) return null;

  const storyMatch = path.match(/^\/blog\/movies\/(\d+)(?:\/[^/]+)?$/);
  if (storyMatch) {
    const type = query.get("type") === "tv" ? "tv" : "movie";
    const data = options.fetchApiData === false
      ? null
      : await getJson<MovieStory>(`/movies/${storyMatch[1]}/story?type=${type}`);
    const movie = data?.movie;
    if (!movie || data?.status === "unavailable") {
      if (!options.allowStoryFallback) return null;
      const fallbackTitle = titleFromSlug(
        path.match(/^\/blog\/movies\/\d+\/([^/]+)/)?.[1] ?? null,
        "Movie story",
      );
      const fallbackDescription = `Read the source-backed FILMIO Journal story about ${fallbackTitle}.`;
      const fallbackUrl = new URL(`${path}${query.toString() ? `?${query}` : ""}`, SITE_URL).toString();
      return {
        title: `${fallbackTitle} | FILMIO Journal`,
        description: fallbackDescription,
        heading: fallbackTitle,
        body: `<p>${escapeHtml(fallbackDescription)}</p>`,
        canonicalUrl: fallbackUrl,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: fallbackTitle,
          description: fallbackDescription,
          url: fallbackUrl,
          mainEntityOfPage: fallbackUrl,
          inLanguage: "en-IN",
          author: { "@type": "Organization", name: "FILMIO", url: SITE_URL },
          publisher: { "@type": "Organization", name: "FILMIO", url: SITE_URL },
          about: { "@type": type === "tv" ? "TVSeries" : "Movie", name: fallbackTitle },
          articleSection: "Movie stories",
        },
      };
    }

    const headline = data.headline || `${movie.title}: the FILMIO story`;
    const description =
      (data.dek?.trim() ||
        movie.overview?.trim() ||
        `Read the source-backed FILMIO Journal story about ${movie.title}.`).slice(0, 300);
    const canonicalPath = `/blog/movies/${movie.id}/${slugify(movie.title)}${type === "tv" ? "?type=tv" : ""}`;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const articleBody = (data.sections ?? [])
      .slice(0, 6)
      .map((section) => `<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>`)
      .join("");

    return {
      title: `${headline} | FILMIO Journal`,
      description,
      heading: headline,
      body: `<p>${escapeHtml(description)}</p>${articleBody}`,
      canonicalUrl,
      ogType: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BlogPosting",
            headline,
            description,
            url: canonicalUrl,
            mainEntityOfPage: canonicalUrl,
            inLanguage: "en-IN",
            ...(data.updatedAt ? { dateModified: data.updatedAt } : {}),
            ...(movie.releaseDate ? { datePublished: movie.releaseDate } : {}),
            ...(posterUrl(movie.posterPath) ? { image: posterUrl(movie.posterPath) } : {}),
            author: { "@type": "Organization", name: "FILMIO", url: SITE_URL },
            publisher: { "@type": "Organization", name: "FILMIO", url: SITE_URL },
            about: { "@type": type === "tv" ? "TVSeries" : "Movie", name: movie.title },
            articleSection: "Movie stories",
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "FILMIO", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Movie Journal", item: `${SITE_URL}/discover` },
              { "@type": "ListItem", position: 3, name: movie.title, item: canonicalUrl },
            ],
          },
        ],
      },
    };
  }

  const movieMatch = path.match(/^\/movies\/(\d+)(?:\/[^/]+)?$/);
  if (movieMatch) {
    const type = query.get("type") === "tv" ? "tv" : "movie";
    const data = options.fetchApiData === false
      ? null
      : await getJson<{ movie?: Movie; credits?: { cast?: Array<{ id: number; name: string }> } }>(
          `/movies/${movieMatch[1]}/overview?type=${type}`,
        );
    const movie = data?.movie ?? {
      id: Number(movieMatch[1]),
      title: titleFromSlug(path.match(/^\/movies\/\d+\/([^/]+)/)?.[1] ?? query.get("title"), "Movie details"),
      overview: "Explore movie details, ratings, reviews, cast information, trailers, and official viewing options on FILMIO.",
    };
    {
      const title = movieTitle(movie);
      const year = movie.releaseDate?.slice(0, 4);
      const rating = Number(movie.voteAverage ?? 0);
      const description =
        movie.overview?.trim() ||
        `Read the FILMIO details, ratings, cast, and viewing options for ${title}.`;
      const canonicalPath = `/movies/${movie.id}/${slugify(title)}${type === "tv" ? "?type=tv" : ""}`;
      const canonicalUrl = `${SITE_URL}${canonicalPath}`;
      return {
        title: `${title}${year ? ` (${year})` : ""} Ratings & Reviews | FILMIO`,
        description,
        heading: title,
        body: `<p>${escapeHtml(description)}</p><p class="seo-facts">${type === "tv" ? "TV series" : "Movie"}${year ? ` · Released ${escapeHtml(year)}` : ""}${rating ? ` · TMDB rating ${rating.toFixed(1)}/10` : ""}</p>`,
        canonicalUrl,
        links: (data?.credits?.cast ?? []).slice(0, 8).map((person) => ({
          href: `/actors/${person.id}`,
          label: person.name,
        })),
        jsonLd: {
          "@context": "https://schema.org",
          "@type": type === "tv" ? "TVSeries" : "Movie",
          name: title,
          description,
          url: canonicalUrl,
          ...(year ? { dateCreated: movie.releaseDate } : {}),
          ...(rating
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating, bestRating: 10 } }
            : {}),
        },
      };
    }
  }

  const actorMatch = path.match(/^\/actors\/(\d+)$/);
  if (actorMatch) {
    const data = options.fetchApiData === false
      ? null
      : await getJson<{ actor?: { name?: string; biography?: string }; results?: Movie[] }>(
          `/movies/actors/${actorMatch[1]}/credits`,
        );
    if (data?.actor || actorMatch[1]) {
      const name = data?.actor?.name || `Actor ${actorMatch[1]}`;
      const description =
        data?.actor?.biography?.trim() || `Explore ${name}'s movies, filmography, and notable performances on FILMIO.`;
      return {
        title: `${name} Movies & Filmography | FILMIO`,
        description,
        heading: name,
        canonicalUrl: `${SITE_URL}${path}`,
        body: `<p>${escapeHtml(description)}</p><p class="seo-facts">Filmography and cast credits</p>`,
        links: (data?.results ?? []).slice(0, 10).map((movie) => ({
          href: movieHref(movie),
          label: movieTitle(movie),
        })),
        jsonLd: { "@context": "https://schema.org", "@type": "Person", name, description, url: `${SITE_URL}${path}` },
      };
    }
  }

  const genreMatch = path.match(/^\/genre\/(\d+)$/);
  if (genreMatch) {
    const [genres, movies] = options.fetchApiData === false
      ? [null, null]
      : await Promise.all([
          getJson<{ genres?: Array<{ id: number; name: string }> }>("/movies/genres"),
          getJson<{ results?: Movie[] }>(`/movies/by-genre?genreId=${genreMatch[1]}&page=1`),
        ]);
    const name = genres?.genres?.find((genre) => genre.id === Number(genreMatch[1]))?.name || `Genre ${genreMatch[1]}`;
    const description = `Browse ${name.toLowerCase()} movies, ratings, reviews, and recommendations on FILMIO.`;
    return {
      title: `${name} Movies, Ratings & Reviews | FILMIO`,
      description,
      heading: `${name} Movies`,
      canonicalUrl: `${SITE_URL}${path}`,
      body: `<p>${escapeHtml(description)}</p><p class="seo-facts">${movies?.results?.length ?? 0} movies currently available</p>`,
      links: (movies?.results ?? []).slice(0, 12).map((movie) => ({ href: movieHref(movie), label: movieTitle(movie) })),
      jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: `${name} Movies`, description, url: `${SITE_URL}${path}` },
    };
  }

  if (path === "/anime") {
    const data = await getJson<{ results?: Array<{ id: number; title: string; synopsis?: string }> }>(
      "/anime/top?filter=score&type=tv&limit=12",
    );
    const description = "Find anime worth watching, explore genres and new releases, and read ratings and reviews on FILMIO.";
    return {
      title: "Best Anime to Watch & Review | FILMIO",
      description,
      heading: "Anime Worth Watching",
      canonicalUrl: `${SITE_URL}/anime`,
      body: `<p>${escapeHtml(description)}</p>`,
      links: (data?.results ?? []).slice(0, 12).map((anime) => ({
        href: `https://myanimelist.net/anime/${anime.id}`,
        label: anime.title,
      })),
      jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Best Anime to Watch", description, url: `${SITE_URL}/anime` },
    };
  }

  return null;
}

async function getSitemapPaths(): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/sitemap.xml`, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: "application/xml,text/xml;q=0.9" },
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const paths = new Set<string>();
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      try {
        const rawUrl = match[1].replaceAll("&amp;", "&").replaceAll("&quot;", '"');
        const url = new URL(rawUrl, SITE_URL);
        if (url.origin !== new URL(SITE_URL).origin || url.pathname === "/") continue;
        paths.add(`${url.pathname}${url.search}`);
      } catch {
        // Ignore malformed sitemap entries rather than failing the client build.
      }
    }
    return [...paths];
  } catch {
    return [];
  }
}

export function staticRouteFile(routePath: string) {
  const url = new URL(routePath, SITE_URL);
  const segments = url.pathname.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) return null;
  return path.join(BUILD_OUTPUT_DIR, ...segments, "index.html");
}

function renderPageHtml(html: string, page: SeoPage) {
  let updated = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, `<meta name="robots" content="index, follow" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`);

  updated = replaceOrInsert(
    updated,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(page.canonicalUrl)}" />`,
  );
  updated = replaceOrInsert(
    updated,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(page.canonicalUrl)}" />`,
  );
  updated = replaceOrInsert(
    updated,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${page.ogType ?? "website"}" />`,
  );
  updated = replaceOrInsert(
    updated,
    /<link rel="alternate" hrefLang="en-IN"[^>]*>/i,
    `<link rel="alternate" hrefLang="en-IN" href="${escapeHtml(page.canonicalUrl)}" />`,
  );
  updated = replaceOrInsert(
    updated,
    /<link rel="alternate" hrefLang="x-default"[^>]*>/i,
    `<link rel="alternate" hrefLang="x-default" href="${escapeHtml(page.canonicalUrl)}" />`,
  );

  if (page.jsonLd) {
    const jsonLd = `<script type="application/ld+json">${escapeJson(page.jsonLd)}</script>`;
    updated = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i.test(updated)
      ? updated.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, jsonLd)
      : updated.replace("</head>", `${jsonLd}\n</head>`);
  }

  return updated.replace('<div id="root"></div>', `${renderSeo(page)}<div id="root"></div>`);
}

async function renderRouteHtml(source: string, routePath: string, allowStoryFallback = false) {
  const url = new URL(routePath, SITE_URL);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const isPrivate =
    ["/search", "/watchlist", "/feed", "/chat", "/professionals", "/profile"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  let page: SeoPage | null = null;
  try {
    page = await pageForPath(pathname, url.searchParams, {
      allowStoryFallback,
      fetchApiData: !allowStoryFallback,
    });
  } catch {
    page = null;
  }
  if (!page) {
    return isPrivate
      ? source.replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, `<meta name="robots" content="noindex, nofollow" />`)
      : source;
  }

  return renderPageHtml(source, page);
}

async function prerenderStaticRoutes() {
  const outputIndex = path.join(BUILD_OUTPUT_DIR, "index.html");
  let source: string;
  try {
    source = await readFile(outputIndex, "utf8");
  } catch (error) {
    console.warn("[filmio-seo] could not read built index; skipping route prerender", error);
    return;
  }

  const routes = await getSitemapPaths();
  if (!routes.length) {
    console.warn("[filmio-seo] no sitemap routes available; keeping the SPA shell only");
    return;
  }

  let generated = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < routes.length) {
      const routePath = routes[cursor++];
      const aliases = [routePath];
      const url = new URL(routePath, SITE_URL);
      const aliasMatch = url.pathname.match(/^\/(movies|blog\/movies)\/(\d+)\/[^/]+$/);
      if (aliasMatch) {
        aliases.push(`/${aliasMatch[1]}/${aliasMatch[2]}${url.search}`);
      }
      const html = await renderRouteHtml(source, routePath, true);
      if (!html.includes('id="seo-prerender"')) continue;
      for (const alias of aliases) {
        const target = staticRouteFile(alias);
        if (!target) continue;
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, html, "utf8");
        generated += 1;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(3, routes.length) }, () => worker()),
  );
  console.info(`[filmio-seo] prerendered ${generated} of ${routes.length} sitemap routes`);
}

function renderSeo(page: SeoPage) {
  const links = page.links?.length
    ? `<ul>${page.links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul>`
    : "";
  return `<div id="seo-prerender" aria-label="Page summary"><main><p class="seo-kicker">FILMIO</p><h1>${escapeHtml(page.heading)}</h1>${page.body}${links}</main></div>`;
}

export function seoPrerenderPlugin(): Plugin {
  let isBuild = false;
  return {
    name: "filmio-seo-prerender",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    async closeBundle() {
      if (!isBuild) return;
      await prerenderStaticRoutes();
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        const requestUrl = req.originalUrl || req.url || "/";
        const accept = req.headers.accept ?? "";
        if (!accept.includes("text/html") || path.extname(requestUrl.split("?")[0])) {
          next();
          return;
        }
        if (!requestUrl.startsWith("/") || requestUrl.startsWith("/@") || requestUrl.startsWith("/src/")) {
          next();
          return;
        }
        try {
          const source = await readFile(path.resolve(import.meta.dirname, "index.html"), "utf8");
          const html = await server.transformIndexHtml(requestUrl, source);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          if (req.method === "HEAD") {
            res.end();
            return;
          }
          res.end(html);
        } catch {
          next();
        }
      });
    },
    async transformIndexHtml(html, ctx: IndexHtmlTransformContext) {
      return renderRouteHtml(html, ctx.path);
    },
  };
}