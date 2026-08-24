import { Router, type IRouter } from "express";
import Parser from "rss-parser";

const router: IRouter = Router();
const parser = new Parser({
  timeout: 12_000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (compatible; MAD-MAX-News/1.0; +https://madmax.replit.app)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

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
  {
    name: "Anime Corner",
    url: "https://animecorner.me/feed/",
    category: "anime" as const,
  },
];

function extractFirstImg(html: string): string | null {
  const m = html.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
  if (m?.[1]) return m[1];
  const srcset = html.match(/<img[^>]+srcset=["']([^"']+)["']/i);
  return srcset?.[1]?.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
}

function extractMediaUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = extractMediaUrl(entry);
      if (result) return result;
    }
    return null;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["url", "href", "_"]) {
      const result = extractMediaUrl(object[key]);
      if (result) return result;
    }
    for (const entry of Object.values(object)) {
      const result = extractMediaUrl(entry);
      if (result) return result;
    }
  }
  return null;
}

async function fetchArticleImage(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MAD-MAX-News/1.0)" },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 1_000_000);
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1]
          .replace(/&amp;/g, "&")
          .replace(/&#038;/g, "&")
          .replace(/&#x26;/gi, "&");
      }
    }
  } catch {
    // A feed item can still be shown without a photo if its article blocks scraping.
  }
  return null;
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
          extractMediaUrl(enclosure) ||
          extractMediaUrl(mediaContent) ||
          extractMediaUrl(mediaThumbnail) ||
          extractMediaUrl((item as any)["media:group"]) ||
          extractMediaUrl((item as any)["itunes:image"]) ||
          extractMediaUrl((item as any).image) ||
          extractFirstImg(String(contentEncoded)) ||
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
  const photoItems = await Promise.all(
    items.slice(0, 36).map(async (item) => ({
      ...item,
      thumbnail: item.thumbnail ?? await fetchArticleImage(item.url),
    })),
  );
  return [...photoItems, ...items.slice(36)];
};

let cache: { items: NewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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
