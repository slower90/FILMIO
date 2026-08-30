import { Router, type IRouter } from "express";
import { db, ratingsTable, reviewsTable } from "@workspace/db";
import { avg, count, eq, inArray, sql } from "drizzle-orm";
import {
  catalogIdentity,
  createCatalogClient,
  createCompatibleProvider,
  createOmdbProvider,
  defaultBuildUrl,
  mergeCatalogItems,
  type CatalogMetadata,
} from "../lib/catalog";
import { getMovieStory } from "../lib/movie-stories";
import {
  getIndexedLanguages,
  parseSearchIntent,
  searchCatalog,
  tmdbToSearchCatalogRecord,
  upsertSearchCatalog,
} from "../lib/smart-search";
import { searchMeilisearch } from "../lib/meilisearch";

const router: IRouter = Router();

const TMDB_BASE = "https://api.themoviedb.org/3";
const primaryCatalogProvider = {
  name: "tmdb",
  baseUrl: TMDB_BASE,
  buildUrl: (base: string, path: string, params: Record<string, string | number>) =>
    defaultBuildUrl(base, path, {
      api_key: process.env.TMDB_API_KEY ?? "",
      ...params,
    }),
  attribution: "TMDB",
  quota: "TMDB rate limits and terms apply.",
};

const fallbackCatalogProvider = process.env.CATALOG_FALLBACK_BASE_URL
  ? createCompatibleProvider({
      name: process.env.CATALOG_FALLBACK_NAME || "approved-compatible-catalog",
      baseUrl: process.env.CATALOG_FALLBACK_BASE_URL,
      headers: process.env.CATALOG_FALLBACK_API_KEY
        ? { Authorization: `Bearer ${process.env.CATALOG_FALLBACK_API_KEY}` }
        : undefined,
      attribution: process.env.CATALOG_FALLBACK_ATTRIBUTION || "Configured catalog provider",
      quota: process.env.CATALOG_FALLBACK_QUOTA || "Configured provider quota applies.",
    })
  : process.env.OMDB_API_KEY
    ? createOmdbProvider(process.env.OMDB_API_KEY)
    : undefined;

const tmdbClient = createCatalogClient(primaryCatalogProvider, fallbackCatalogProvider);

const tmdbFetch = (path: string, params: Record<string, string | number> = {}) => {
  return tmdbClient.fetch(path, params);
};

const tmdbFetchWithMetadata = (path: string, params: Record<string, string | number> = {}) => {
  return tmdbClient.fetchWithMetadata(path, params);
};

const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000;
const SITEMAP_SITE_URL = (process.env.SITE_URL || "https://vishnuva.in").replace(/\/+$/, "");
let sitemapCache: { xml: string; expiresAt: number } | null = null;

const sitemapSlug = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const isReleasedCatalogItem = (item: any) => {
  if (item.adult === true || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0) return false;
  const title = String(item.title ?? item.name ?? "").trim();
  if (!title) return false;
  const date = String(item.release_date ?? item.first_air_date ?? "").trim();
  if (!date) return true;
  const releaseTime = new Date(`${date.slice(0, 10)}T23:59:59.999Z`).getTime();
  return Number.isNaN(releaseTime) || releaseTime <= Date.now();
};

