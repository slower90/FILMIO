import { Router, type IRouter } from "express";
import { GetFreeClassicsResponse } from "@workspace/api-zod";

const INTERNET_ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php";
const ARCHIVE_COLLECTION_QUERIES = {
  feature_films: "mediatype:movies AND collection:feature_films",
  classic_tv: "mediatype:movies AND collection:classic_tv",
  documentary: "mediatype:movies AND collection:documentary",
  animationandcartoons: "mediatype:movies AND collection:animationandcartoons",
} as const;
type ArchiveCollection = keyof typeof ARCHIVE_COLLECTION_QUERIES;
const ARCHIVE_COLLECTIONS = Object.keys(ARCHIVE_COLLECTION_QUERIES) as ArchiveCollection[];
const ARCHIVE_ROWS = 200;
const ARCHIVE_ITEMS_PER_COLLECTION = 150;
const ARCHIVE_METADATA_CONCURRENCY = 12;
const WIKIMEDIA_ROWS = 500;
const WIKIMEDIA_SEARCHES = [
  "filetype:video public domain film",
  "filetype:video documentary public domain",
  "filetype:video animation public domain",
  "filetype:video CC BY film",
] as const;
const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";
const WIKIMEDIA_USER_AGENT = "FILMIO-Free-Classics/1.0 (https://vishnuva.in)";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const NFB_OEMBED_URL = "https://www.nfb.ca/remote/services/oembed/";
const DEFAULT_NFB_FILMS = [
  "https://www.nfb.ca/film/flamenco_at_515/",
  "https://www.nfb.ca/film/sleeping_betty/",
  "https://www.nfb.ca/film/log_drivers_waltz/",
  "https://www.nfb.ca/film/memories_of_angels/",
  "https://www.nfb.ca/film/carts_of_darkness/",
  "https://www.nfb.ca/film/standing_alone/",
  "https://www.nfb.ca/film/blackfly/",
  "https://www.nfb.ca/film/the-cat-came-back/",
  "https://www.nfb.ca/film/runaway/",
  "https://www.nfb.ca/film/cesars_bark_canoe/",
  "https://www.nfb.ca/film/nahanni/",
  "https://www.nfb.ca/film/the_sand_castle/",
] as const;
export const FREE_CLASSICS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ITEMS = 200;
const MAX_ITEMS_PER_SOURCE = 150;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv)(?:[?#]|$)/i;
const DEFAULT_PAGE_SIZE = 20;

export type FreeClassicSource = "archive" | "youtube" | "wikimedia" | "nfb";
export type FreeClassicPlayback = "iframe" | "video";

type ArchiveDoc = Record<string, unknown>;
type WikimediaPage = Record<string, unknown>;
type YoutubeDoc = Record<string, unknown>;

export type FreeClassic = {
  identifier: string;
  title: string;
  description: string | null;
  year: number | null;
  creator: string | null;
  posterUrl: string;
  embedUrl: string;
  mediaUrl: string | null;
  source: FreeClassicSource;
  sourceLabel: string;
  sourceUrl: string;
  playback: FreeClassicPlayback;
  licenseLabel: string;
};

export function freeClassicPath(item: Pick<FreeClassic, "source" | "identifier">): string {
  return `/free-classics/${item.source}/${encodeURIComponent(item.identifier)}`;
}

type FreeClassicsCache = {
  items: FreeClassic[];
  fetchedAt: number;
};

let freeClassicsSitemapLoader: (() => Promise<FreeClassic[]>) | null = null;

export async function getFreeClassicsForSitemap(): Promise<FreeClassic[]> {
  return freeClassicsSitemapLoader ? freeClassicsSitemapLoader() : [];
}

type FreeClassicsRouteOptions = {
  fetchFn?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
  enableArchive?: boolean;
  enableWikimedia?: boolean;
  enableYoutube?: boolean;
  enableNfb?: boolean;
  youtubeApiKey?: string | null;
  youtubeChannelIds?: string[];
  curatedYoutubeItems?: unknown[];
  nfbFilmUrls?: string[];
};

type SourceResult = {
  source: FreeClassicSource;
  items: FreeClassic[];
};

function firstText(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstText(item);
      if (text) return text;
    }
    return null;
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function parseYear(value: unknown): number | null {
  const text = firstText(value);
  if (!text) return null;
  const match = text.match(/\b(18|19|20)\d{2}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isInteger(year) ? year : null;
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (value && typeof value === "object" && "value" in value) {
    return firstText((value as { value?: unknown }).value);
  }
  return firstText(value);
}

function stripHtml(value: string | null): string | null {
  if (!value) return null;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  return firstText(text);
}

function uniqueItems(items: FreeClassic[]): FreeClassic[] {
  const seen = new Set<string>();
  const sourceCounts = new Map<FreeClassicSource, number>();
  return items
    .filter((item) => {
      const key = `${item.source}:${item.identifier}`;
      if (seen.has(key)) return false;
      const count = sourceCounts.get(item.source) ?? 0;
      if (count >= MAX_ITEMS_PER_SOURCE) return false;
      seen.add(key);
      sourceCounts.set(item.source, count + 1);
      return true;
    })
    .sort((a, b) => {
      const sourceOrder: Record<FreeClassicSource, number> = { archive: 0, youtube: 1, wikimedia: 2, nfb: 3 };
      return sourceOrder[a.source] - sourceOrder[b.source] || a.title.localeCompare(b.title);
    })
    .slice(0, MAX_ITEMS);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export function buildArchiveMetadataUrl(identifier: string): string {
  return `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
}

export function selectArchiveMediaUrl(identifier: string, files: unknown): string | null {
  if (!Array.isArray(files)) return null;
  const playable = files.find((file) => {
    if (!file || typeof file !== "object") return false;
    const record = file as Record<string, unknown>;
    const name = firstText(record.name);
    if (!name || !VIDEO_EXTENSIONS.test(name)) return false;
    return record.private !== "true" && record.private !== true;
  }) as Record<string, unknown> | undefined;
  const name = firstText(playable?.name);
  return name
    ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(name)}`
    : null;
}

export function normalizeFreeClassicDoc(doc: ArchiveDoc): FreeClassic | null {
  const identifier = firstText(doc.identifier);
  const title = firstText(doc.title);
  if (!identifier || !title) return null;

  const encodedIdentifier = encodeURIComponent(identifier);
  return {
    identifier,
    title,
    description: firstText(doc.description),
    year: parseYear(doc.year ?? doc.date ?? doc.publicdate),
    creator: firstText(doc.creator),
    posterUrl: `https://archive.org/services/img/${encodedIdentifier}`,
    embedUrl: `https://archive.org/embed/${encodedIdentifier}`,
    mediaUrl: null,
    source: "archive",
    sourceLabel: "Internet Archive",
    sourceUrl: `https://archive.org/details/${encodedIdentifier}`,
    playback: "iframe",
    licenseLabel: "Public Domain",
  };
}

export function buildFreeClassicsSearchUrl(collection: ArchiveCollection = "feature_films"): string {
  const url = new URL(INTERNET_ARCHIVE_SEARCH_URL);
  url.searchParams.set("q", ARCHIVE_COLLECTION_QUERIES[collection]);
  url.searchParams.append("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "description");
  url.searchParams.append("fl[]", "year");
  url.searchParams.append("fl[]", "creator");
  url.searchParams.set("rows", String(ARCHIVE_ROWS));
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");
  return url.toString();
}

export function buildWikimediaSearchUrl(search: string = WIKIMEDIA_SEARCHES[0]): string {
  const url = new URL(WIKIMEDIA_API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", search);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", String(WIKIMEDIA_ROWS));
  url.searchParams.set("prop", "info|imageinfo");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("iiprop", "url|mime|extmetadata");
  url.searchParams.set("iiurlwidth", "342");
  return url.toString();
}

export function buildYoutubeSearchUrl(channelId: string, apiKey: string): string {
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("q", "public domain full movie");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("videoSyndicated", "true");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function normalizeYoutubeDoc(doc: YoutubeDoc, licenseLabel = "Verified free-to-watch source"): FreeClassic | null {
  const idValue = doc.videoId ?? (typeof doc.id === "object" ? (doc.id as Record<string, unknown>).videoId : doc.id);
  const videoId = firstText(idValue);
  const title = firstText(doc.title ?? (doc.snippet as Record<string, unknown> | undefined)?.title);
  if (!videoId || !title || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null;

  const snippet = (doc.snippet && typeof doc.snippet === "object" ? doc.snippet : {}) as Record<string, unknown>;
  const channelTitle = firstText(doc.channelTitle ?? snippet.channelTitle);
  const channelId = firstText(doc.channelId ?? snippet.channelId);
  const sourceUrl = firstText(doc.sourceUrl) ?? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  return {
    identifier: videoId,
    title,
    description: firstText(doc.description ?? snippet.description),
    year: parseYear(doc.year ?? doc.publishedAt ?? snippet.publishedAt),
    creator: channelTitle,
    posterUrl: firstText(doc.posterUrl) ?? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`,
    mediaUrl: null,
    source: "youtube",
    sourceLabel: channelTitle ? `YouTube · ${channelTitle}` : "YouTube",
    sourceUrl,
    playback: "iframe",
    licenseLabel: firstText(doc.licenseLabel ?? doc.legalLabel) ?? licenseLabel,
  };
}

function readCuratedYoutubeItems(options: FreeClassicsRouteOptions): unknown[] {
  if (options.curatedYoutubeItems) return options.curatedYoutubeItems;
  const raw = process.env.FREE_CLASSICS_YOUTUBE_CATALOG;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getYoutubeApiKey(options: FreeClassicsRouteOptions): string | null {
  return options.youtubeApiKey === undefined
    ? firstText(process.env.YOUTUBE_API_KEY)
    : firstText(options.youtubeApiKey);
}

function getYoutubeChannelIds(options: FreeClassicsRouteOptions): string[] {
  if (options.youtubeChannelIds) return options.youtubeChannelIds.filter(Boolean);
  return (process.env.FREE_CLASSICS_YOUTUBE_CHANNEL_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function normalizeWikimediaPage(page: WikimediaPage): FreeClassic | null {
  const imageInfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
  if (!imageInfo || typeof imageInfo !== "object") return null;
  const info = imageInfo as Record<string, unknown>;
  const mime = firstText(info.mime);
  const mediaUrl = firstText(info.url);
  if (!mediaUrl || !mime?.startsWith("video/") || !VIDEO_EXTENSIONS.test(mediaUrl)) return null;

  const metadata = (info.extmetadata && typeof info.extmetadata === "object"
    ? info.extmetadata
    : {}) as Record<string, unknown>;
  const license = metadataText(metadata, "LicenseShortName") ?? metadataText(metadata, "UsageTerms");
  if (!license || !/(public\s*domain|cc0|creative\s*commons|cc[-\s]?by)/i.test(license) || /non[-\s]?commercial|\bNC\b/i.test(license)) {
    return null;
  }

  const rawTitle = firstText(page.title);
  if (!rawTitle) return null;
  const title = rawTitle
    .replace(/^File:/i, "")
    .replace(/\.(mp4|webm)$/i, "")
    .replace(/_/g, " ");
  const pageId = firstText(page.pageid) ?? encodeURIComponent(rawTitle);
  const sourceUrl = firstText(page.fullurl) ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(rawTitle.replace(/ /g, "_"))}`;
  return {
    identifier: pageId,
    title,
    description: stripHtml(metadataText(metadata, "ImageDescription")),
    year: parseYear(metadataText(metadata, "DateTimeOriginal") ?? metadataText(metadata, "Date")),
    creator: stripHtml(metadataText(metadata, "Artist") ?? metadataText(metadata, "Creator")),
    posterUrl: firstText(info.thumburl) ?? mediaUrl,
    embedUrl: mediaUrl,
    mediaUrl,
    source: "wikimedia",
    sourceLabel: "Wikimedia Commons",
    sourceUrl,
    playback: "video",
    licenseLabel: license,
  };
}

export function buildNfbOembedUrl(filmUrl: string): string {
  const url = new URL(NFB_OEMBED_URL);
  url.searchParams.set("url", filmUrl);
  url.searchParams.set("format", "json");
  return url.toString();
}

export function normalizeNfbOembedDoc(doc: Record<string, unknown>, filmUrl: string): FreeClassic | null {
  const title = firstText(doc.title);
  const posterUrl = firstText(doc.thumbnail_url);
  if (!title || !posterUrl || !/^https?:\/\//i.test(filmUrl)) return null;
  const sourceUrl = new URL(filmUrl).toString();
  const embedUrl = `${sourceUrl.replace(/\/$/, "")}/embed/player/`;
  return {
    identifier: sourceUrl,
    title,
    description: firstText(doc.description),
    year: parseYear(doc.year ?? doc.publishedAt),
    creator: firstText(doc.author_name),
    posterUrl,
    embedUrl,
    mediaUrl: null,
    source: "nfb",
    sourceLabel: "NFB.ca",
    sourceUrl,
    playback: "iframe",
    licenseLabel: "NFB official free-to-watch",
  };
}

async function fetchNfbClassics(
  fetchFn: typeof fetch,
  options: FreeClassicsRouteOptions,
): Promise<SourceResult> {
  const filmUrls = options.nfbFilmUrls ?? [...DEFAULT_NFB_FILMS];
  const results = await mapWithConcurrency(filmUrls, 6, async (filmUrl) => {
    try {
      const response = await fetchFn(buildNfbOembedUrl(filmUrl), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;
      const doc = await response.json() as Record<string, unknown>;
      return normalizeNfbOembedDoc(doc, filmUrl);
    } catch {
      return null;
    }
  });
  const items = results.filter((item): item is FreeClassic => Boolean(item));
  if (items.length === 0) throw new Error("NFB.ca did not return any official films");
  return { source: "nfb", items };
}

async function fetchArchiveCollection(fetchFn: typeof fetch, collection: ArchiveCollection): Promise<FreeClassic[]> {
  const response = await fetchFn(buildFreeClassicsSearchUrl(collection), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Internet Archive returned ${response.status}`);

  const payload = (await response.json()) as { response?: { docs?: unknown } };
  const docs = Array.isArray(payload?.response?.docs) ? payload.response.docs : [];
  const normalizedItems = docs
    .filter((doc): doc is ArchiveDoc => Boolean(doc && typeof doc === "object"))
    .map(normalizeFreeClassicDoc)
    .filter((item): item is FreeClassic => Boolean(item))
    .slice(0, ARCHIVE_ITEMS_PER_COLLECTION);
  return normalizedItems;
}

async function fetchArchiveClassics(fetchFn: typeof fetch): Promise<SourceResult> {
  const healthyCollections: FreeClassic[] = [];
  let healthyCollectionCount = 0;
  for (const collection of ARCHIVE_COLLECTIONS) {
    try {
      healthyCollections.push(...await fetchArchiveCollection(fetchFn, collection));
      healthyCollectionCount += 1;
    } catch {
      // Keep the other curated collections available when one request fails.
    }
  }
  if (healthyCollectionCount === 0) {
    throw new Error("All Internet Archive collection requests failed");
  }

  const normalizedItems = Array.from(
    healthyCollections.reduce((items, item) => {
      if (!items.has(item.identifier)) items.set(item.identifier, item);
      return items;
    }, new Map<string, FreeClassic>()).values(),
  ).slice(0, MAX_ITEMS_PER_SOURCE);
  const items = await mapWithConcurrency(normalizedItems, ARCHIVE_METADATA_CONCURRENCY, async (item) => {
    try {
      const metadataResponse = await fetchFn(buildArchiveMetadataUrl(item.identifier), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!metadataResponse.ok) return item;
      const metadata = await metadataResponse.json() as { files?: unknown };
      const mediaUrl = selectArchiveMediaUrl(item.identifier, metadata.files);
      return mediaUrl ? { ...item, mediaUrl, playback: "video" as const } : item;
    } catch {
      return item;
    }
  });
  return { source: "archive", items };
}

async function fetchWikimediaSearch(fetchFn: typeof fetch, search: string): Promise<FreeClassic[]> {
  const response = await fetchFn(buildWikimediaSearchUrl(search), {
    headers: {
      Accept: "application/json",
      "User-Agent": WIKIMEDIA_USER_AGENT,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Wikimedia Commons returned ${response.status}`);

  const payload = (await response.json()) as { query?: { pages?: unknown } };
  const pages = Array.isArray(payload.query?.pages)
    ? payload.query.pages
    : payload.query?.pages && typeof payload.query.pages === "object"
      ? Object.values(payload.query.pages)
      : [];
  const items = pages
    .filter((page): page is WikimediaPage => Boolean(page && typeof page === "object"))
    .map(normalizeWikimediaPage)
    .filter((item): item is FreeClassic => Boolean(item));
  return items;
}

async function fetchWikimediaClassics(fetchFn: typeof fetch): Promise<SourceResult> {
  const items: FreeClassic[] = [];
  let healthySearchCount = 0;
  for (const search of WIKIMEDIA_SEARCHES) {
    try {
      items.push(...await fetchWikimediaSearch(fetchFn, search));
      healthySearchCount += 1;
    } catch {
      // Keep the other curated legal searches available when one request fails.
    }
  }
  if (healthySearchCount === 0) {
    throw new Error("All Wikimedia Commons searches failed");
  }

  return {
    source: "wikimedia",
    items: Array.from(
      items.reduce((deduplicated, item) => {
        if (!deduplicated.has(item.identifier)) deduplicated.set(item.identifier, item);
        return deduplicated;
      }, new Map<string, FreeClassic>()).values(),
    ).slice(0, MAX_ITEMS_PER_SOURCE),
  };
}

async function fetchYoutubeClassics(
  fetchFn: typeof fetch,
  options: FreeClassicsRouteOptions,
): Promise<SourceResult | null> {
  const curatedItems = readCuratedYoutubeItems(options)
    .filter((item): item is YoutubeDoc => Boolean(item && typeof item === "object"))
    .filter((item) => Boolean(firstText(item.licenseLabel ?? item.legalLabel)))
    .map((item) => normalizeYoutubeDoc(item, firstText(item.licenseLabel ?? item.legalLabel) as string))
    .filter((item): item is FreeClassic => Boolean(item));
  if (curatedItems.length > 0) return { source: "youtube", items: curatedItems };

  const apiKey = getYoutubeApiKey(options);
  const channelIds = getYoutubeChannelIds(options);
  if (!apiKey || channelIds.length === 0) return null;

  const responses = await Promise.all(channelIds.map(async (channelId) => {
    const response = await fetchFn(buildYoutubeSearchUrl(channelId, apiKey), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
    return (await response.json()) as { items?: unknown };
  }));
  const items = responses
    .flatMap((payload) => (Array.isArray(payload.items) ? payload.items : []))
    .filter((item): item is YoutubeDoc => Boolean(item && typeof item === "object"))
    .map((item) => normalizeYoutubeDoc(item))
    .filter((item): item is FreeClassic => Boolean(item));
  return { source: "youtube", items };
}

async function fetchFreeClassics(
  fetchFn: typeof fetch,
  now: () => number,
  options: FreeClassicsRouteOptions,
): Promise<FreeClassicsCache> {
  const requests: Promise<SourceResult | null>[] = [];
  if (options.enableArchive !== false) requests.push(fetchArchiveClassics(fetchFn));
  if (options.enableWikimedia !== false) requests.push(fetchWikimediaClassics(fetchFn));
  if (options.enableYoutube !== false) requests.push(fetchYoutubeClassics(fetchFn, options));
  const enableNfb = options.enableNfb === true ||
    (options.enableNfb !== false && (options.nfbFilmUrls !== undefined || options.fetchFn === undefined));
  if (enableNfb) requests.push(fetchNfbClassics(fetchFn, options));

  const settled = await Promise.allSettled(requests);
  const healthyResults = settled
    .filter((result): result is PromiseFulfilledResult<SourceResult | null> => result.status === "fulfilled" && result.value !== null)
    .map((result) => result.value as SourceResult);
  if (healthyResults.length === 0) throw new Error("All Free Classics sources failed");

  return {
    items: uniqueItems(healthyResults.flatMap((result) => result.items)),
    fetchedAt: now(),
  };
}

export function createFreeClassicsRouter(options: FreeClassicsRouteOptions = {}): IRouter {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const cacheTtlMs = options.cacheTtlMs ?? FREE_CLASSICS_CACHE_TTL_MS;
  let cache: FreeClassicsCache | null = null;
  let refreshPromise: Promise<FreeClassicsCache> | null = null;

  const refreshCache = (): Promise<FreeClassicsCache> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = fetchFreeClassics(fetchFn, now, options)
      .then((nextCache) => {
        cache = nextCache;
        return nextCache;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };
  freeClassicsSitemapLoader = async () => (await refreshCache()).items;

  const router: IRouter = Router();
  router.get("/free-classics", async (req, res): Promise<void> => {
    try {
      const currentTime = now();
      if (!cache) {
        await refreshCache();
      } else if (currentTime - cache.fetchedAt > cacheTtlMs) {
        void refreshCache().catch((error) => {
          req.log?.warn({ err: error }, "Free Classics background refresh failed");
        });
      }

      if (!cache) throw new Error("Free Classics cache is unavailable");
      const source = firstText(req.query.source);
       const sourceFilter = source === "archive" || source === "youtube" || source === "wikimedia" || source === "nfb" ? source : null;
      const requestedPage = Number(req.query.page);
      const requestedLimit = Number(req.query.limit);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_ITEMS)
        : DEFAULT_PAGE_SIZE;
      const filteredItems = sourceFilter
        ? cache.items.filter((item) => item.source === sourceFilter)
        : cache.items;
      const totalResults = filteredItems.length;
      const totalPages = Math.max(1, Math.ceil(totalResults / limit));
      const items = filteredItems.slice((page - 1) * limit, page * limit);

      res.json(
        GetFreeClassicsResponse.parse({
          items,
          page,
          totalPages,
          totalResults,
          fetchedAt: new Date(cache.fetchedAt).toISOString(),
        }),
      );
    } catch (error) {
      req.log?.error({ err: error }, "Free Classics catalog unavailable");
      res.status(502).json({ error: "Free Classics catalog is unavailable" });
    }
  });
  router.get("/free-classics/:source/:identifier", async (req, res): Promise<void> => {
    try {
      if (!cache) await refreshCache();
      const source = firstText(req.params.source);
      const identifier = firstText(req.params.identifier);
      const validSource = source === "archive" || source === "youtube" || source === "wikimedia" || source === "nfb";
      if (!validSource || !identifier) {
        res.status(400).json({ error: "Invalid Free Classics item path" });
        return;
      }
      const item = cache?.items.find((candidate) => candidate.source === source && candidate.identifier === identifier);
      if (!item) {
        res.status(404).json({ error: "Free Classics item not found" });
        return;
      }
      res.json(item);
    } catch (error) {
      req.log?.error({ err: error }, "Free Classics item unavailable");
      res.status(502).json({ error: "Free Classics catalog is unavailable" });
    }
  });
  return router;
}

export default createFreeClassicsRouter();