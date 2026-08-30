import { Router, type IRouter } from "express";
import { GetFreeClassicsResponse } from "@workspace/api-zod";

const INTERNET_ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php";
const INTERNET_ARCHIVE_QUERY = "mediatype:movies AND collection:feature_films";
export const FREE_CLASSICS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ITEMS = 50;

type ArchiveDoc = Record<string, unknown>;
type FreeClassic = {
  identifier: string;
  title: string;
  description: string | null;
  year: number | null;
  creator: string | null;
  posterUrl: string;
  embedUrl: string;
};

type FreeClassicsCache = {
  items: FreeClassic[];
  fetchedAt: number;
};

type FreeClassicsRouteOptions = {
  fetchFn?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
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
  };
}

export function buildFreeClassicsSearchUrl(): string {
  const url = new URL(INTERNET_ARCHIVE_SEARCH_URL);
  url.searchParams.set("q", INTERNET_ARCHIVE_QUERY);
  url.searchParams.append("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "description");
  url.searchParams.append("fl[]", "year");
  url.searchParams.append("fl[]", "creator");
  url.searchParams.set("rows", String(MAX_ITEMS));
  url.searchParams.set("page", "1");
  url.searchParams.set("output", "json");
  return url.toString();
}

async function fetchFreeClassics(
  fetchFn: typeof fetch,
  now: () => number,
): Promise<FreeClassicsCache> {
  const response = await fetchFn(buildFreeClassicsSearchUrl(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Internet Archive returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    response?: { docs?: unknown };
  };
  const docs = Array.isArray(payload?.response?.docs) ? payload.response.docs : [];
  const seen = new Set<string>();
  const items: FreeClassic[] = [];
  for (const doc of docs) {
    if (!doc || typeof doc !== "object") continue;
    const item = normalizeFreeClassicDoc(doc as ArchiveDoc);
    if (!item || seen.has(item.identifier)) continue;
    seen.add(item.identifier);
    items.push(item);
  }

  return { items, fetchedAt: now() };
}

export function createFreeClassicsRouter(options: FreeClassicsRouteOptions = {}): IRouter {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const cacheTtlMs = options.cacheTtlMs ?? FREE_CLASSICS_CACHE_TTL_MS;
  let cache: FreeClassicsCache | null = null;
  let refreshPromise: Promise<FreeClassicsCache> | null = null;

  const refreshCache = (): Promise<FreeClassicsCache> => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = fetchFreeClassics(fetchFn, now)
      .then((nextCache) => {
        cache = nextCache;
        return nextCache;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

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
      res.json(
        GetFreeClassicsResponse.parse({
          items: cache.items,
          fetchedAt: new Date(cache.fetchedAt).toISOString(),
        }),
      );
    } catch (error) {
      req.log?.error({ err: error }, "Free Classics catalog unavailable");
      res.status(502).json({ error: "Free Classics catalog is unavailable" });
    }
  });
  return router;
}

export default createFreeClassicsRouter();