async function buildSitemapXml(): Promise<string> {
  const staticPaths = [
    ["/", "daily", "1.0"],
    ["/discover", "daily", "0.9"],
    ["/anime", "weekly", "0.8"],
    ["/actors", "weekly", "0.7"],
    ["/genres", "weekly", "0.7"],
    ["/news", "daily", "0.7"],
    ["/free-movies", "weekly", "0.7"],
    ["/privacy", "yearly", "0.2"],
    ["/terms", "yearly", "0.2"],
  ] as const;
  const catalogRequests = [
    ["/movie/popular", "movie"],
    ["/trending/movie/week", "movie"],
    ["/movie/top_rated", "movie"],
    ["/tv/popular", "tv"],
    ["/tv/top_rated", "tv"],
  ] as const;

  const [catalogResults, actorData, genreData] = await Promise.all([
    Promise.allSettled(catalogRequests.map(([path]) => tmdbFetch(path, { page: 1 }))),
    tmdbFetch("/person/popular", { page: 1 }).catch(() => ({ results: [] })),
    tmdbFetch("/genre/movie/list").catch(() => ({ genres: [] })),
  ]);

  const dynamicPaths = new Map<string, { changefreq: string; priority: string }>();
  for (const [index, result] of catalogResults.entries()) {
    if (result.status !== "fulfilled") continue;
    const mediaType = catalogRequests[index][1];
    for (const item of (result.value as any).results ?? []) {
      if (!isReleasedCatalogItem(item)) continue;
      const slug = sitemapSlug(String(item.title ?? item.name ?? ""));
      const path = `/movies/${Number(item.id)}${slug ? `/${slug}` : ""}${mediaType === "tv" ? "?type=tv" : ""}`;
      dynamicPaths.set(path, { changefreq: "weekly", priority: "0.6" });
      const storyPath = `/blog/movies/${Number(item.id)}${slug ? `/${slug}` : ""}${mediaType === "tv" ? "?type=tv" : ""}`;
      dynamicPaths.set(storyPath, { changefreq: "weekly", priority: "0.55" });
    }
  }

  for (const person of (actorData as any).results ?? []) {
    if (!Number.isInteger(Number(person.id)) || Number(person.id) <= 0 || !String(person.name ?? "").trim()) continue;
    dynamicPaths.set(`/actors/${Number(person.id)}`, { changefreq: "weekly", priority: "0.5" });
  }
  for (const genre of (genreData as any).genres ?? []) {
    if (!Number.isInteger(Number(genre.id)) || Number(genre.id) <= 0 || !String(genre.name ?? "").trim()) continue;
    dynamicPaths.set(`/genre/${Number(genre.id)}`, { changefreq: "weekly", priority: "0.5" });
  }

  const urls = [
    ...staticPaths.map(([path, changefreq, priority]) => ({ path, changefreq, priority })),
    ...[...dynamicPaths.entries()].map(([path, metadata]) => ({ path, ...metadata })),
  ];
  const body = urls.map(({ path, changefreq, priority }) =>
    `  <url><loc>${xmlEscape(`${SITEMAP_SITE_URL}${path}`)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  try {
    if (!sitemapCache || sitemapCache.expiresAt <= Date.now()) {
      sitemapCache = { xml: await buildSitemapXml(), expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS };
    }
    res.type("application/xml").set("Cache-Control", "public, max-age=900").send(sitemapCache.xml);
  } catch (error) {
    console.error("[sitemap] generation failed", error);
    res.status(503).type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
    );
  }
});

const mapMovie = (m: any) => ({
  id: m.id,
  title: m.title ?? m.name ?? "",
  posterPath: m.poster_path ?? null,
  backdropPath: m.backdrop_path ?? null,
  overview: m.overview ?? "",
  releaseDate: m.release_date ?? m.first_air_date ?? "",
  voteAverage: m.vote_average ?? 0,
  genreIds: m.genre_ids ?? [],
});

const hasReleased = (movie: ReturnType<typeof mapMovie>) => {
  if (!movie.releaseDate) return true;
  const releaseTime = new Date(`${movie.releaseDate}T23:59:59.999Z`).getTime();
  return Number.isNaN(releaseTime) || releaseTime <= Date.now();
};

const getPrismRatings = async (movieIds: number[]) => {
  const ids = [...new Set(movieIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return new Map<number, { averageRating: number; totalRatings: number }>();

  const rows = await db
    .select({
      movieId: ratingsTable.movieId,
      averageRating: avg(ratingsTable.score),
      totalRatings: count(ratingsTable.id),
    })
    .from(ratingsTable)
    .where(inArray(ratingsTable.movieId, ids))
    .groupBy(ratingsTable.movieId);

  return new Map(
    rows.map((row) => [
      row.movieId,
      {
        averageRating: row.averageRating ? parseFloat(String(row.averageRating)) : 0,
        totalRatings: Number(row.totalRatings ?? 0),
      },
    ]),
  );
};

/** Fetch up to maxPages pages in parallel and return a flat deduplicated array */
const tmdbFetchMultiPage = async (
  path: string,
  maxPages: number,
  extraParams: Record<string, string | number> = {},
  includeUnreleased = false,
): Promise<ReturnType<typeof mapMovie>[]> => {
  const page = await tmdbFetchMultiPageWithMetadata(path, maxPages, extraParams, includeUnreleased);
  return page.results;
};

const tmdbFetchMultiPageWithMetadata = async (
  path: string,
  maxPages: number,
  extraParams: Record<string, string | number> = {},
  includeUnreleased = false,
): Promise<{ results: ReturnType<typeof mapMovie>[]; metadata: CatalogMetadata }> => {
  const pages = Array.from({ length: Math.min(maxPages, 5) }, (_, i) => i + 1);
  const responses = await Promise.all(
    pages.map((page) => tmdbFetchWithMetadata(path, { ...extraParams, page }).catch(() => null)),
  );
  const rawItems = mergeCatalogItems(
    responses.filter(Boolean).map((response) => response?.data?.results ?? []),
    catalogIdentity,
  ) as any[];
  const mediaType = path.includes("/tv") ? "tv" : "movie";
  void upsertSearchCatalog(
    rawItems
      .map((item) => tmdbToSearchCatalogRecord(item, mediaType))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  ).catch((error) => {
    console.warn("[search] catalog sync failed:", error);
  });
  const movies = rawItems.map(mapMovie);
  const first = responses.find(Boolean);
  return {
    results: includeUnreleased ? movies : movies.filter(hasReleased),
    metadata: {
      source: first?.source ?? "unavailable",
      fetchedAt: first?.fetchedAt ?? new Date(0).toISOString(),
      stale: responses.some((response) => response?.stale === true),
      partial: responses.some((response) => !response),
    },
  };
};

type CatalogCollection =
  | "trending"
  | "popular"
  | "top-rated"
  | "tv-popular"
  | "tv-top-rated"
  | "tv-upcoming"
  | "upcoming"
  | "in-theaters"
  | "free"
  | "indian";

const catalogCollectionConfig: Record<CatalogCollection, {
  path: string;
  params?: Record<string, string | number>;
  includeUnreleased?: boolean;
}> = {
  trending: { path: "/trending/movie/week" },
  popular: { path: "/movie/popular" },
  "top-rated": { path: "/movie/top_rated" },
  "tv-popular": { path: "/tv/popular" },
  "tv-top-rated": { path: "/tv/top_rated" },
  "tv-upcoming": { path: "/tv/on_the_air", includeUnreleased: true },
  upcoming: { path: "/movie/upcoming", params: { region: "IN" }, includeUnreleased: true },
  "in-theaters": { path: "/movie/now_playing", params: { region: "IN" } },
  free: {
    path: "/discover/movie",
    params: {
      watch_region: "IN",
      with_watch_monetization_types: "free|ads",
      sort_by: "popularity.desc",
    },
  },
  indian: {
    path: "/discover/movie",
    params: {
      with_origin_country: "IN",
      region: "IN",
      sort_by: "popularity.desc",
    },
  },
};

// ─── Collection endpoints (must come before /:movieId) ───────────────────────

// GET /movies/search-multi?q=  — TMDB multi-search (movies + TV + people)
router.get("/movies/search-multi", async (req, res): Promise<void> => {
  const q = req.query.q as string;
  const page = Number(req.query.page) || 1;
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  const data = await tmdbFetch("/search/multi", { query: q, page });
  void upsertSearchCatalog(
    (data.results ?? [])
      .map((item: any) => item.media_type === "tv" || item.media_type === "movie"
        ? tmdbToSearchCatalogRecord(item, item.media_type)
        : null)
      .filter((item: any) => Boolean(item)),
  ).catch((error) => {
    console.warn("[search] catalog sync failed:", error);
  });
  const results = (data.results ?? []).map((r: any) => ({
    id: r.id,
    mediaType: r.media_type, // "movie" | "tv" | "person"
    title: r.title ?? r.name ?? "",
    posterPath: r.poster_path ?? r.profile_path ?? null,
    releaseDate: r.release_date ?? r.first_air_date ?? "",
    voteAverage: r.vote_average ?? 0,
    overview: r.overview ?? r.known_for_department ?? "",
  }));
  res.json({ results, page: data.page ?? 1, totalPages: data.total_pages ?? 1 });
});

// GET /movies/search-smart?q= — natural-language movie search.
// Keeps intent server-side so "10 horror movies" becomes a rated horror
// discovery query instead of a generic text search.
router.get("/movies/search-smart", async (req, res): Promise<void> => {
  const rawQuery = String(req.query.q ?? "").trim();
  if (!rawQuery) {
    res.status(400).json({ error: "q is required" });
    return;
  }

  const indexedLanguages = await getIndexedLanguages().catch(() => []);
  const intent = parseSearchIntent(rawQuery, indexedLanguages);
  const requestedLimit = Number(req.query.limit);
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : intent.limit, 1),
    100,
  );
  intent.limit = limit;
  const hasExplicitIntent = Boolean(
    intent.genre ||
    intent.language ||
    intent.india ||
    intent.anime ||
    intent.mediaType ||
    intent.year ||
    intent.adult ||
    intent.sort !== "relevance",
  );
  const databaseIntentResult = !intent.residual && hasExplicitIntent
    ? await searchCatalog(intent)
    : null;
  if (databaseIntentResult && databaseIntentResult.results.length > 0) {
    res.json({
      query: rawQuery,
      intent: {
        limit,
        genre: intent.genre,
        language: intent.language,
        india: intent.india,
        anime: intent.anime,
        adult: intent.adult,
        sort: intent.sort,
        year: intent.year,
      },
      results: databaseIntentResult.results,
      totalResults: databaseIntentResult.totalResults,
      metadata: {
        source: "postgres-intent",
        fetchedAt: new Date().toISOString(),
        stale: false,
        partial: false,
      },
    });
    return;
  }

  if (!hasExplicitIntent || intent.residual) {
    const meilisearchResult = await searchMeilisearch(
      intent.residual || rawQuery,
      limit,
    ).catch((error) => {
      console.warn("[search] Meilisearch unavailable:", (error as Error).message);
      return null;
    });
    if (meilisearchResult && meilisearchResult.results.length > 0) {
      res.json({
        query: rawQuery,
        intent: {
          limit,
          genre: intent.genre,
          language: intent.language,
          india: intent.india,
          anime: intent.anime,
          adult: intent.adult,
          sort: intent.sort,
          year: intent.year,
        },
        results: meilisearchResult.results,
        totalResults: meilisearchResult.totalResults,
        metadata: {
          source: "meilisearch",
          fetchedAt: new Date().toISOString(),
          stale: false,
          partial: false,
        },
      });
      return;
    }
  }

  // Provider fallback remains available while the catalog is warming up or
  // when a deployment has not yet applied the search index migration.
  const normalized = rawQuery.toLowerCase().replace(/[^\w\s-]/g, " ");
  const isAdultSearch = intent.adult;
  const searchPages = Math.min(Math.max(Math.ceil(limit / 20), 1), 5);
  const yearMatch = intent.year ? [String(intent.year), String(intent.year)] : null;

  const genreEntry = intent.genre && intent.genreId ? [intent.genre, String(intent.genreId)] : null;
  const languageEntry = intent.language && intent.languageCode
    ? [intent.language.toLowerCase(), intent.languageCode, intent.language]
    : null;
  const isIndia = intent.india;
  const isAnime = intent.anime;
  // A constrained discovery request such as "10 horror movies" should still
  // surface the strongest titles first, even when the user did not type
  // "best" explicitly.
  const wantsRating = intent.sort === "rating";
  const wantsRecent = intent.sort === "recent";
  const wantsPopular = intent.sort === "popular";
  const residual = intent.residual;
  const mediaType = intent.mediaType;

  const sortBy = wantsRecent
      ? mediaType === "tv" ? "first_air_date.desc" : "primary_release_date.desc"
      : "popularity.desc";
  const params: Record<string, string | number> = {
    sort_by: sortBy,
    page: 1,
  };
  if (genreEntry) params.with_genres = genreEntry[1];
  if (languageEntry) params.with_original_language = languageEntry[1];
  if (isIndia) {
    params.with_origin_country = "IN";
    params.region = "IN";
  }
  if (yearMatch && mediaType !== "tv") {
    params.primary_release_year = Number(yearMatch[1]);
  }

  let results: ReturnType<typeof mapMovie>[] = [];
  let catalogMetadata: CatalogMetadata = {
    source: "unavailable",
    fetchedAt: new Date(0).toISOString(),
    stale: false,
    partial: false,
  };
  if (isAdultSearch) {
    // Keep this branch intentionally scoped to adult-intent queries. TMDB's
    // adult flag is the source of truth; no external explicit-content source
    // is introduced into the app.
    const keywordData = await tmdbFetch("/search/keyword", { query: "porn", page: 1 }).catch(() => ({ results: [] }));
    const keywordIds = (keywordData.results ?? [])
      .filter((keyword: any) => /\b(porn|pornography|adult|erotic)\b/i.test(keyword.name ?? ""))
      .slice(0, 5)
      .map((keyword: any) => keyword.id);
    const adultParams: Record<string, string | number> = {
      sort_by: "popularity.desc",
      include_adult: "true",
      "vote_count.gte": 1,
      ...(keywordIds.length ? { with_keywords: keywordIds.join("|") } : { with_genres: 10749 }),
    };
    const page = await tmdbFetchMultiPageWithMetadata("/discover/movie", searchPages, adultParams);
    results = page.results;
    catalogMetadata = page.metadata;
  } else if (isAnime) {
    // Anime is indexed through AniList/Jikan. If the index is still warming,
    // return a compatible empty response rather than querying TMDB for
    // unrelated titles.
    results = [];
  } else if (residual && !genreEntry && !languageEntry && !isIndia) {
    const page = await tmdbFetchMultiPageWithMetadata(
      mediaType === "tv" ? "/search/tv" : "/search/movie",
      searchPages,
      { query: residual },
    );
    results = page.results;
    catalogMetadata = page.metadata;
  } else {
    const page = await tmdbFetchMultiPageWithMetadata(
      mediaType === "tv" ? "/discover/tv" : "/discover/movie",
      searchPages,
      mediaType === "tv" && yearMatch
        ? { ...params, first_air_date_year: Number(yearMatch[1]) }
        : params,
    );
    results = page.results;
    catalogMetadata = page.metadata;
  }

  const prismRatings = wantsRating
    ? await getPrismRatings(results.map((movie) => movie.id))
    : null;
  const rankedResults = results
    .filter((movie) => movie.posterPath)
    .sort((a, b) => {
      if (!prismRatings) return 0;
      const aRating = prismRatings.get(a.id);
      const bRating = prismRatings.get(b.id);
      const aScore = aRating?.totalRatings ? aRating.averageRating : -1;
      const bScore = bRating?.totalRatings ? bRating.averageRating : -1;
      return bScore - aScore;
    });

  res.json({
    query: rawQuery,
    intent: {
      limit,
      genre: genreEntry?.[0] ?? null,
      language: languageEntry?.[2] ?? null,
      india: isIndia,
      anime: isAnime,
      adult: isAdultSearch,
      sort: wantsRating ? "rating" : wantsRecent ? "recent" : wantsPopular ? "popular" : "relevance",
      year: yearMatch ? Number(yearMatch[1]) : null,
    },
    results: rankedResults.slice(0, limit),
    // Keep a lightweight "more available" signal even when the requested
    // page happens to be exactly full; the client uses this for Show more.
    totalResults: results.length >= limit ? Math.max(results.length, limit + 1) : results.length,
    metadata: catalogMetadata,
  });
});

// GET /movies/actors — popular global actors, or people matching a search
router.get("/movies/actors", async (req, res): Promise<void> => {
  const query = String(req.query.q ?? "").trim();
  const region = String(req.query.region ?? "").trim().toLowerCase();
  const maxPages = Math.min(Math.max(Number(req.query.maxPages) || 1, 1), 5);
  const indianActorNames = [
    "Shah Rukh Khan", "Amitabh Bachchan", "Rajinikanth", "Salman Khan",
    "Aamir Khan", "Deepika Padukone", "Allu Arjun", "Prabhas",
    "Alia Bhatt", "Ranbir Kapoor", "Vijay", "Nayanthara",
    "Rashmika Mandanna", "Yash", "Hrithik Roshan", "Akshay Kumar",
    "Kareena Kapoor", "Kamal Haasan", "Suriya", "R Madhavan",
  ];
  const searchTerms = region === "india" ? indianActorNames : query ? [query] : [];
  const pages = Array.from({ length: maxPages }, (_, index) => index + 1);
  const responses = searchTerms.length
    ? await Promise.all(
        searchTerms.flatMap((term) =>
          pages.map((page) => tmdbFetch("/search/person", { query: term, page }).catch(() => null)),
        ),
      )
    : await Promise.all(pages.map((page) => tmdbFetch("/person/popular", { page }).catch(() => null)));
  const seen = new Set<number>();
  const seenNames = new Set<string>();
  const people = region === "india"
    ? searchTerms.flatMap((_, index) => {
        const firstPage = responses[index * pages.length];
        const person = (firstPage?.results ?? []).find(
          (candidate: any) => candidate.known_for_department === "Acting" && candidate.profile_path,
        ) ?? firstPage?.results?.[0];
        return person ? [person] : [];
      })
    : responses.flatMap((data) => data?.results ?? []);
  const results = responses.flatMap((data) =>
    (data?.results ?? []).flatMap((person: any) => {
      if (seen.has(person.id)) return [];
      seen.add(person.id);
      return [{
        id: person.id,
        name: person.name ?? "",
        profilePath: person.profile_path ?? null,
        knownForDepartment: person.known_for_department ?? "Acting",
        popularity: person.popularity ?? 0,
      }];
    }),
  );
  const cleanResults = (region === "india" ? people : results).filter((person: any) => {
    const normalizedName = String(person.name ?? "").trim().toLowerCase();
    if (!normalizedName || seenNames.has(normalizedName)) return false;
    seenNames.add(normalizedName);
    return true;
  }).map((person: any) => ({
    id: person.id,
    name: person.name ?? "",
    profilePath: person.profile_path ?? person.profilePath ?? null,
    knownForDepartment: person.known_for_department ?? person.knownForDepartment ?? "Acting",
    popularity: person.popularity ?? 0,
  }));
  res.json({ results: cleanResults, page: 1, totalResults: cleanResults.length });
});

// GET /movies/actors/:actorId/credits — an actor's movie filmography
router.get("/movies/actors/:actorId/credits", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.actorId) ? req.params.actorId[0] : req.params.actorId;
  const actorId = parseInt(raw, 10);
  if (!Number.isFinite(actorId)) {
    res.status(400).json({ error: "Invalid actor id" });
    return;
  }
  const [person, credits] = await Promise.all([
    tmdbFetch(`/person/${actorId}`),
    tmdbFetch(`/person/${actorId}/movie_credits`),
  ]);
  const results = (credits.cast ?? [])
    .filter((movie: any) => movie.poster_path)
    .sort((a: any, b: any) => (b.release_date ?? "").localeCompare(a.release_date ?? ""))
    .map(mapMovie);
  res.json({
    actor: {
      id: actorId,
      name: person.name ?? "",
      profilePath: person.profile_path ?? null,
      biography: person.biography ?? "",
    },
    results,
  });
});

// GET /movies/new-releases?maxPages=2
router.get("/movies/new-releases", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 2;
  const results = await tmdbFetchMultiPage("/movie/now_playing", maxPages);
  res.json({ results, totalResults: results.length });
});

// GET /movies/omdb?imdbId=tt...  or  ?title=...&year=...
router.get("/movies/omdb", async (req, res): Promise<void> => {
  const key = process.env.OMDB_API_KEY;
  if (!key) {
    res.status(503).json({ error: "OMDB_API_KEY not configured" });
    return;
  }
  const { imdbId, title, year } = req.query as Record<string, string>;
  if (!imdbId && !title) {
    res.status(400).json({ error: "imdbId or title is required" });
    return;
  }

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", key);
  url.searchParams.set("tomatoes", "true");
  if (imdbId) url.searchParams.set("i", imdbId);
  else {
    url.searchParams.set("t", title);
    if (year) url.searchParams.set("y", year);
  }

  const omdbRes = await fetch(url.toString());
  if (!omdbRes.ok) {
    res.status(502).json({ error: "OMDb request failed" });
    return;
  }
  const d = await omdbRes.json() as {
    Response?: string;
    Error?: string;
    Ratings?: Array<{ Source?: string; Value?: string }>;
    imdbRating?: string;
    imdbVotes?: string;
    Metascore?: string;
  };
  if (d.Response === "False") {
    res.status(404).json({ error: d.Error ?? "Not found" });
    return;
  }

  // Parse Ratings array
  const ratings: Record<string, string> = {};
  for (const r of d.Ratings ?? []) {
    if (r.Source && r.Value) ratings[r.Source] = r.Value;
  }

  const parseScore = (raw: string | undefined, outOf: number): number | null => {
    if (!raw || raw === "N/A") return null;
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (isNaN(n)) return null;
    return Math.round((n / outOf) * 100);
  };

  const imdb = parseScore(d.imdbRating, 10);
  const rt = parseScore(ratings["Rotten Tomatoes"], 100);
  const meta = parseScore(d.Metascore, 100);

  res.json({
    imdbRating: d.imdbRating !== "N/A" ? d.imdbRating : null,
    imdbVotes: d.imdbVotes !== "N/A" ? d.imdbVotes : null,
    rottenTomatoes: ratings["Rotten Tomatoes"] ?? null,
    metacritic: d.Metascore !== "N/A" ? d.Metascore : null,
    // All normalised to /100 for computing FILMIO Score
    imdbNorm: imdb,
    rtNorm: rt,
    metacriticNorm: meta,
  });
});

// GET /movies/search
router.get("/movies/search", async (req, res): Promise<void> => {
  const q = req.query.q as string;
  const page = Number(req.query.page) || 1;
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  const data = await tmdbFetch("/search/movie", { query: q, page });
  res.json({
    results: (data.results ?? []).map(mapMovie),
    page: data.page ?? 1,
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  });
});

// GET /movies/trending?maxPages=3
router.get("/movies/trending", async (req, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const maxPages = Number(req.query.maxPages) || 1;

  if (maxPages > 1) {
    const pageData = await tmdbFetchMultiPageWithMetadata("/trending/movie/week", maxPages);
    res.json({ results: pageData.results, page: 1, totalPages: 500, totalResults: pageData.results.length, metadata: pageData.metadata });
    return;
  }
  const data = await tmdbFetch("/trending/movie/week", { page });
  res.json({
    results: (data.results ?? []).map(mapMovie),
    page: data.page ?? 1,
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  });
});

// GET /movies/catalog?collection=popular&page=1&limit=20
// This page-oriented endpoint powers dedicated listing pages while the older
// maxPages endpoints remain available to the homepage and existing clients.
router.get("/movies/catalog", async (req, res): Promise<void> => {
  const collection = String(req.query.collection ?? "") as CatalogCollection;
  const config = catalogCollectionConfig[collection];
  if (!config) {
    res.status(400).json({ error: "Unsupported catalog collection" });
    return;
  }

  const requestedPage = Number(req.query.page);
  const requestedLimit = Number(req.query.limit);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 20)
    : 20;
  const params: Record<string, string | number> = {
    ...(config.params ?? {}),
    page,
  };
  if (collection === "indian" && String(req.query.language ?? "").trim()) {
    params.with_original_language = String(req.query.language).trim().toLowerCase();
  }

  try {
    const response = await tmdbFetchWithMetadata(config.path, params);
    const data = response.data as {
      page?: number;
      total_pages?: number;
      total_results?: number;
      results?: unknown;
    };
    const mapped = (Array.isArray(data.results) ? data.results : [])
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map(mapMovie)
      .filter((movie) => config.includeUnreleased || hasReleased(movie));
    res.json({
      results: mapped.slice(0, limit),
      page: data.page ?? page,
      totalPages: data.total_pages ?? page,
      totalResults: data.total_results ?? mapped.length,
    });
  } catch (error) {
    req.log?.error({ err: error, collection, page }, "Catalog page unavailable");
    res.status(502).json({ error: "Catalog page unavailable" });
  }
});

// GET /movies/popular?maxPages=3
router.get("/movies/popular", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 3;
  const pageData = await tmdbFetchMultiPageWithMetadata("/movie/popular", maxPages);
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

// GET /movies/top-rated?maxPages=3
router.get("/movies/top-rated", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 3;
  const pageData = await tmdbFetchMultiPageWithMetadata("/movie/top_rated", maxPages);
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

// TV collections use the same normalized shape as movie rows so the homepage
// can render both media types with the existing card components.
router.get("/movies/tv-popular", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 2;
  const pageData = await tmdbFetchMultiPageWithMetadata("/tv/popular", maxPages);
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

router.get("/movies/tv-top-rated", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 2;
  const pageData = await tmdbFetchMultiPageWithMetadata("/tv/top_rated", maxPages);
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

router.get("/movies/tv-upcoming", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 2;
  const pageData = await tmdbFetchMultiPageWithMetadata("/tv/on_the_air", maxPages, {}, true);
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

router.get("/movies/upcoming", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 2;
  const pageData = await tmdbFetchMultiPageWithMetadata("/movie/upcoming", maxPages, { region: "IN" }, true);
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

router.get("/movies/in-theaters", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 2;
  const pageData = await tmdbFetchMultiPageWithMetadata("/movie/now_playing", maxPages, { region: "IN" });
  res.json({ results: pageData.results, totalResults: pageData.results.length, metadata: pageData.metadata });
});

// Discover movies that TMDB marks as free or ad-supported in India.
router.get("/movies/free", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 3;
  const results = await tmdbFetchMultiPage("/discover/movie", maxPages, {
    watch_region: "IN",
    with_watch_monetization_types: "free|ads",
    sort_by: "popularity.desc",
  });
  res.json({ results, totalResults: results.length });
});

// Discover titles available on a selected streaming provider in India.
router.get("/movies/provider", async (req, res): Promise<void> => {
  const providerId = Number(req.query.providerId);
  const mediaType = req.query.mediaType === "tv" ? "tv" : "movie";
  const maxPages = Number(req.query.maxPages) || 2;
  if (!providerId) {
    res.status(400).json({ error: "providerId is required" });
    return;
  }
  const results = await tmdbFetchMultiPage(`/discover/${mediaType}`, maxPages, {
    with_watch_providers: providerId,
    watch_region: "IN",
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
  });
  res.json({ results, totalResults: results.length });
});

// A bounded clip feed. TMDB stores clips on title video pages, so fetch only
// the first page of popular titles and keep the request count predictable.
router.get("/movies/clips", async (_req, res): Promise<void> => {
  const popular = await tmdbFetch("/movie/popular", { page: 1 });
  const candidates = (popular.results ?? []).slice(0, 8);
  const clips = (await Promise.all(candidates.map(async (movie: any) => {
    const data = await tmdbFetch(`/movie/${movie.id}/videos`).catch(() => null);
    // This feed is explicitly for bloopers. Do not fall back to trailers,
    // teasers, or generic clips just because they are hosted on YouTube.
    const video = (data?.results ?? []).find((item: any) =>
      item.site === "YouTube" && item.type === "Bloopers",
    );
    return video ? {
      id: video.key,
      movieId: movie.id,
      title: video.name || `${movie.title ?? movie.name} clip`,
      movieTitle: movie.title ?? movie.name ?? "",
      key: video.key,
      type: video.type,
      posterPath: movie.poster_path ?? null,
    } : null;
  }))).filter(Boolean);
  res.json({ results: clips });
});

// VAST pre-roll proxy. Keep the provider tag server-side so the client cannot
// replace it with an arbitrary creative. Configure VAST_AD_TAG_URL in the
// environment with the approved provider's VAST endpoint.
router.get("/movies/clip-ad", async (_req, res): Promise<void> => {
  const tagUrl = process.env.VAST_AD_TAG_URL?.trim();
  if (!tagUrl) {
    res.json({ enabled: false });
    return;
  }

  try {
    const url = new URL(tagUrl);
    url.searchParams.set("cb", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const adRes = await fetch(url.toString(), {
      headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
    });
    if (!adRes.ok) {
      res.status(502).json({ error: "Ad provider request failed" });
      return;
    }
    const xml = await adRes.text();
    if (!xml.trim()) {
      res.status(502).json({ error: "Ad provider returned an empty response" });
      return;
    }
    res.json({ enabled: true, vastXml: xml });
  } catch {
    res.status(502).json({ error: "Ad provider request failed" });
  }
});

// GET /movies/indian?language=hi&maxPages=2 — Indian-origin movies (optionally by original language)
router.get("/movies/indian", async (req, res): Promise<void> => {
  const language = String(req.query.language ?? "").trim();
  const maxPages = Number(req.query.maxPages) || 2;
  const params: Record<string, string | number> = {
    with_origin_country: "IN",
    region: "IN",
    sort_by: "popularity.desc",
  };
  if (language) params.with_original_language = language;
  const results = await tmdbFetchMultiPage("/discover/movie", maxPages, params);
  res.json({ results, totalResults: results.length });
});

// GET /movies/genres
router.get("/movies/genres", async (_req, res): Promise<void> => {
  const data = await tmdbFetch("/genre/movie/list");
  res.json({ genres: data.genres ?? [] });
});

// GET /movies/by-genre?genreId=X&maxPages=2
router.get("/movies/by-genre", async (req, res): Promise<void> => {
  const genreId = Number(req.query.genreId);
  const page = Number(req.query.page) || 1;
  const maxPages = Number(req.query.maxPages) || 1;
  if (!genreId) {
    res.status(400).json({ error: "genreId is required" });
    return;
  }

  if (maxPages > 1) {
    const results = await tmdbFetchMultiPage("/discover/movie", maxPages, {
      with_genres: genreId,
      sort_by: "popularity.desc",
    });
    res.json({ results, totalResults: results.length });
    return;
  }

  const data = await tmdbFetch("/discover/movie", {
    with_genres: genreId,
    sort_by: "popularity.desc",
    page,
  });
  res.json({
    results: (data.results ?? []).map(mapMovie),
    page: data.page ?? 1,
    totalPages: data.total_pages ?? 1,
    totalResults: data.total_results ?? 0,
  });
});

// ─── Per-movie sub-routes (must come before bare /:movieId) ──────────────────

// GET /movies/ratings?ids=1,2,3 — FILMIO ratings for card collections.
router.get("/movies/ratings", async (req, res): Promise<void> => {
  const ids = String(req.query.ids ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 100);

  if (ids.length === 0) {
    res.json({ ratings: {} });
    return;
  }

  const ratings = Object.fromEntries(
    [...(await getPrismRatings(ids)).entries()].map(([movieId, rating]) => [
      String(movieId),
      rating,
    ]),
  );
  res.json({ ratings });
});

// GET /movies/:movieId/story?type=movie|tv — source-backed FILMIO editorial story.
router.get("/movies/:movieId/story", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid movie id" });
    return;
  }

  try {
    const story = await getMovieStory({
      id,
      mediaType: req.query.type === "tv" ? "tv" : "movie",
      fetchCatalog: tmdbFetchWithMetadata,
    });
    res.json(story);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Movie not found") {
      res.status(404).json({ error: "Movie not found" });
      return;
    }
    console.error("[movie-story] generation failed", error);
    res.status(503).json({
      error: "Movie story is temporarily unavailable",
      status: "unavailable",
    });
  }
});

// Fetch the data needed to paint the movie hero in one TMDB round-trip.
// TMDB's append_to_response keeps credits, videos, and providers from
// blocking the page behind three additional browser/API requests.
router.get("/movies/:movieId/overview", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  const mediaType = req.query.type === "tv" ? "tv" : "movie";
  const catalogResponse = await tmdbFetchWithMetadata(`/${mediaType}/${id}`, {
    append_to_response: "credits,videos,watch/providers,external_ids",
  });
  const data = catalogResponse.data;
  if (!data || data.success === false) {
    res.status(404).json({ error: "Movie not found" });
    return;
  }

  const regionData =
    data["watch/providers"]?.results?.IN ??
    data["watch/providers"]?.results?.US ??
    data["watch/providers"]?.results?.[Object.keys(data["watch/providers"]?.results ?? {})[0]] ??
    {};
  const mapProvider = (p: any) => ({
    providerId: p.provider_id,
    providerName: p.provider_name,
    logoPath: p.logo_path ?? "",
  });

  res.json({
    movie: {
      id: data.id,
      title: data.title ?? data.name ?? "",
      overview: data.overview ?? "",
      posterPath: data.poster_path ?? null,
      backdropPath: data.backdrop_path ?? null,
      releaseDate: data.release_date ?? data.first_air_date ?? "",
      runtime: data.runtime ?? data.episode_run_time?.[0] ?? null,
      genres: (data.genres ?? []).map((g: any) => ({ id: g.id, name: g.name })),
      originalLanguage: data.original_language ?? null,
      productionCountries: (data.production_countries ?? []).map((country: any) => country.name).filter(Boolean),
      voteAverage: data.vote_average ?? 0,
      voteCount: data.vote_count ?? 0,
      tagline: data.tagline ?? null,
      status: data.status ?? "",
      budget: data.budget ?? 0,
      revenue: data.revenue ?? 0,
      imdbId: data.imdb_id ?? data.external_ids?.imdb_id ?? null,
    },
    credits: {
      cast: (data.credits?.cast ?? []).slice(0, 20).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character ?? "",
        profilePath: c.profile_path ?? null,
        order: c.order ?? 0,
      })),
      crew: (data.credits?.crew ?? [])
        .filter((c: any) => ["Director", "Producer", "Screenplay", "Writer"].includes(c.job))
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          job: c.job,
          department: c.department,
          profilePath: c.profile_path ?? null,
        })),
    },
    providers: {
      flatrate: (regionData.flatrate ?? []).map(mapProvider),
      free: (regionData.free ?? []).map(mapProvider),
      ads: (regionData.ads ?? []).map(mapProvider),
      rent: (regionData.rent ?? []).map(mapProvider),
      buy: (regionData.buy ?? []).map(mapProvider),
      link: regionData.link ?? null,
    },
    videos: {
      results: (data.videos?.results ?? []).map((v: any) => ({
        id: v.id,
        key: v.key,
        name: v.name,
        site: v.site,
        type: v.type,
        official: v.official ?? false,
      })),
    },
    metadata: catalogResponse,
  });
});

// GET /movies/:movieId/recommendations
router.get("/movies/:movieId/recommendations", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  const maxPages = Number(req.query.maxPages) || 2;
  const results = await tmdbFetchMultiPage(`/movie/${id}/recommendations`, maxPages);
  res.json({ results, totalResults: results.length });
});

// GET /movies/:movieId/credits
router.get("/movies/:movieId/credits", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  const data = await tmdbFetch(`/movie/${id}/credits`);
  res.json({
    cast: (data.cast ?? []).slice(0, 20).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character ?? "",
      profilePath: c.profile_path ?? null,
      order: c.order ?? 0,
    })),
    crew: (data.crew ?? [])
      .filter((c: any) =>
        ["Director", "Producer", "Screenplay", "Writer"].includes(c.job),
      )
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profilePath: c.profile_path ?? null,
      })),
  });
});

// GET /movies/:movieId/watch-providers
router.get("/movies/:movieId/watch-providers", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  const data = await tmdbFetch(`/movie/${id}/watch/providers`);
  const regionData =
    data.results?.US ??
    data.results?.[Object.keys(data.results ?? {})[0]] ??
    {};
  const mapProvider = (p: any) => ({
    providerId: p.provider_id,
    providerName: p.provider_name,
    logoPath: p.logo_path ?? "",
  });
  res.json({
    flatrate: (regionData.flatrate ?? []).map(mapProvider),
    rent: (regionData.rent ?? []).map(mapProvider),
    buy: (regionData.buy ?? []).map(mapProvider),
    link: regionData.link ?? null,
  });
});

// GET /movies/:movieId/videos
router.get("/movies/:movieId/videos", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  const data = await tmdbFetch(`/movie/${id}/videos`);
  const results = (data.results ?? []).map((v: any) => ({
    id: v.id,
    key: v.key,
    name: v.name,
    site: v.site,
    type: v.type,
    official: v.official ?? false,
  }));
  res.json({ results });
});

// GET /movies/:movieId/stats
router.get("/movies/:movieId/stats", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const movieId = parseInt(raw, 10);

  const [ratingStats] = await db
    .select({
      averageRating: avg(ratingsTable.score),
      totalRatings: count(ratingsTable.id),
    })
    .from(ratingsTable)
    .where(eq(ratingsTable.movieId, movieId));

  const [reviewStats] = await db
    .select({
      totalReviews: count(reviewsTable.id),
      criticReviews: count(
        sql`CASE WHEN ${reviewsTable.isCriticReview} THEN 1 END`,
      ),
      audienceReviews: count(
        sql`CASE WHEN NOT ${reviewsTable.isCriticReview} THEN 1 END`,
      ),
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.movieId, movieId));

  const distribution = await db
    .select({
      score: ratingsTable.score,
      count: count(ratingsTable.id),
    })
    .from(ratingsTable)
    .where(eq(ratingsTable.movieId, movieId))
    .groupBy(ratingsTable.score)
    .orderBy(ratingsTable.score);

  res.json({
    movieId,
    averageRating: ratingStats.averageRating
      ? parseFloat(String(ratingStats.averageRating))
      : 0,
    totalRatings: Number(ratingStats.totalRatings),
    totalReviews: Number(reviewStats.totalReviews),
    criticReviews: Number(reviewStats.criticReviews),
    audienceReviews: Number(reviewStats.audienceReviews),
    ratingDistribution: distribution.map((d) => ({
      score: d.score,
      count: Number(d.count),
    })),
  });
});

// GET /movies/:movieId  ← bare route always last
router.get("/movies/:movieId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const id = parseInt(raw, 10);
  const data = await tmdbFetch(`/movie/${id}`);
  if (!data || data.success === false) {
    res.status(404).json({ error: "Movie not found" });
    return;
  }
  res.json({
    id: data.id,
    title: data.title ?? "",
    overview: data.overview ?? "",
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    releaseDate: data.release_date ?? "",
    runtime: data.runtime ?? null,
    genres: (data.genres ?? []).map((g: any) => ({ id: g.id, name: g.name })),
    voteAverage: data.vote_average ?? 0,
    voteCount: data.vote_count ?? 0,
    tagline: data.tagline ?? null,
    status: data.status ?? "",
    budget: data.budget ?? 0,
    revenue: data.revenue ?? 0,
    imdbId: data.imdb_id ?? null,
  });
});

export default router;
