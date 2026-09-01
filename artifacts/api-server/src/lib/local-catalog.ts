import { and, asc, eq, ilike } from "drizzle-orm";
import {
  catalogMoviesTable,
  db,
  type CatalogMovie,
  type CatalogCredit,
  type CatalogGenre,
  type InsertCatalogMovie,
} from "@workspace/db";
import { normalizeTitle, type CatalogResponse } from "./catalog";

export const THE_VVAAN_TITLE = "The Vvaan - Force of the Forest";
const LOCAL_MOVIE_ID_MIN = 1_500_000_000;
const LOCAL_MOVIE_ID_RANGE = 500_000_000;

type ProviderFetcher = (
  path: string,
  params?: Record<string, string | number>,
) => Promise<CatalogResponse<any>>;

export type ManagedMovieResolution = {
  raw: Record<string, any>;
  metadata: Pick<CatalogResponse, "source" | "fetchedAt" | "stale">;
  local: CatalogMovie | null;
};

const managedMovieTitles = () => [
  THE_VVAAN_TITLE,
  ...(process.env.MANAGED_UPCOMING_MOVIE_TITLES ?? "")
    .split("|")
    .map((title) => title.trim())
    .filter(Boolean),
].filter((title, index, titles) => titles.findIndex((candidate) => normalizeTitle(candidate) === normalizeTitle(title)) === index);

export function getManagedMovieTitles() {
  return managedMovieTitles();
}

export function isManagedMovieTitle(title: string, candidates = managedMovieTitles()) {
  const normalized = normalizeTitle(title);
  return normalized.length > 0 && candidates.some((candidate) => normalizeTitle(candidate) === normalized);
}

export function buildLocalMovieId(source: string, sourceId: string) {
  const identity = `${source}:${sourceId}`;
  let hash = 2_166_136_261;
  for (const character of identity) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return LOCAL_MOVIE_ID_MIN + (hash >>> 0) % LOCAL_MOVIE_ID_RANGE;
}

export function localCatalogMovieToRaw(movie: CatalogMovie): Record<string, any> {
  return {
    id: movie.id,
    title: movie.title,
    poster_path: movie.posterPath,
    backdrop_path: movie.backdropPath,
    overview: movie.overview,
    release_date: movie.releaseDate ?? "",
    runtime: movie.runtime !== null && movie.runtime > 0 ? movie.runtime : null,
    genres: movie.genres,
    genre_ids: movie.genres.map((genre) => genre.id),
    credits: movie.credits,
    vote_average: movie.voteAverage,
    vote_count: movie.voteCount,
    tagline: movie.tagline,
    status: movie.status,
    budget: movie.budget,
    revenue: movie.revenue,
    imdb_id: movie.imdbId,
    external_ids: { imdb_id: movie.imdbId },
    videos: { results: [] },
    "watch/providers": { results: {} },
  };
}

