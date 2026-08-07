import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { ExternalLink, RefreshCw, Film, Tv, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  "Variety": "text-blue-400",
  "Hollywood Reporter": "text-red-400",
  "Anime News Network": "text-purple-400",
};

function ArticleCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 p-4 rounded-md border border-border bg-card/30 hover:bg-card hover:border-primary/50 transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="flex-none w-24 h-16 md:w-32 md:h-20 rounded overflow-hidden bg-muted">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.category === "anime" ? (
              <Tv className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Film className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("font-bold uppercase tracking-widest", SOURCE_COLORS[item.source] || "text-primary")}>
            {item.source}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(item.publishedAt)}
          </span>
        </div>

        <h3 className="font-display font-bold text-sm md:text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {item.excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
            {item.excerpt}
          </p>
        )}
      </div>

      <ExternalLink className="flex-none w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
    </a>
  );
}

export default function News() {
  const [category, setCategory] = useState<"all" | "film" | "anime">("all");

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<{
    items: NewsItem[];
    fetchedAt: string;
  }>({
    queryKey: ["news"],
    queryFn: async () => {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 30 * 60 * 1000, // 30 min client-side stale
    refetchInterval: 60 * 60 * 1000, // refetch every hour
  });

  const allItems = data?.items ?? [];
  const items =
    category === "all" ? allItems : allItems.filter((i) => i.category === category);

  const filmCount = allItems.filter((i) => i.category === "film").length;
  const animeCount = allItems.filter((i) => i.category === "anime").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-10 text-center px-4 border-b border-border/50">
        <h1 className="text-5xl md:text-7xl font-display font-bold uppercase tracking-tighter mb-3 text-glow">
          News
        </h1>
        <p className="text-muted-foreground text-lg">
          Film & anime news from Variety, Hollywood Reporter, and Anime Corner.
        </p>
        {data?.fetchedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Feed updated {timeAgo(data.fetchedAt)}
          </p>
        )}
      </section>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Filter tabs + refresh */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex gap-2">
            {(["all", "film", "anime"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-sm text-xs font-display uppercase tracking-widest border transition-colors",
                  category === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                )}
              >
                {cat === "all"
                  ? `All (${allItems.length})`
                  : cat === "film"
                  ? `Film (${filmCount})`
                  : `Anime (${animeCount})`}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Articles */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="font-display uppercase tracking-widest">No articles available.</p>
            <button
              onClick={() => refetch()}
              className="mt-4 text-primary hover:underline text-sm"
            >
              Try refreshing
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ArticleCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Source attribution */}
        <div className="mt-12 pt-8 border-t border-border text-center text-xs text-muted-foreground space-y-1">
          <p className="font-display uppercase tracking-widest mb-2">Sources</p>
          <div className="flex justify-center gap-6">
            <a href="https://variety.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Variety</a>
            <a href="https://www.hollywoodreporter.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Hollywood Reporter</a>
            <a href="https://www.animenewsnetwork.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Anime News Network</a>
          </div>
        </div>
      </div>
    </div>
  );
}
