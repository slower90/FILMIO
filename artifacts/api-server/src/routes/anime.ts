import { Router, type IRouter } from "express";

const router: IRouter = Router();
const JIKAN_BASE = "https://api.jikan.moe/v4";

// ── In-memory cache (10 min TTL) ─────────────────────────────────────────────
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// ── Rate limiter — Jikan allows 3 req/sec; we hold to 1 req/400ms ────────────
let lastJikanTs = 0;
const JIKAN_INTERVAL_MS = 420;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const jikanFetch = async (
  path: string,
  params: Record<string, string | number> = {},
  retries = 3,
): Promise<any> => {
  const url = new URL(`${JIKAN_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const key = url.toString();

  // Cache hit
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  // Rate-limit: wait if last request was too recent
  const wait = Math.max(0, lastJikanTs + JIKAN_INTERVAL_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastJikanTs = Date.now();

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  // Jikan 429 — back off and retry
  if (res.status === 429) {
    if (retries > 0) {
      await sleep(1500);
      return jikanFetch(path, params, retries - 1);
    }
    throw new Error(`Jikan rate limit exceeded: ${path}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jikan ${res.status}: ${path} — ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  cache.set(key, { data, ts: Date.now() });
  return data;
};

const mapAnime = (a: any) => ({
  id: a.mal_id as number,
  title: ((a.title_english || a.title) as string) || "Unknown",
  // Full URL — posterUrl() helper on frontend handles full URLs vs TMDB paths
  posterPath: (a.images?.jpg?.large_image_url ||
    a.images?.jpg?.image_url ||
    null) as string | null,
  backdropPath: null as null,
  synopsis: (a.synopsis || "") as string,
  score: (a.score || 0) as number,
  voteAverage: (a.score || 0) as number,
  releaseDate: a.year ? `${a.year}-01-01` : (null as string | null),
  episodes: (a.episodes || null) as number | null,
  status: (a.status || "") as string,
  type: (a.type || "TV") as string,
  genres: ((a.genres || []) as any[]).map((g: any) => ({
    id: g.mal_id as number,
    name: g.name as string,
  })),
  trailerYoutubeId: (a.trailer?.youtube_id || null) as string | null,
  malUrl: (a.url || null) as string | null,
});

// GET /anime/top?filter=airing|upcoming|bypopularity|favorite&type=tv|movie&page=1
router.get("/anime/top", async (req, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const type = (req.query.type as string) || "tv";
  const filter = (req.query.filter as string) || "bypopularity";
  try {
    const data = await jikanFetch("/top/anime", { type, filter, page, limit: 25 });
    res.json({
      results: (data.data || []).map(mapAnime),
      totalResults: data.pagination?.items?.total || 0,
      currentPage: data.pagination?.current_page || 1,
      lastPage: data.pagination?.last_visible_page || 1,
    });
  } catch (e: any) {
    console.error("[anime] top error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /anime/search?q=
router.get("/anime/search", async (req, res): Promise<void> => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  try {
    const data = await jikanFetch("/anime", { q, limit: 25 });
    res.json({ results: (data.data || []).map(mapAnime) });
  } catch (e: any) {
    console.error("[anime] search error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /anime/:id
router.get("/anime/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid anime id" });
    return;
  }
  try {
    const data = await jikanFetch(`/anime/${id}/full`);
    res.json(mapAnime(data.data));
  } catch (e: any) {
    console.error("[anime] detail error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
