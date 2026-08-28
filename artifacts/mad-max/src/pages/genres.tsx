import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { Film, ChevronRight } from "lucide-react";

interface Genre {
  id: number;
  name: string;
}

// Compact genre codes keep the browse view visual without relying on emoji glyphs.
const GENRE_CODES: Record<string, string> = {
  Action: "AC",
  Adventure: "AD",
  Animation: "AN",
  Comedy: "CO",
  Crime: "CR",
  Documentary: "DO",
  Drama: "DR",
  Family: "FA",
  Fantasy: "FN",
  History: "HI",
  Horror: "HO",
  Music: "MU",
  Mystery: "MY",
  Romance: "RO",
  "Science Fiction": "SF",
  Thriller: "TH",
  War: "WA",
  Western: "WE",
};

function GenreMoviesRow({ genre }: { genre: Genre }) {
  const [expanded, setExpanded] = useState(false);

  const { data: movies, isLoading } = useQuery<RowMovie[]>({
    queryKey: ["genre-browse", genre.id],
    queryFn: async () => {
      const res = await fetch(`/api/movies/by-genre?genreId=${genre.id}&maxPages=3`);
      if (!res.ok) return [];
      const d = await res.json();
      return d.results ?? [];
    },
    enabled: expanded,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="border border-border rounded-md bg-card/30 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-card/60 transition-colors group"
      >
        <div className="flex items-center gap-3">
           <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-primary/45 bg-primary/10 font-display text-[10px] font-bold tracking-[0.15em] text-primary">{GENRE_CODES[genre.name] || "GN"}</span>
          <span className="font-display font-bold uppercase tracking-wider text-lg group-hover:text-primary transition-colors">
            {genre.name}
          </span>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border/50">
          <MovieRow
            title=""
            movies={movies ?? []}
            isLoading={isLoading}
            className="py-6"
          />
          <div className="px-6 pb-4">
            <Link
              href={`/genre/${genre.id}`}
              className="text-xs font-display uppercase tracking-widest text-primary hover:underline"
            >
              View all {genre.name} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Genres() {
  // Legacy links used /genres?focus=<id> — redirect them to the dedicated genre page
  const search = useSearch();
  const [, setLocation] = useLocation();
  useEffect(() => {
    const focus = new URLSearchParams(search).get("focus");
    if (focus && Number(focus) > 0) {
      setLocation(`/genre/${focus}`, { replace: true });
    }
  }, [search, setLocation]);

  const { data: genresData, isLoading } = useQuery<{ genres: Genre[] }>({
    queryKey: ["all-genres"],
    queryFn: async () => {
      const res = await fetch("/api/movies/genres");
      if (!res.ok) throw new Error("Failed to fetch genres");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  const genres = genresData?.genres ?? [];

  // Featured genre rows (always visible)
  const FEATURED = [
    { id: 28, name: "Action" },
    { id: 35, name: "Comedy" },
    { id: 27, name: "Horror" },
    { id: 878, name: "Science Fiction" },
  ];

  const { data: featuredMovies } = useQuery<Record<number, RowMovie[]>>({
    queryKey: ["featured-genres"],
    queryFn: async () => {
      const results = await Promise.all(
        FEATURED.map(async (g) => {
          const res = await fetch(`/api/movies/by-genre?genreId=${g.id}&maxPages=2`);
          if (!res.ok) return [g.id, []];
          const d = await res.json();
          return [g.id, d.results ?? []];
        }),
      );
      return Object.fromEntries(results as [number, RowMovie[]][]);
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-10 text-center px-4 border-b border-border/50">
        <Film className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-5xl md:text-6xl font-display font-bold uppercase tracking-tighter mb-3 text-glow">
          Browse by Genre
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Dive into any category — from pulse-pounding action to intimate drama.
        </p>
      </section>

      {/* Featured genre rows */}
      <div className="border-b border-border/50 bg-card/10">
        {FEATURED.map((g) => (
          <MovieRow
            key={g.id}
               title={g.name}
            movies={featuredMovies?.[g.id] ?? []}
            isLoading={!featuredMovies}
            className="border-b border-border/30 last:border-b-0"
          />
        ))}
      </div>

      {/* All genres accordion */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-display font-bold uppercase tracking-wider mb-8">
          All Genres
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {genres.map((g) => (
              <GenreMoviesRow key={g.id} genre={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
