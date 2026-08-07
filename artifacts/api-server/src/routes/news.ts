import { Router, type IRouter } from "express";
import Parser from "rss-parser";

const router: IRouter = Router();
const parser = new Parser({ timeout: 12_000 });

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  category: "film" | "anime";
  publishedAt: string;
  thumbnail: string | null;
  excerpt: string;
}

const FEEDS = [
  { name: "Variety", url: "https://variety.com/feed/", category: "film" as const },
  {
    name: "Hollywood Reporter",
    url: "https://www.hollywoodreporter.com/feed/",
    category: "film" as const,
  },
  // ANN primary feed; fall back to alternate if this fails
  {
    name: "Anime News Network",
    url: "https://www.animenewsnetwork.com/all/rss.xml",
    category: "anime" as const,
  },
];

function extractFirstImg(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const fetchAllFeeds = async (): Promise<NewsItem[]> => {
  const settled = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.slice(0, 25).map((item): NewsItem => {
        const enclosure = (item as any).enclosure;
        const mediaContent = (item as any)["media:content"];
        const mediaThumbnail = (item as any)["media:thumbnail"];
        const contentEncoded = (item as any)["content:encoded"] || item.content || "";

        const thumbnail =
          enclosure?.url ||
          mediaContent?.$.url ||
          mediaThumbnail?.$.url ||
          extractFirstImg(contentEncoded) ||
          null;

        return {
          id: item.guid || item.link || `${feed.name}-${item.title}`,
          title: item.title || "",
          url: item.link || "",
          source: feed.name,
          category: feed.category,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          thumbnail,
          excerpt: stripHtml(item.contentSnippet || item.content || "").slice(0, 220),
        };
      });
    }),
  );

  const items: NewsItem[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") items.push(...r.value);
    else console.warn("[news] feed error:", r.reason?.message);
  }
  items.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  return items;
};

let cache: { items: NewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// GET /news?category=film|anime
router.get("/news", async (req, res): Promise<void> => {
  const category = req.query.category as "film" | "anime" | undefined;
  try {
    const now = Date.now();
    if (!cache || now - cache.fetchedAt > CACHE_TTL) {
      cache = { items: await fetchAllFeeds(), fetchedAt: now };
    }
    let items = cache.items;
    if (category) items = items.filter((i) => i.category === category);
    res.json({ items, fetchedAt: new Date(cache.fetchedAt).toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /news/refresh — force refresh the cache
router.post("/news/refresh", async (_req, res): Promise<void> => {
  try {
    cache = { items: await fetchAllFeeds(), fetchedAt: Date.now() };
    res.json({ ok: true, count: cache.items.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
