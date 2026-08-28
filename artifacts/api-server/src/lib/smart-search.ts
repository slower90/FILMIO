import { db, ratingsTable, searchCatalogTable } from "@workspace/db";
import { and, asc, count, desc, eq, or, sql } from "drizzle-orm";
import type { InsertSearchCatalog } from "@workspace/db";
import { logger } from "./logger";
import { syncSearchCatalogRecords } from "./meilisearch";

export const DEFAULT_SMART_SEARCH_LIMIT = 20;
export const MAX_SMART_SEARCH_LIMIT = 100;
// Kept as a compatibility export for callers of the pre-Meilisearch parser.
// PostgreSQL no longer uses this threshold for catalog matching.
export const TRIGRAM_SIMILARITY_THRESHOLD = 0.3;

export const TMDB_GENRES: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "science fiction": 878,
  "sci fi": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

const TMDB_GENRE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(TMDB_GENRES)
    .filter(([name]) => !["sci fi"].includes(name))
    .map(([name, id]) => [id, name]),
);

const LANGUAGE_ALIASES: Array<{ canonical: string; code: string; aliases: string[] }> = [
  { canonical: "Tamil", code: "ta", aliases: ["tamil"] },
  { canonical: "Telugu", code: "te", aliases: ["telugu"] },
  { canonical: "Malayalam", code: "ml", aliases: ["malayalam"] },
  { canonical: "Kannada", code: "kn", aliases: ["kannada"] },
  { canonical: "Hindi", code: "hi", aliases: ["hindi", "bollywood"] },
  { canonical: "Korean", code: "ko", aliases: ["korean"] },
  { canonical: "Japanese", code: "ja", aliases: ["japanese"] },
  { canonical: "French", code: "fr", aliases: ["french"] },
  { canonical: "Spanish", code: "es", aliases: ["spanish"] },
  { canonical: "English", code: "en", aliases: ["english", "hollywood"] },
  { canonical: "Chinese", code: "zh", aliases: ["chinese", "mandarin"] },
  { canonical: "German", code: "de", aliases: ["german"] },
  { canonical: "Italian", code: "it", aliases: ["italian"] },
  { canonical: "Russian", code: "ru", aliases: ["russian"] },
];

const STOP_WORDS = new Set([
  "a", "an", "and", "film", "films", "for", "from", "give", "in", "me",
  "movie", "movies", "of", "show", "shows", "the", "to", "watch", "with",
]);
const INTENT_WORDS = new Set([
  "best", "highest", "latest", "must", "new", "popular", "rated", "rating",
  "recent", "top", "trending", "upcoming",
]);

export type SmartSearchSort = "rating" | "recent" | "popular" | "relevance";

export interface SmartSearchIntent {
  limit: number;
  genre: string | null;
  genreId: number | null;
  language: string | null;
  languageCode: string | null;
  india: boolean;
  anime: boolean;
  adult: boolean;
  mediaType: "movie" | "tv" | null;
  sort: SmartSearchSort;
  year: number | null;
  residual: string;
}

export interface SearchCatalogRecord {
  source: string;
  providerId: string;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  alternateTitles?: string[] | string;
  genres?: string;
  language?: string;
  languageCode?: string | null;
  releaseDate?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
  voteAverage?: number;
  genreIds?: number[];
  popularity?: number;
  metadata?: Record<string, unknown>;
}

export interface SmartSearchCatalogResult {
  results: Array<{
    id: number;
    title: string;
    posterPath: string | null;
    backdropPath: string | null;
    overview: string;
    releaseDate: string;
    voteAverage: number;
    genreIds: number[];
  }>;
  totalResults: number;
}

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();

const levenshtein = (a: string, b: string): number => {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      current.push(Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + (a[i] === b[j] ? 0 : 1),
      ));
    }
    for (let j = 0; j < current.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
};

export const textSimilarity = (left: string, right: string): number => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
};

const bestAliasMatch = (
  query: string,
  aliases: string[],
): { alias: string; matched: string; score: number; start: number; end: number } | null => {
  const normalizedQuery = normalize(query);
  const words = normalizedQuery.split(" ").filter(Boolean);
  let best: { alias: string; matched: string; score: number; start: number; end: number } | null = null;
  for (const alias of aliases) {
    const normalizedAlias = normalize(alias);
    if (normalizedQuery.includes(normalizedAlias)) {
      const start = normalizedQuery.indexOf(normalizedAlias);
      best = { alias: normalizedAlias, matched: normalizedAlias, score: 1, start, end: start + normalizedAlias.length };
      continue;
    }
    const aliasWords = normalizedAlias.split(" ");
    for (let i = 0; i <= words.length - aliasWords.length; i += 1) {
      const candidate = words.slice(i, i + aliasWords.length).join(" ");
      const score = textSimilarity(candidate, normalizedAlias);
      if (score >= 0.62 && (!best || score > best.score)) {
        const start = normalizedQuery.indexOf(candidate);
        best = { alias: normalizedAlias, matched: candidate, score, start, end: start + candidate.length };
      }
    }
  }
  return best;
};