export async function findLocalCatalogMovieById(id: number): Promise<CatalogMovie | null> {
  try {
    const [movie] = await db
      .select()
      .from(catalogMoviesTable)
      .where(eq(catalogMoviesTable.id, id))
      .limit(1);
    return movie ?? null;
  } catch (error) {
    console.warn("[catalog] local movie lookup unavailable:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function findLocalCatalogMovieByTitle(title: string): Promise<CatalogMovie | null> {
  try {
    const [movie] = await db
      .select()
      .from(catalogMoviesTable)
      .where(eq(catalogMoviesTable.normalizedTitle, normalizeTitle(title)))
      .limit(1);
    return movie ?? null;
  } catch (error) {
    console.warn("[catalog] local title lookup unavailable:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function findLocalCatalogMoviesByQuery(query: string, limit = 20): Promise<CatalogMovie[]> {
  const escaped = query.trim().replace(/[\\%_]/g, "\\$&");
  if (!escaped) return [];
  try {
    return await db
      .select()
      .from(catalogMoviesTable)
      .where(ilike(catalogMoviesTable.title, `%${escaped}%`))
      .limit(Math.min(Math.max(limit, 1), 100));
  } catch (error) {
    console.warn("[catalog] local search unavailable:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function findUpcomingLocalCatalogMovies(): Promise<CatalogMovie[]> {
  try {
    return await db
      .select()
      .from(catalogMoviesTable)
      .where(eq(catalogMoviesTable.isUpcoming, true))
      .orderBy(asc(catalogMoviesTable.releaseDate));
  } catch (error) {
    console.warn("[catalog] local upcoming lookup unavailable:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function allocateLocalMovieId(source: string, sourceId: string) {
  const existing = await db
    .select({ id: catalogMoviesTable.id })
    .from(catalogMoviesTable)
    .where(and(eq(catalogMoviesTable.source, source), eq(catalogMoviesTable.sourceId, sourceId)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  let candidate = buildLocalMovieId(source, sourceId);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const collision = await db
      .select({ id: catalogMoviesTable.id })
      .from(catalogMoviesTable)
      .where(eq(catalogMoviesTable.id, candidate))
      .limit(1);
    if (!collision[0]) return candidate;
    candidate = LOCAL_MOVIE_ID_MIN + ((candidate - LOCAL_MOVIE_ID_MIN + 1) % LOCAL_MOVIE_ID_RANGE);
  }
  throw new Error("Unable to allocate a local movie id");
}

export async function persistLocalCatalogMovie(input: Omit<InsertCatalogMovie, "id">): Promise<CatalogMovie | null> {
  try {
    const id = await allocateLocalMovieId(input.source, input.sourceId);
    const [movie] = await db
      .insert(catalogMoviesTable)
      .values({ ...input, id })
      .onConflictDoUpdate({
        target: [catalogMoviesTable.source, catalogMoviesTable.sourceId],
        set: {
          mediaType: input.mediaType,
          title: input.title,
          normalizedTitle: input.normalizedTitle,
          posterPath: input.posterPath,
          backdropPath: input.backdropPath,
          overview: input.overview,
          releaseDate: input.releaseDate,
          runtime: input.runtime,
          genres: input.genres,
          credits: input.credits,
          voteAverage: input.voteAverage,
          voteCount: input.voteCount,
          tagline: input.tagline,
          status: input.status,
          budget: input.budget,
          revenue: input.revenue,
          imdbId: input.imdbId,
          isUpcoming: input.isUpcoming,
          metadata: input.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return movie ?? null;
  } catch (error) {
    console.warn("[catalog] local movie persistence unavailable:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

function normalizeReleaseDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "N/A") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const year = raw.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = raw.toLowerCase().match(new RegExp(`\\b(${monthNames.join("|")})[a-z]*\\b`))?.[1];
  const day = raw.match(/\b([0-2]?\d|3[01])\b/)?.[1];
  if (!month || !day) return `${year}-01-01`;
  return `${year}-${String(monthNames.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const cleanCredits = (value: any): { cast: CatalogCredit[]; crew: CatalogCredit[] } => ({
  cast: Array.isArray(value?.cast) ? value.cast.slice(0, 20) : [],
  crew: Array.isArray(value?.crew) ? value.crew : [],
});

function rawToLocalInput(
  raw: Record<string, any>,
  source: string,
  sourceId: string,
  isUpcoming = true,
): Omit<InsertCatalogMovie, "id"> {
  const genres = (Array.isArray(raw.genres) ? raw.genres : []).map((genre: any, index: number): CatalogGenre => ({
    id: Number(genre.id) || index + 1,
    name: String(genre.name ?? "").trim(),
  })).filter((genre) => genre.name);
  return {
    source,
    sourceId,
    mediaType: "movie",
    title: String(raw.title ?? raw.name ?? "").trim(),
    normalizedTitle: normalizeTitle(String(raw.title ?? raw.name ?? "")),
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    overview: String(raw.overview ?? ""),
    releaseDate: normalizeReleaseDate(raw.release_date ?? raw.first_air_date),
    runtime: raw.runtime === null || raw.runtime === undefined || raw.runtime === ""
      ? null
      : Number.isFinite(Number(raw.runtime)) && Number(raw.runtime) > 0
        ? Number(raw.runtime)
        : null,
    genres,
    credits: cleanCredits(raw.credits),
    voteAverage: Number.isFinite(Number(raw.vote_average)) ? Number(raw.vote_average) : 0,
    voteCount: Number.isFinite(Number(raw.vote_count)) ? Number(raw.vote_count) : 0,
    tagline: raw.tagline ?? null,
    status: String(raw.status ?? ""),
    budget: Number.isFinite(Number(raw.budget)) ? Number(raw.budget) : 0,
    revenue: Number.isFinite(Number(raw.revenue)) ? Number(raw.revenue) : 0,
    imdbId: raw.imdb_id ?? raw.external_ids?.imdb_id ?? (source === "omdb" ? sourceId : null),
    isUpcoming,
    metadata: { provider: source },
  };
}

function exactResult(results: any[], title: string) {
  const normalized = normalizeTitle(title);
  return results.find((item) => normalizeTitle(String(item.title ?? item.name ?? "")) === normalized);
}

export async function resolveManagedMovieTitle(
  title: string,
  options: {
    primaryFetch: ProviderFetcher;
    fallbackFetch?: ProviderFetcher;
    managedTitles?: string[];
  },
): Promise<ManagedMovieResolution | null> {
  if (!isManagedMovieTitle(title, options.managedTitles)) return null;

  const local = await findLocalCatalogMovieByTitle(title);
  if (local) {
    return {
      raw: localCatalogMovieToRaw(local),
      local,
      metadata: { source: "local", fetchedAt: local.updatedAt.toISOString(), stale: false },
    };
  }

  const primary = await options.primaryFetch("/search/movie", { query: title, page: 1 }).catch(() => null);
  const primaryMatch = exactResult(primary?.data?.results ?? [], title);
  if (primary && primaryMatch) {
    return {
      raw: primaryMatch,
      local: null,
      metadata: { source: primary.source, fetchedAt: primary.fetchedAt, stale: primary.stale },
    };
  }

  const fallback = options.fallbackFetch
    ? await options.fallbackFetch("/search/movie", { query: title, page: 1 }).catch(() => null)
    : null;
  const fallbackMatch = exactResult(fallback?.data?.results ?? [], title);
  if (fallback && fallbackMatch) {
    const detail = await options.fallbackFetch?.(`/movie/${fallbackMatch.id}`, {}).catch(() => null);
    const raw = detail?.data && detail.data.success !== false ? detail.data : fallbackMatch;
    const persisted = await persistLocalCatalogMovie(
      rawToLocalInput(raw, fallback.source, String(fallbackMatch.id), true),
    );
    return {
      raw: persisted ? localCatalogMovieToRaw(persisted) : { ...raw, id: buildLocalMovieId(fallback.source, String(fallbackMatch.id)) },
      local: persisted,
      metadata: {
        source: persisted ? "local" : fallback.source,
        fetchedAt: detail?.fetchedAt ?? fallback.fetchedAt,
        stale: Boolean(detail?.stale ?? fallback.stale),
      },
    };
  }

  const sourceId = `manual:${normalizeTitle(title)}`;
  const manualRaw = {
    id: buildLocalMovieId("manual", sourceId),
    title,
    poster_path: process.env.VVAAN_POSTER_URL?.trim() || null,
    backdrop_path: null,
    overview: "",
    release_date: process.env.VVAAN_RELEASE_DATE?.trim() || "",
    genres: [],
    genre_ids: [],
    credits: { cast: [], crew: [] },
    vote_average: 0,
    vote_count: 0,
    tagline: null,
    status: "Planned",
    runtime: null,
    budget: 0,
    revenue: 0,
    imdb_id: null,
  };
  const persisted = await persistLocalCatalogMovie(rawToLocalInput(manualRaw, "manual", sourceId, true));
  return {
    raw: persisted ? localCatalogMovieToRaw(persisted) : manualRaw,
    local: persisted,
    metadata: { source: persisted ? "local" : "manual", fetchedAt: new Date().toISOString(), stale: false },
  };
}

export function localCatalogMoviesToRaw(movies: CatalogMovie[]) {
  return movies.map(localCatalogMovieToRaw);
}