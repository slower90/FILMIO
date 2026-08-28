import { Meilisearch, type Index } from "meilisearch";
import { and, asc, avg, count, eq, inArray, or, sql } from "drizzle-orm";
import {
  db,
  ratingsTable,
  searchCatalogTable,
} from "@workspace/db";
import { logger } from "./logger";

export const FILMIO_SEARCH_INDEX = "filmio_search";
const SEARCH_BATCH_SIZE = 500;

export interface FilmioSearchDocument {
  id: string;
  source: string;
  providerId: number;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  alternateTitles: string;
  genre: string;
  language: string;
  releaseYear: number | null;
  filmioRating: number;
  filmioRatingCount: number;
  popularity: number;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
}

export interface MeilisearchSearchResult {
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

export type SearchIndexStatus = {
  configured: boolean;
  reachable: boolean;
  status: "healthy" | "degraded" | "fallback";
  mode: "meilisearch" | "fallback";
  lastSuccessfulSyncAt: string | null;
  indexedDocuments: number | null;
  isIndexing: boolean | null;
};

type CatalogRow = {
  catalog: typeof searchCatalogTable.$inferSelect;
  platformRating: string | number | null;
  platformRatingCount: number | null;
};

let client: Meilisearch | null | undefined;
let readyIndex: Promise<Index<FilmioSearchDocument> | null> | null = null;
let lastSuccessfulSyncAt: string | null = null;

const getConfiguredClient = (): Meilisearch | null => {
  if (client !== undefined) return client;

  const host = process.env.MEILISEARCH_HOST?.trim();
  const apiKey = process.env.MEILISEARCH_API_KEY?.trim();
  if (!host || !apiKey) {
    client = null;
    return client;
  }

  try {
    new URL(host);
  } catch {
    logger.warn("MEILISEARCH_HOST is not a valid URL; Meilisearch is disabled");
    client = null;
    return client;
  }

  client = new Meilisearch({ host: host.replace(/\/+$/, ""), apiKey });
  return client;
};

export const isMeilisearchConfigured = (): boolean =>
  Boolean(process.env.MEILISEARCH_HOST?.trim() && process.env.MEILISEARCH_API_KEY?.trim());

const waitForTask = async (searchClient: Meilisearch, task: any): Promise<void> => {
  await searchClient.tasks.waitForTask(task);
};

const ensureIndex = async (): Promise<Index<FilmioSearchDocument> | null> => {
  const searchClient = getConfiguredClient();
  if (!searchClient) return null;

  const index = searchClient.index<FilmioSearchDocument>(FILMIO_SEARCH_INDEX);
  try {
    await index.getSettings();
  } catch {
    const task = await searchClient.createIndex(FILMIO_SEARCH_INDEX, { primaryKey: "id" });
    await waitForTask(searchClient, task);
  }

  const settingsTask = await index.updateSettings({
    searchableAttributes: ["title", "alternateTitles", "genre", "language"],
    displayedAttributes: [
      "id",
      "source",
      "providerId",
      "mediaType",
      "title",
      "alternateTitles",
      "genre",
      "language",
      "releaseYear",
      "filmioRating",
      "filmioRatingCount",
      "popularity",
      "posterPath",
      "backdropPath",
      "overview",
    ],
    filterableAttributes: ["source", "mediaType", "releaseYear"],
    sortableAttributes: ["filmioRating", "filmioRatingCount", "releaseYear", "popularity"],
  });
  await waitForTask(searchClient, settingsTask);
  return index;
};

const getReadyIndex = async (): Promise<Index<FilmioSearchDocument> | null> => {
  if (!readyIndex) {
    readyIndex = ensureIndex().catch((error) => {
      readyIndex = null;
      throw error;
    });
  }
  return readyIndex;
};

const toDocument = (row: CatalogRow): FilmioSearchDocument => {
  const catalog = row.catalog;
  const providerId = Number(catalog.providerId);
  const releaseDate = catalog.releaseDate ?? "";
  const releaseYear = /^\d{4}/.test(releaseDate) ? Number(releaseDate.slice(0, 4)) : null;

  return {
    id: `${catalog.source}:${catalog.providerId}`,
    source: catalog.source,
    providerId,
    mediaType: catalog.mediaType as FilmioSearchDocument["mediaType"],
    title: catalog.title,
    alternateTitles: catalog.alternateTitles ?? "",
    genre: catalog.genres ?? "",
    language: catalog.language ?? "",
    releaseYear,
    filmioRating: row.platformRating == null ? 0 : Number(row.platformRating),
    filmioRatingCount: Number(row.platformRatingCount ?? 0),
    popularity: Number(catalog.popularity ?? 0),
    posterPath: catalog.posterPath ?? null,
    backdropPath: catalog.backdropPath ?? null,
    overview: catalog.overview ?? "",
  };
};

const ratingTotals = db
  .select({
    movieId: ratingsTable.movieId,
    platformRating: avg(ratingsTable.score).as("platform_rating"),
    platformRatingCount: count(ratingsTable.id).as("platform_rating_count"),
  })
  .from(ratingsTable)
  .groupBy(ratingsTable.movieId)
  .as("filmio_search_ratings");

const selectCatalogRows = async (where?: any): Promise<CatalogRow[]> => {
  const query = db
    .select({
      catalog: searchCatalogTable,
      platformRating: ratingTotals.platformRating,
      platformRatingCount: ratingTotals.platformRatingCount,
    })
    .from(searchCatalogTable)
    .leftJoin(
      ratingTotals,
      and(
        sql`${searchCatalogTable.providerId} ~ '^[0-9]+$'`,
        sql`${searchCatalogTable.providerId}::integer = ${ratingTotals.movieId}`,
      ),
    )
    .orderBy(asc(searchCatalogTable.id));
  return (where ? await query.where(where) : await query) as CatalogRow[];
};

const enqueueDocuments = async (
  index: Index<FilmioSearchDocument>,
  documents: FilmioSearchDocument[],
): Promise<void> => {
  for (let offset = 0; offset < documents.length; offset += SEARCH_BATCH_SIZE) {
    const task = await index.addDocuments(documents.slice(offset, offset + SEARCH_BATCH_SIZE));
    const searchClient = getConfiguredClient();
    if (searchClient) await waitForTask(searchClient, task);
  }
};

export async function reindexSearchIndex(): Promise<{ indexedDocuments: number }> {
  const index = await getReadyIndex();
  if (!index) throw new Error("Meilisearch is not configured");

  const rows = await selectCatalogRows();
  const documents = rows.map(toDocument);
  const searchClient = getConfiguredClient();
  if (!searchClient) throw new Error("Meilisearch is not configured");

  const deleteTask = await index.deleteAllDocuments();
  await waitForTask(searchClient, deleteTask);
  await enqueueDocuments(index, documents);
  lastSuccessfulSyncAt = new Date().toISOString();
  return { indexedDocuments: documents.length };
}

export async function initializeSearchIndex(): Promise<void> {
  if (!isMeilisearchConfigured()) {
    logger.info("Meilisearch is not configured; using database/provider search fallback");
    return;
  }

  const index = await getReadyIndex();
  if (!index) return;
  const stats = await index.getStats();
  if (stats.numberOfDocuments === 0) {
    const result = await reindexSearchIndex();
    logger.info({ indexedDocuments: result.indexedDocuments }, "Initialized empty Meilisearch index");
  } else {
    logger.info({ indexedDocuments: stats.numberOfDocuments }, "Meilisearch index already populated");
  }
}

export async function syncSearchCatalogRecords(
  identities: Array<{ source: string; providerId: string }>,
): Promise<void> {
  if (!identities.length || !isMeilisearchConfigured()) return;
  const index = await getReadyIndex();
  if (!index) return;

  const where = or(
    ...identities.map(({ source, providerId }) =>
      and(
        eq(searchCatalogTable.source, source),
        eq(searchCatalogTable.providerId, providerId),
      ),
    ),
  );
  const rows = await selectCatalogRows(where);
  if (!rows.length) return;
  const task = await index.addDocuments(rows.map(toDocument));
  const searchClient = getConfiguredClient();
  if (searchClient) await waitForTask(searchClient, task);
  lastSuccessfulSyncAt = new Date().toISOString();
}

export async function syncSearchDocumentsForProviderId(providerId: number): Promise<void> {
  const rows = await db
    .select({ source: searchCatalogTable.source, providerId: searchCatalogTable.providerId })
    .from(searchCatalogTable)
    .where(eq(searchCatalogTable.providerId, String(providerId)));
  await syncSearchCatalogRecords(rows);
}

export async function searchMeilisearch(
  query: string,
  limit: number,
): Promise<MeilisearchSearchResult | null> {
  if (!query.trim() || !isMeilisearchConfigured()) return null;
  const index = await getReadyIndex();
  if (!index) return null;
  const response = await index.search(query.trim(), { limit });
  return {
    results: response.hits.map((hit) => ({
      id: Number(hit.providerId),
      title: hit.title,
      posterPath: hit.posterPath ?? null,
      backdropPath: hit.backdropPath ?? null,
      overview: hit.overview ?? "",
      releaseDate: hit.releaseYear ? `${hit.releaseYear}-01-01` : "",
      voteAverage: hit.filmioRating,
      genreIds: [],
    })),
    totalResults: response.estimatedTotalHits ?? response.hits.length,
  };
}

export async function getSearchIndexStatus(): Promise<SearchIndexStatus> {
  const configured = isMeilisearchConfigured();
  if (!configured) {
    return {
      configured: false,
      reachable: false,
      status: "fallback",
      mode: "fallback",
      lastSuccessfulSyncAt: null,
      indexedDocuments: null,
      isIndexing: null,
    };
  }

  const searchClient = getConfiguredClient();
  if (!searchClient) {
    return {
      configured: true,
      reachable: false,
      status: "degraded",
      mode: "fallback",
      lastSuccessfulSyncAt,
      indexedDocuments: null,
      isIndexing: null,
    };
  }

  try {
    await searchClient.health();
  } catch {
    return {
      configured: true,
      reachable: false,
      status: "degraded",
      mode: "fallback",
      lastSuccessfulSyncAt,
      indexedDocuments: null,
      isIndexing: null,
    };
  }

  try {
    const stats = await searchClient.getStats();
    const indexStats = stats.indexes[FILMIO_SEARCH_INDEX];
    const indexedDocuments = indexStats?.numberOfDocuments ?? 0;
    const isIndexing = indexStats?.isIndexing ?? null;

    return {
      configured: true,
      reachable: true,
      status: indexStats && !isIndexing ? "healthy" : "degraded",
      mode: indexStats ? "meilisearch" : "fallback",
      lastSuccessfulSyncAt: stats.lastUpdate || lastSuccessfulSyncAt,
      indexedDocuments,
      isIndexing,
    };
  } catch {
    return {
      configured: true,
      reachable: true,
      status: "degraded",
      mode: "fallback",
      lastSuccessfulSyncAt,
      indexedDocuments: null,
      isIndexing: null,
    };
  }
}

export function resetMeilisearchClientForTests(): void {
  client = undefined;
  readyIndex = null;
  lastSuccessfulSyncAt = null;
}