const resolveLanguage = (
  query: string,
  indexedLanguages: string[],
): { language: string; code: string; matched: string } | null => {
  const indexed = indexedLanguages.map((language) => normalize(language)).filter(Boolean);
  const candidates = LANGUAGE_ALIASES.flatMap((entry) =>
    entry.aliases.map((alias) => ({ ...entry, alias })),
  );
  let best: { language: string; code: string; matched: string; score: number } | null = null;
  for (const candidate of candidates) {
    const aliasMatch = bestAliasMatch(query, [candidate.alias]);
    const indexedMatch = indexed.some((value) =>
      value === normalize(candidate.canonical) || textSimilarity(value, candidate.canonical) >= 0.8,
    );
    if (aliasMatch && (indexedMatch || aliasMatch.score >= 0.62) &&
        (!best || aliasMatch.score > best.score)) {
      best = {
        language: candidate.canonical,
        code: candidate.code,
        matched: query.slice(aliasMatch.start, aliasMatch.end),
        score: aliasMatch.score,
      };
    }
  }
  return best ? { language: best.language, code: best.code, matched: best.matched } : null;
};

const resolveGenre = (query: string): { name: string; id: number; matched: string } | null => {
  let best: { name: string; id: number; matched: string; score: number } | null = null;
  for (const [name, id] of Object.entries(TMDB_GENRES)) {
    const match = bestAliasMatch(query, [name]);
    if (match && (!best || match.score > best.score)) {
      best = { name: name === "sci fi" ? "science fiction" : name, id, matched: match.matched, score: match.score };
    }
  }
  return best ? { name: best.name, id: best.id, matched: best.matched } : null;
};

export function parseSearchIntent(query: string, indexedLanguages: string[] = []): SmartSearchIntent {
  const normalized = normalize(query);
  const limitMatch = normalized.match(/\b(?:top|show|give me|find)\s+(\d{1,3})\b/i);
  const rawLimit = Number(limitMatch?.[1] ?? DEFAULT_SMART_SEARCH_LIMIT);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_SMART_SEARCH_LIMIT, 1), MAX_SMART_SEARCH_LIMIT);
  const yearMatch = normalized.match(/\b(19\d{2}|20\d{2})\b/);
  const language = resolveLanguage(normalized, indexedLanguages);
  const genre = resolveGenre(normalized);
  const anime = /\banime\b/i.test(normalized);
  const mediaType = anime ? null : /\b(tv|television|series|show|shows)\b/i.test(normalized) ? "tv" : null;
  const adult = /\b(porn|pornography|xxx|18\+)\b/i.test(normalized);
  const india = /\b(india|indian|bollywood|desi)\b/i.test(normalized);
  const wantsRating = /\b(best|top|highest|rated|rating|greatest|must watch)\b/i.test(normalized) ||
    Boolean(genre || language || india);
  const wantsRecent = /\b(new|latest|recent|upcoming)\b/i.test(normalized);
  const wantsPopular = /\b(popular|trending)\b/i.test(normalized);
  const sort: SmartSearchSort = wantsRecent ? "recent" : wantsRating ? "rating" : wantsPopular ? "popular" : "relevance";

  const consumed = new Set<string>();
  if (limitMatch?.[1]) consumed.add(limitMatch[1]);
  for (const word of normalized.split(" ")) {
    if (STOP_WORDS.has(word) || INTENT_WORDS.has(word) || /^\d+$/.test(word) || /^\d{4}$/.test(word)) {
      consumed.add(word);
    }
  }
  if (language?.matched) for (const word of normalize(language.matched).split(" ")) consumed.add(word);
  if (genre?.matched) for (const word of normalize(genre.matched).split(" ")) consumed.add(word);
  if (anime) consumed.add("anime");
  if (india) for (const word of ["india", "indian", "bollywood", "desi"]) consumed.add(word);
  if (adult) for (const word of ["porn", "pornography", "xxx", "18+"]) consumed.add(word);
  const residual = normalized.split(" ").filter((word) => !consumed.has(word)).join(" ").trim();

  return {
    limit,
    genre: genre?.name ?? null,
    genreId: genre?.id ?? null,
    language: language?.language ?? null,
    languageCode: language?.code ?? null,
    india,
    anime,
    adult,
    mediaType,
    sort,
    year: yearMatch ? Number(yearMatch[1]) : null,
    residual,
  };
}

