/**
 * Provider-agnostic catalog transport.
 *
 * TMDB remains the configured primary for FILMIO. A compatible secondary
 * source can be supplied with CATALOG_FALLBACK_BASE_URL; the adapter contract
 * deliberately mirrors the upstream JSON envelope so routes stay provider
 * independent. No provider is scraped and no credentials are logged.
 */

export type CatalogProvider = {
  name: string;
  baseUrl: string;
  buildUrl: (baseUrl: string, path: string, params: Record<string, string | number>) => string;
  headers?: Record<string, string>;
  /** Map a provider-specific envelope into the route's upstream-compatible shape. */
  mapResponse?: (path: string, params: Record<string, string | number>, data: any) => any;
  attribution?: string;
  quota?: string;
};

export type CatalogResponse<T = any> = {
  data: T;
  source: string;
  fetchedAt: string;
  stale: boolean;
};

export type CatalogMetadata = Pick<CatalogResponse, "source" | "fetchedAt" | "stale"> & {
  /** True when one or more requested pages or optional fields could not load. */
  partial?: boolean;
};

type CacheEntry = { data: any; expiresAt: number; fetchedAt: string; source: string };
type Circuit = { failures: number; openUntil: number };

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 60 * 60_000;
const MAX_CACHE_ENTRIES = 256;

const defaultBuildUrl = (
  baseUrl: string,
  path: string,
  params: Record<string, string | number>,
) => {
  // Catalog paths are conventionally written with a leading slash. Strip it
  // before resolving so a base URL with a path prefix (for example TMDB's
  // `/3`) is preserved instead of being replaced by the URL constructor.
  const url = new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.toString();
};

const isUsablePayload = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const toNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const mapOmdbSearchResult = (item: any, mediaType?: string) => ({
  id: item.imdbID ?? null,
  title: item.Title ?? "",
  poster_path: item.Poster && item.Poster !== "N/A" ? item.Poster : null,
  backdrop_path: null,
  overview: "",
  release_date: item.Year && item.Year !== "N/A" ? `${item.Year}-01-01` : "",
  vote_average: 0,
  genre_ids: [],
  media_type: mediaType === "series" ? "tv" : "movie",
});

/**
 * OMDb is an approved, terms-compliant metadata backup for movie and TV
 * search/detail responses. It intentionally does not pretend to provide
 * trailers, recommendations, or streaming availability.
 */
export const createOmdbProvider = (apiKey: string): CatalogProvider => ({
  name: "omdb",
  baseUrl: "https://www.omdbapi.com/",
  attribution: "OMDb API",
  quota: "OMDb plan quota applies; requests are limited by the server cache and transport circuit breaker.",
  buildUrl: (base, path, params) => {
    const url = new URL(base);
    url.searchParams.set("apikey", apiKey);
    const query = String(params.query ?? "");
    const isTv = path.startsWith("/search/tv") || path.startsWith("/tv/");
    if (path === "/search/movie" || path === "/search/tv" || path === "/search/multi") {
      url.searchParams.set("s", query);
      url.searchParams.set("page", String(params.page ?? 1));
      if (isTv) url.searchParams.set("type", "series");
      return url.toString();
    }
    const id = path.match(/^\/(?:movie|tv)\/([^/]+)$/)?.[1];
    if (id?.startsWith("tt")) {
      url.searchParams.set("i", id);
      url.searchParams.set("plot", "full");
      return url.toString();
    }
    throw new Error(`omdb does not support ${path} without an IMDb id`);
  },
  mapResponse: (path, _params, data) => {
    if (path === "/search/movie" || path === "/search/tv" || path === "/search/multi") {
      const mediaType = path === "/search/tv" ? "series" : undefined;
      const results = (data.Search ?? []).map((item: any) => mapOmdbSearchResult(item, mediaType));
      return { results, page: 1, total_pages: Math.max(1, Math.ceil(toNumber(data.totalResults) / 10)), total_results: toNumber(data.totalResults) };
    }
    if (data.Response === "False") return { success: false, error: data.Error ?? "Not found" };
    const isTv = data.Type === "series" || path.startsWith("/tv/");
    const genres = String(data.Genre ?? "").split(",").map((name) => name.trim()).filter(Boolean)
      .map((name, index) => ({ id: index + 1, name }));
    return {
      id: data.imdbID,
      title: data.Title ?? "",
      name: isTv ? data.Title ?? "" : undefined,
      overview: data.Plot === "N/A" ? "" : data.Plot ?? "",
      poster_path: data.Poster === "N/A" ? null : data.Poster ?? null,
      backdrop_path: null,
      release_date: data.Released === "N/A" ? "" : data.Released ?? "",
      first_air_date: isTv && data.Released !== "N/A" ? data.Released ?? "" : undefined,
      runtime: parseInt(String(data.Runtime ?? "").replace(/\D/g, ""), 10) || null,
      episode_run_time: [],
      genres,
      vote_average: toNumber(data.imdbRating),
      vote_count: toNumber(String(data.imdbVotes ?? "").replace(/,/g, "")),
      tagline: null,
      status: "",
      budget: 0,
      revenue: 0,
      imdb_id: data.imdbID ?? null,
      credits: { cast: [], crew: [] },
      videos: { results: [] },
      "watch/providers": { results: {} },
    };
  },
});

