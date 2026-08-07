import { Router, type IRouter } from "express";
import { db, animeCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Cache TTLs ────────────────────────────────────────────────────────────────
const MEM_TTL  = 10  * 60 * 1000;  // 10 min  — in-memory hot cache
const LIST_TTL = 24  * 60 * 60 * 1000; // 24 h   — DB cache for list pages
const DETAIL_TTL = 7 * 24 * 60 * 60 * 1000; // 7 d — DB cache for detail pages

const memCache = new Map<string, { data: any; ts: number }>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Normalised shape returned to the frontend ─────────────────────────────────
interface NormalizedAnime {
  id: number;
  anilistId: number | null;
  malId: number | null;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  synopsis: string;
  score: number;
  voteAverage: number;
  releaseDate: string | null;
  episodes: number | null;
  status: string;
  type: string;
  genres: { id: number; name: string }[];
  trailerYoutubeId: string | null;
  malUrl: string | null;
  anilistUrl: string | null;
}

// ── DB + memory two-layer cache ───────────────────────────────────────────────
async function getCache(key: string): Promise<any | null> {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.ts < MEM_TTL) return mem.data;

  try {
    const rows = await db
      .select()
      .from(animeCacheTable)
      .where(eq(animeCacheTable.cacheKey, key))
      .limit(1);
    if (rows.length) {
      const age = Date.now() - new Date(rows[0].cachedAt).getTime();
      const ttl = key.startsWith("detail:") ? DETAIL_TTL : LIST_TTL;
      if (age < ttl) {
        memCache.set(key, { data: rows[0].data, ts: Date.now() });
        return rows[0].data;
      }
    }
  } catch (e) {
    console.warn("[anime] DB cache read error:", (e as Error).message);
  }
  return null;
}

async function setCache(key: string, data: any, source: "anilist" | "jikan"): Promise<void> {
  memCache.set(key, { data, ts: Date.now() });
  try {
    await db
      .insert(animeCacheTable)
      .values({ cacheKey: key, data, source, cachedAt: new Date() })
      .onConflictDoUpdate({
        target: animeCacheTable.cacheKey,
        set: { data, source, cachedAt: new Date() },
      });
  } catch (e) {
    console.warn("[anime] DB cache write error:", (e as Error).message);
  }
}

// ── AniList (primary) ─────────────────────────────────────────────────────────
const ANILIST_URL = "https://graphql.anilist.co";

const ANIME_FIELDS = `
  id idMal siteUrl
  title { english romaji native }
  coverImage { extraLarge large medium }
  bannerImage
  description(asHtml: false)
  averageScore
  startDate { year month day }
  episodes
  status
  format
  genres
  trailer { site id }
`;

const PAGE_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $format: MediaFormat) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage }
      media(type: ANIME, sort: $sort, status: $status, format: $format, isAdult: false) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, search: $search, isAdult: false, sort: [SEARCH_MATCH]) {
        ${ANIME_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${ANIME_FIELDS}
      duration
      studios(isMain: true) { nodes { name } }
      staff(perPage: 5, sort: [RELEVANCE]) { nodes { name { full } primaryOccupations } }
    }
  }
`;

// Map route filter → AniList sort + status variables
const filterToVars = (filter: string): { sort: string[]; status?: string } => {
  switch (filter) {
    case "airing":   return { sort: ["TRENDING_DESC"], status: "RELEASING" };
    case "upcoming": return { sort: ["POPULARITY_DESC"], status: "NOT_YET_RELEASED" };
    case "favorite": return { sort: ["FAVOURITES_DESC"] };
    case "score":    return { sort: ["SCORE_DESC"] };
    default:         return { sort: ["POPULARITY_DESC"] }; // bypopularity
  }
};

async function anilistFetch(query: string, variables: Record<string, any>): Promise<any> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AniList HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`AniList error: ${json.errors[0].message}`);
  }
  return json.data;
}

const mapAnilist = (m: any): NormalizedAnime => ({
  id: m.id,
  anilistId: m.id,
  malId: m.idMal ?? null,
  title: m.title?.english || m.title?.romaji || m.title?.native || "Unknown",
  posterPath: m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || null,
  backdropPath: m.bannerImage || null,
  synopsis: m.description || "",
  score: m.averageScore ? +(m.averageScore / 10).toFixed(1) : 0,
  voteAverage: m.averageScore ? +(m.averageScore / 10).toFixed(1) : 0,
  releaseDate: m.startDate?.year
    ? `${m.startDate.year}-${String(m.startDate.month ?? 1).padStart(2, "0")}-${String(m.startDate.day ?? 1).padStart(2, "0")}`
    : null,
  episodes: m.episodes ?? null,
  status: m.status ?? "",
  type: m.format ?? "TV",
  genres: (m.genres ?? []).map((name: string, i: number) => ({ id: i + 1, name })),
  trailerYoutubeId: m.trailer?.site === "youtube" ? m.trailer.id : null,
  malUrl: m.idMal ? `https://myanimelist.net/anime/${m.idMal}` : null,
  anilistUrl: m.siteUrl ?? null,
});

// ── Jikan (fallback) ──────────────────────────────────────────────────────────
const JIKAN_BASE = "https://api.jikan.moe/v4";
let lastJikanTs = 0;

async function jikanFetch(
  path: string,
  params: Record<string, string | number> = {},
  retries = 2,
): Promise<any> {
  const url = new URL(`${JIKAN_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const wait = Math.max(0, lastJikanTs + 420 - Date.now());
  if (wait > 0) await sleep(wait);
  lastJikanTs = Date.now();
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (res.status === 429) {
    if (retries > 0) { await sleep(1500); return jikanFetch(path, params, retries - 1); }
    throw new Error("Jikan rate limit exceeded");
  }
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${path}`);
  return res.json();
}