export async function getIndexedLanguages(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ language: searchCatalogTable.language })
    .from(searchCatalogTable)
    .where(sql`${searchCatalogTable.language} <> ''`);
  return rows.map((row) => row.language);
}

export function tmdbToSearchCatalogRecord(
  item: any,
  mediaType: "movie" | "tv" = "movie",
): SearchCatalogRecord | null {
  const id = Number(item.id);
  const title = String(item.title ?? item.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || !title) return null;
  const genreIds = (item.genre_ids ?? item.genreIds ?? []).map(Number).filter(Number.isInteger);
  const genres = genreIds.map((id: number) => TMDB_GENRE_NAMES[id]).filter(Boolean).join(", ");
  const languageCode = String(item.original_language ?? item.languageCode ?? "").trim() || null;
  const language = LANGUAGE_ALIASES.find((entry) => entry.code === languageCode)?.canonical ?? languageCode ?? "";
  const alternateTitles = [
    item.original_title,
    item.original_name,
    ...(Array.isArray(item.alternateTitles) ? item.alternateTitles : []),
    ...(Array.isArray(item.alternate_titles) ? item.alternate_titles : []),
  ]
    .map((value) => String(value ?? "").trim())
    .filter((value, index, values) => value && value !== title && values.indexOf(value) === index);
  return {
    source: "tmdb",
    providerId: String(id),
    mediaType,
    title,
    alternateTitles,
    genres,
    language,
    languageCode,
    releaseDate: String(item.release_date ?? item.first_air_date ?? "").slice(0, 10) || null,
    posterPath: item.poster_path ?? item.posterPath ?? null,
    backdropPath: item.backdrop_path ?? item.backdropPath ?? null,
    overview: String(item.overview ?? ""),
    voteAverage: Number(item.vote_average ?? item.voteAverage ?? 0) || 0,
    genreIds,
    popularity: Number(item.popularity ?? 0) || 0,
    metadata: { source: "tmdb" },
  };
}

export function animeToSearchCatalogRecord(
  anime: {
    id: number;
    title: string;
    alternateTitles?: string[];
    posterPath: string | null;
    backdropPath: string | null;
    synopsis: string;
    score: number;
    releaseDate: string | null;
    genres: Array<{ name: string }>;
    type: string;
  },
  source: "anilist" | "jikan",
): SearchCatalogRecord {
  return {
    source,
    providerId: String(anime.id),
    mediaType: "anime",
    title: anime.title,
    alternateTitles: anime.alternateTitles ?? [],
    genres: anime.genres.map((genre) => genre.name).join(", "),
    language: "Japanese",
    languageCode: "ja",
    releaseDate: anime.releaseDate,
    posterPath: anime.posterPath,
    backdropPath: anime.backdropPath,
    overview: anime.synopsis,
    voteAverage: anime.score,
    metadata: { type: anime.type },
  };
}

export async function upsertSearchCatalog(records: SearchCatalogRecord[]): Promise<void> {
  const values = records
    .filter((record) => record.title.trim() && record.providerId.trim())
    .map((record) => ({
      source: record.source,
      providerId: record.providerId,
      mediaType: record.mediaType,
      title: record.title,
      alternateTitles: Array.isArray(record.alternateTitles)
        ? record.alternateTitles.join(", ")
        : record.alternateTitles ?? "",
      genres: record.genres ?? "",
      language: record.language ?? "",
      languageCode: record.languageCode ?? null,
      releaseDate: record.releaseDate || null,
      posterPath: record.posterPath ?? null,
      backdropPath: record.backdropPath ?? null,
      overview: record.overview ?? "",
      voteAverage: record.voteAverage ?? 0,
      genreIds: record.genreIds ?? [],
      popularity: record.popularity ?? 0,
      metadata: record.metadata ?? null,
    } satisfies InsertSearchCatalog));
  if (!values.length) return;
  try {
    await db.insert(searchCatalogTable).values(values).onConflictDoUpdate({
      target: [searchCatalogTable.source, searchCatalogTable.providerId],
      set: {
        mediaType: sql`excluded.media_type`,
        title: sql`excluded.title`,
        alternateTitles: sql`excluded.alternate_titles`,
        genres: sql`excluded.genres`,
        language: sql`excluded.language`,
        languageCode: sql`excluded.language_code`,
        releaseDate: sql`excluded.release_date`,
        posterPath: sql`excluded.poster_path`,
        backdropPath: sql`excluded.backdrop_path`,
        overview: sql`excluded.overview`,
        voteAverage: sql`excluded.vote_average`,
        genreIds: sql`excluded.genre_ids`,
        popularity: sql`excluded.popularity`,
        metadata: sql`excluded.metadata`,
        indexedAt: sql`excluded.indexed_at`,
      },
    });
  } catch (error) {
    // Search indexing must not take down a live provider response while a
    // deployment is waiting for the schema migration to be applied.
    logger.warn({ err: error }, "Smart-search catalog upsert failed");
    return;
  }
  void syncSearchCatalogRecords(values.map(({ source, providerId }) => ({ source, providerId })))
    .catch((error) => logger.warn({ err: error }, "Meilisearch catalog sync failed"));
}