/** Adapter for an approved provider that follows the documented catalog
 * capability contract but uses camelCase or slightly different envelopes. */
export const createCompatibleProvider = (options: {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
  attribution?: string;
  quota?: string;
}): CatalogProvider => ({
  ...options,
  buildUrl: defaultBuildUrl,
  mapResponse: (_path, _params, input) => {
    // A compatible provider may use a camelCase JSON vocabulary while still
    // exposing the same TMDB endpoint paths. Normalize the nested resources
    // used by movie detail pages as well as collection results.
    const data = input?.data && isUsablePayload(input.data) ? { ...input.data, ...input } : input;
    if (!isUsablePayload(data)) return data;
    const results = Array.isArray(data.results) ? data.results : Array.isArray(data.items) ? data.items : undefined;
    if (results) {
      return {
        ...data,
        results: results.map((item: any) => ({
          ...item,
          id: item.id ?? item.imdbId ?? item.imdb_id,
          title: item.title ?? item.name ?? "",
          name: item.name ?? item.title ?? "",
          poster_path: item.poster_path ?? item.posterPath ?? item.poster ?? null,
          backdrop_path: item.backdrop_path ?? item.backdropPath ?? null,
          overview: item.overview ?? item.description ?? "",
          release_date: item.release_date ?? item.releaseDate ?? item.first_air_date ?? item.firstAirDate ?? "",
          first_air_date: item.first_air_date ?? item.firstAirDate ?? item.release_date ?? item.releaseDate ?? "",
          vote_average: item.vote_average ?? item.voteAverage ?? 0,
          genre_ids: item.genre_ids ?? item.genreIds ?? [],
        })),
        page: data.page ?? 1,
        total_pages: data.total_pages ?? data.totalPages ?? 1,
        total_results: data.total_results ?? data.totalResults ?? results.length,
      };
    }

    const normalized = { ...data };
    const videoContainer = normalized.videos ?? normalized.videoResults;
    if (isUsablePayload(videoContainer)) {
      const videoResults = Array.isArray(videoContainer.results)
        ? videoContainer.results
        : Array.isArray(videoContainer.items)
          ? videoContainer.items
          : [];
      normalized.videos = {
        ...videoContainer,
        results: videoResults.map((video: any) => ({
          ...video,
          id: video.id ?? video.videoId,
          key: video.key ?? video.youtubeKey ?? video.youtubeId,
          name: video.name ?? video.title ?? "",
          site: video.site ?? video.source ?? "",
          type: video.type ?? "",
          official: video.official ?? false,
        })),
      };
    }

    const providerContainer = normalized["watch/providers"] ?? normalized.watchProviders;
    if (isUsablePayload(providerContainer)) {
      const regions = isUsablePayload(providerContainer.results)
        ? providerContainer.results
        : isUsablePayload(providerContainer.regions)
          ? providerContainer.regions
          : {};
      normalized["watch/providers"] = {
        ...providerContainer,
        results: Object.fromEntries(
          Object.entries(regions).map(([region, regionData]) => [
            region,
            isUsablePayload(regionData)
              ? Object.fromEntries(
                  Object.entries(regionData).map(([kind, providers]) => [
                    kind,
                    Array.isArray(providers)
                      ? providers.map((provider: any) => ({
                          ...provider,
                          provider_id: provider.provider_id ?? provider.providerId,
                          provider_name: provider.provider_name ?? provider.providerName ?? "",
                          logo_path: provider.logo_path ?? provider.logoPath ?? "",
                        }))
                      : providers,
                  ]),
                )
              : regionData,
          ]),
        ),
      };
    }

    if (normalized.item && typeof normalized.item === "object") return { ...normalized.item, ...normalized };
    return normalized;
  },
});

export function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function catalogIdentity(item: Record<string, any>): string | number | null {
  if (item.id != null) return item.id;
  const title = normalizeTitle(String(item.title ?? item.name ?? ""));
  if (!title) return null;
  const date = String(item.releaseDate ?? item.release_date ?? item.first_air_date ?? "").slice(0, 4);
  return `${title}:${date}`;
}