const mapJikan = (a: any): NormalizedAnime => ({
  id: a.mal_id,
  anilistId: null,
  malId: a.mal_id,
  title: a.title_english || a.title || "Unknown",
  posterPath: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
  backdropPath: null,
  synopsis: a.synopsis || "",
  score: a.score ?? 0,
  voteAverage: a.score ?? 0,
  releaseDate: a.year ? `${a.year}-01-01` : null,
  episodes: a.episodes ?? null,
  status: a.status ?? "",
  type: a.type ?? "TV",
  genres: (a.genres ?? []).map((g: any) => ({ id: g.mal_id, name: g.name })),
  trailerYoutubeId: a.trailer?.youtube_id ?? null,
  malUrl: a.url ?? null,
  anilistUrl: null,
});

// ── Route helpers ─────────────────────────────────────────────────────────────
interface ListResult {
  results: NormalizedAnime[];
  totalResults: number;
  currentPage: number;
  lastPage: number;
  source: string;
}

async function fetchTopList(filter: string, type: string, page: number): Promise<ListResult> {
  const vars = filterToVars(filter);
  const format = type === "movie" ? "MOVIE" : undefined;

  // 1 — try AniList
  try {
    const data = await anilistFetch(PAGE_QUERY, {
      page,
      perPage: 25,
      sort: vars.sort,
      ...(vars.status && { status: vars.status }),
      ...(format && { format }),
    });
    const page_ = data.Page;
    return {
      results: (page_.media ?? []).map(mapAnilist),
      totalResults: page_.pageInfo?.total ?? 0,
      currentPage: page_.pageInfo?.currentPage ?? page,
      lastPage: page_.pageInfo?.lastPage ?? 1,
      source: "anilist",
    };
  } catch (err) {
    console.warn("[anime] AniList failed, trying Jikan:", (err as Error).message);
  }

  // 2 — Jikan fallback
  const jikanFilter = filter === "score" ? "bypopularity" : filter;
  const data = await jikanFetch("/top/anime", {
    type: type === "movie" ? "movie" : "tv",
    filter: jikanFilter,
    page,
    limit: 25,
  });
  return {
    results: (data.data ?? []).map(mapJikan),
    totalResults: data.pagination?.items?.total ?? 0,
    currentPage: data.pagination?.current_page ?? page,
    lastPage: data.pagination?.last_visible_page ?? 1,
    source: "jikan",
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /anime/top?filter=bypopularity|airing|upcoming|favorite|score&type=tv|movie&page=1
router.get("/anime/top", async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)   || 1);
  const type   = (req.query.type   as string) || "tv";
  const filter = (req.query.filter as string) || "bypopularity";
  const key    = `top:${filter}:${type}:${page}`;

  try {
    // 1 — DB / memory cache
    const cached = await getCache(key);
    if (cached) { res.json({ ...cached, cached: true }); return; }

    // 2 — Live fetch (AniList → Jikan)
    const result = await fetchTopList(filter, type, page);
    await setCache(key, result, result.source as "anilist" | "jikan");
    res.json(result);
  } catch (e: any) {
    console.error("[anime] top error:", e.message);
    // 3 — Serve stale DB cache rather than a 500
    try {
      const rows = await db.select().from(animeCacheTable)
        .where(eq(animeCacheTable.cacheKey, key)).limit(1);
      if (rows.length) { res.json({ ...(rows[0].data as object), stale: true }); return; }
    } catch {}
    res.status(500).json({ error: e.message });
  }
});

// GET /anime/search?q=
router.get("/anime/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string)?.trim();
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const page = Math.max(1, Number(req.query.page) || 1);
  const key  = `search:${q.toLowerCase()}:${page}`;

  try {
    const cached = await getCache(key);
    if (cached) { res.json({ ...cached, cached: true }); return; }

    let results: NormalizedAnime[];
    let source: "anilist" | "jikan" = "anilist";
    try {
      const data = await anilistFetch(SEARCH_QUERY, { search: q, page, perPage: 25 });
      results = (data.Page?.media ?? []).map(mapAnilist);
    } catch (err) {
      console.warn("[anime] AniList search failed, trying Jikan:", (err as Error).message);
      const data = await jikanFetch("/anime", { q, limit: 25 });
      results = (data.data ?? []).map(mapJikan);
      source = "jikan";
    }

    const result = { results, source };
    await setCache(key, result, source);
    res.json(result);
  } catch (e: any) {
    console.error("[anime] search error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /anime/:id  — AniList ID
router.get("/anime/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid anime id" }); return; }

  const key = `detail:${id}`;

  try {
    const cached = await getCache(key);
    if (cached) { res.json({ ...cached, cached: true }); return; }

    let result: NormalizedAnime;
    let source: "anilist" | "jikan" = "anilist";
    try {
      const data = await anilistFetch(DETAIL_QUERY, { id });
      result = mapAnilist(data.Media);
    } catch (err) {
      console.warn("[anime] AniList detail failed, trying Jikan:", (err as Error).message);
      const data = await jikanFetch(`/anime/${id}/full`);
      result = mapJikan(data.data);
      source = "jikan";
    }

    await setCache(key, result, source);
    res.json(result);
  } catch (e: any) {
    console.error("[anime] detail error:", e.message);
    try {
      const rows = await db.select().from(animeCacheTable)
        .where(eq(animeCacheTable.cacheKey, key)).limit(1);
      if (rows.length) { res.json({ ...(rows[0].data as object), stale: true }); return; }
    } catch {}
    res.status(500).json({ error: e.message });
  }
});

export default router;