const toSearchResult = (row: any) => ({
  id: Number(row.catalog.providerId),
  title: row.catalog.title,
  posterPath: row.catalog.posterPath ?? null,
  backdropPath: row.catalog.backdropPath ?? null,
  overview: row.catalog.overview ?? "",
  releaseDate: row.catalog.releaseDate ?? "",
  voteAverage: Number(row.catalog.voteAverage ?? 0),
  genreIds: Array.isArray(row.catalog.genreIds) ? row.catalog.genreIds.map(Number) : [],
});

export async function searchCatalog(intent: SmartSearchIntent): Promise<SmartSearchCatalogResult | null> {
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
  if (!hasExplicitIntent) return null;

  const ratingTotals = db
    .select({
      movieId: ratingsTable.movieId,
      averageRating: sql<number>`avg(${ratingsTable.score})`.as("average_rating"),
      totalRatings: count(ratingsTable.id).as("total_ratings"),
    })
    .from(ratingsTable)
    .groupBy(ratingsTable.movieId)
    .as("smart_search_ratings");

  const conditions = [sql`${searchCatalogTable.title} <> ''`];
  if (intent.anime) {
    conditions.push(eq(searchCatalogTable.mediaType, "anime"));
  } else if (intent.mediaType) {
    conditions.push(eq(searchCatalogTable.mediaType, intent.mediaType));
  } else {
    conditions.push(or(eq(searchCatalogTable.mediaType, "movie"), eq(searchCatalogTable.mediaType, "tv"))!);
  }
  if (intent.genre) {
    conditions.push(sql`${searchCatalogTable.genres} ilike ${`%${intent.genre}%`}`);
  }
  if (intent.language) {
    conditions.push(sql`(${searchCatalogTable.languageCode} = ${intent.languageCode} or ${searchCatalogTable.language} ilike ${intent.language})`);
  }
  if (intent.india) {
    conditions.push(sql`(${searchCatalogTable.languageCode} in ('hi', 'ta', 'te', 'ml', 'kn') or ${searchCatalogTable.metadata}->>'originCountry' = 'IN')`);
  }
  if (intent.year) {
    conditions.push(sql`${searchCatalogTable.releaseDate} >= ${`${intent.year}-01-01`} and ${searchCatalogTable.releaseDate} <= ${`${intent.year}-12-31`}`);
  }
  if (intent.adult) {
    conditions.push(sql`coalesce(${searchCatalogTable.metadata}->>'adult', 'false') = 'true'`);
  } else {
    conditions.push(sql`coalesce(${searchCatalogTable.metadata}->>'adult', 'false') <> 'true'`);
  }
  try {
    const rows = await db
      .select({
        catalog: searchCatalogTable,
        platformRating: ratingTotals.averageRating,
        platformTotalRatings: ratingTotals.totalRatings,
      })
      .from(searchCatalogTable)
      .leftJoin(
        ratingTotals,
        and(
          sql`${searchCatalogTable.providerId} ~ '^[0-9]+$'`,
          sql`${searchCatalogTable.providerId}::integer = ${ratingTotals.movieId}`,
        ),
      )
      .where(and(...conditions))
      .orderBy(
        ...(intent.sort === "rating"
          ? [desc(sql`coalesce(${ratingTotals.averageRating}, 0)`), desc(sql`coalesce(${ratingTotals.totalRatings}, 0)`), asc(searchCatalogTable.title)]
          : intent.sort === "recent"
            ? [desc(searchCatalogTable.releaseDate), asc(searchCatalogTable.title)]
            : intent.sort === "popular"
              ? [desc(searchCatalogTable.popularity), asc(searchCatalogTable.title)]
              : [asc(searchCatalogTable.title)]),
      )
      .limit(Math.min(MAX_SMART_SEARCH_LIMIT + 1, Math.max(intent.limit + 1, 20)));

    return {
      results: rows.slice(0, intent.limit).map(toSearchResult),
      totalResults: rows.length > intent.limit ? Math.max(rows.length, intent.limit + 1) : rows.length,
    };
  } catch (error) {
    // A missing table/extension during rollout should fall back to the
    // provider-backed path instead of changing the public response contract.
    logger.warn({ err: error }, "Smart-search catalog query unavailable");
    return null;
  }
}