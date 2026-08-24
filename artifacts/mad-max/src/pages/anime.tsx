import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { Link } from "wouter";
import { Search, ExternalLink, Star, Tv } from "lucide-react";

interface AnimeItem {
  id: number;
  title: string;
  posterPath: string | null;
  synopsis: string;
  score: number;
  releaseDate: string | null;
  episodes: number | null;
  status: string;
  type: string;
  genres: { id: number; name: string }[];
  trailerYoutubeId: string | null;
  malUrl: string | null;
}

function animeToRowMovie(a: AnimeItem): RowMovie {
  return {
    id: a.id,
    title: a.title,
    posterPath: a.posterPath, // full URL — posterUrl() handles this
    releaseDate: a.releaseDate ?? undefined,
  };
}

// Custom anime card for the detail view
function AnimeCard({ anime }: { anime: AnimeItem }) {
  return (
    <a
      href={anime.malUrl || `https://myanimelist.net/anime/${anime.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="flex-none w-32 md:w-36">
        <div className="aspect-[2/3] rounded overflow-hidden bg-muted relative">
          {anime.posterPath ? (
            <img
              src={anime.posterPath}
              alt={anime.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Tv className="w-8 h-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
        <p className="mt-2 text-xs font-display uppercase tracking-wide font-semibold line-clamp-1 group-hover:text-primary transition-colors leading-tight">
          {anime.title}
        </p>
        {anime.type && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{anime.type}</p>
        )}
      </div>
    </a>
  );
}

function AnimeRow({
  title,
  filter,
  type = "tv",
}: {
  title: string;
  filter: string;
  type?: string;
}) {
  const { data, isLoading, isError } = useQuery<{ results: AnimeItem[] }>({
    queryKey: ["anime-row", filter, type],
    queryFn: async () => {
      const res = await fetch(`/api/anime/top?filter=${filter}&type=${type}&limit=25`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to fetch anime");
      }
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const items = data?.results ?? [];

  return (
    <section className="py-10 border-b border-border/30">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-5">{title}</h2>
        {isError ? (
          <div className="py-6 px-4 border border-dashed border-border/50 rounded-md text-center text-muted-foreground text-sm">
            <Tv className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>MyAnimeList is temporarily unavailable. Check back soon.</p>
          </div>
        ) : (
          <div
            className="flex gap-3 overflow-x-auto scroll-smooth pb-3"
            style={{ scrollbarWidth: "none" }}
          >
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-none w-32 md:w-36">
                    <div className="aspect-[2/3] rounded bg-muted animate-pulse" />
                    <div className="mt-2 h-3 w-3/4 rounded bg-muted animate-pulse" />
                  </div>
                ))
              : items.length === 0
              ? (
                <p className="text-muted-foreground text-sm py-4">No results available right now.</p>
              )
              : items.map((anime) => <AnimeCard key={anime.id} anime={anime} />)}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Anime() {
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const { data: searchResults, isLoading: searching } = useQuery<{ results: AnimeItem[] }>({
    queryKey: ["anime-search", debouncedQ],
    queryFn: async () => {
      if (!debouncedQ.trim()) return { results: [] };
      const res = await fetch(`/api/anime/search?q=${encodeURIComponent(debouncedQ)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQ.trim().length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQ(e.target.value);
    clearTimeout((window as any).__animeSearchTimer);
    (window as any).__animeSearchTimer = setTimeout(() => setDebouncedQ(e.target.value), 400);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-10 text-center px-4 border-b border-border/50 bg-card/10">
        <div className="container mx-auto max-w-3xl">
          <p className="text-primary font-display uppercase tracking-widest text-sm mb-4">
            Powered by AniList
          </p>
          <h1 className="text-5xl md:text-7xl font-display font-bold uppercase tracking-tighter mb-4 text-glow">
            Anime
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Explore the best of anime — from classic shonen to modern masterpieces.
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search anime..."
              value={searchQ}
              onChange={handleSearch}
              className="w-full bg-card border border-border rounded-md pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Search results */}
      {(debouncedQ.trim().length > 1) && (
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-xl font-display font-bold uppercase tracking-wider mb-4 text-primary">
            Search Results for "{debouncedQ}"
          </h2>
          {searching ? (
            <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-none w-32">
                  <div className="aspect-[2/3] rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : searchResults?.results.length === 0 ? (
            <p className="text-muted-foreground">No results found.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
              {searchResults?.results.map((a) => <AnimeCard key={a.id} anime={a} />)}
            </div>
          )}
        </div>
      )}

      {/* Category rows */}
      <div className="bg-card/10">
        <AnimeRow title="🔥 Top Rated All Time" filter="bypopularity" type="tv" />
        <AnimeRow title="📺 Currently Airing" filter="airing" type="tv" />
        <AnimeRow title="🎬 Anime Movies" filter="bypopularity" type="movie" />
        <AnimeRow title="⭐ Fan Favourites" filter="favorite" type="tv" />
      </div>

      {/* MAL attribution */}
      <div className="container mx-auto px-4 py-8 text-center">
        <a
          href="https://myanimelist.net"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Data sourced from MyAnimeList via Jikan API
        </a>
      </div>
    </div>
  );
}