export function mergeCatalogItems<T extends Record<string, any>>(
  groups: T[][],
  identity: (item: T) => string | number | null | undefined,
): T[] {
  const output: T[] = [];
  const byIdentity = new Map<string, T>();
  for (const group of groups) {
    for (const item of group) {
      const id = identity(item);
      if (id == null) {
        output.push(item);
        continue;
      }
      const key = String(id);
      const current = byIdentity.get(key);
      if (!current) {
        byIdentity.set(key, item);
        output.push(item);
        continue;
      }
      // Earlier providers have authority, but a missing field may be filled
      // from a later source. Never replace a real value with a placeholder.
      const target = current as Record<string, any>;
      for (const [field, value] of Object.entries(item)) {
        if (target[field] == null || target[field] === "" || target[field] === 0) {
          if (value != null && value !== "" && value !== 0) target[field] = value;
        }
      }
    }
  }
  return output;
}

export class CatalogClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<CatalogResponse>>();
  private readonly circuits = new Map<string, Circuit>();
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly providers: CatalogProvider[];

  constructor(options: {
    providers: CatalogProvider[];
    timeoutMs?: number;
    ttlMs?: number;
  }) {
    this.providers = options.providers;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  async fetch<T = any>(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    const key = JSON.stringify([path, params]);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data as T;
    const existing = this.inFlight.get(key);
    if (existing) return (await existing).data as T;

    const request = this.fetchFromProviders<T>(key, path, params);
    this.inFlight.set(key, request);
    try {
      return (await request).data;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Fetch data while retaining the source/freshness information for API clients. */
  async fetchWithMetadata<T = any>(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<CatalogResponse<T>> {
    const key = JSON.stringify([path, params]);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { data: cached.data as T, source: cached.source, fetchedAt: cached.fetchedAt, stale: false };
    }
    const existing = this.inFlight.get(key);
    if (existing) return (await existing) as CatalogResponse<T>;
    const request = this.fetchFromProviders<T>(key, path, params);
    this.inFlight.set(key, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async fetchFromProviders<T>(
    key: string,
    path: string,
    params: Record<string, string | number>,
  ): Promise<CatalogResponse<T>> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      const circuit = this.circuits.get(provider.name);
      if (circuit && circuit.openUntil > Date.now()) {
        errors.push(`${provider.name}: circuit open`);
        continue;
      }
      try {
        const rawData = await this.requestProvider<T>(provider, path, params);
        const data = (provider.mapResponse ? provider.mapResponse(path, params, rawData) : rawData) as T;
        this.circuits.delete(provider.name);
        if (!isUsablePayload(data)) throw new Error("malformed response");
        if (Array.isArray((data as any).results) && (data as any).results.length === 0) {
          throw new Error("empty response");
        }
        const result = {
          data,
          source: provider.name,
          fetchedAt: new Date().toISOString(),
        stale: false,
        };
        this.cache.set(key, {
          data,
          fetchedAt: result.fetchedAt,
          expiresAt: Date.now() + this.ttlMs,
          source: result.source,
        });
        this.trimCache();
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.name}: ${message}`);
        this.recordFailure(provider.name);
      }
    }

    const stale = this.cache.get(key);
    if (stale && stale.expiresAt + STALE_TTL_MS > Date.now()) {
      return {
        data: stale.data as T,
        source: "cache",
        fetchedAt: stale.fetchedAt,
        stale: true,
      };
    }
    throw new Error(`All catalog providers failed for ${path}: ${errors.join("; ")}`);
  }

  private async requestProvider<T>(
    provider: CatalogProvider,
    path: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(provider.buildUrl(provider.baseUrl, path, params), {
          headers: provider.headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const error = new Error(`${response.status}: ${body.slice(0, 160)}`);
          if (response.status !== 429 && response.status < 500) throw error;
          throw error;
        }
        const data = await response.json();
        if (!isUsablePayload(data)) throw new Error("malformed response");
        return data as T;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private recordFailure(name: string) {
    const current = this.circuits.get(name) ?? { failures: 0, openUntil: 0 };
    current.failures += 1;
    if (current.failures >= 3) current.openUntil = Date.now() + 30_000;
    this.circuits.set(name, current);
  }

  private trimCache() {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
      else break;
    }
  }
}

export const createCatalogClient = (primary: CatalogProvider, fallback?: CatalogProvider) =>
  new CatalogClient({ providers: [primary, ...(fallback ? [fallback] : [])] });

export { defaultBuildUrl };