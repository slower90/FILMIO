import { Router, type IRouter } from "express";
import { db, ratingsTable, reviewsTable } from "@workspace/db";
import { avg, count, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const TMDB_BASE = "https://api.themoviedb.org/3";

const tmdbFetch = async (
  path: string,
  params: Record<string, string | number> = {},
) => {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY not configured");
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status}: ${path} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<any>;
};

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

/** Fetch up to maxPages pages in parallel and return a flat deduplicated array */
const tmdbFetchMultiPage = async (
  path: string,
  maxPages: number,
  extraParams: Record<string, string | number> = {},
): Promise<ReturnType<typeof mapMovie>[]> => {
  const pages = Array.from({ length: Math.min(maxPages, 5) }, (_, i) => i + 1);
  const results = await Promise.all(
    pages.map((page) => tmdbFetch(path, { ...extraParams, page }).catch(() => null)),
  );
  const seen = new Set<number>();
  const movies: ReturnType<typeof mapMovie>[] = [];
  for (const data of results) {
    if (!data) continue;
    for (const m of data.results ?? []) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        movies.push(mapMovie(m));
      }
    }
  }
  return movies;
};

// ─── Collection endpoints (must come before /:movieId) ───────────────────────

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
    const results = await tmdbFetchMultiPage("/trending/movie/week", maxPages);
    res.json({ results, page: 1, totalPages: 500, totalResults: results.length });
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

// GET /movies/popular?maxPages=3
router.get("/movies/popular", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 3;
  const results = await tmdbFetchMultiPage("/movie/popular", maxPages);
  res.json({ results, totalResults: results.length });
});

// GET /movies/top-rated?maxPages=3
router.get("/movies/top-rated", async (req, res): Promise<void> => {
  const maxPages = Number(req.query.maxPages) || 3;
  const results = await tmdbFetchMultiPage("/movie/top_rated", maxPages);
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
