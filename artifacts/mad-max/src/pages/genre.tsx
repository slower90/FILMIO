import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import gsap from "gsap";
import { Navbar } from "@/components/navbar";
import { MovieCard } from "@/components/movie-card";
import type { MovieSummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Film, Loader2 } from "lucide-react";

interface Genre {
  id: number;
  name: string;
}

interface GenrePageResult {
  results: {
    id: number;
    title: string;
    posterPath: string | null;
    releaseDate?: string;
    voteAverage?: number;
    overview?: string;
    genreIds?: number[];
    genre_ids?: number[];
  }[];
  page: number;
  totalPages: number;
  totalResults: number;
}

const GENRE_ICONS: Record<string, string> = {
  Action: "⚔️",
  Adventure: "🗺️",
  Animation: "🎨",
  Comedy: "😂",
  Crime: "🔫",
  Documentary: "📹",
  Drama: "🎭",
  Family: "👨‍👩‍👧",
  Fantasy: "🧙",
  History: "📜",
  Horror: "👻",
  Music: "🎵",
  Mystery: "🔍",
  Romance: "❤️",
  "Science Fiction": "🚀",
  Thriller: "😱",
  War: "🪖",
  Western: "🤠",
};

export default function GenrePage() {
  const params = useParams<{ id: string }>();
  const genreId = Number(params.id);

  const { data: genresData } = useQuery<{ genres: Genre[] }>({
    queryKey: ["all-genres"],
    queryFn: async () => {
      const res = await fetch("/api/movies/genres");
      if (!res.ok) throw new Error("Failed to fetch genres");
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  const genre = genresData?.genres.find((g) => g.id === genreId);
  const genreName = genre?.name ?? "";

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<GenrePageResult>({
    queryKey: ["genre-page", genreId],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(
        `/api/movies/by-genre?genreId=${genreId}&page=${pageParam}`,
      );
      if (!res.ok) throw new Error("Failed to fetch genre movies");
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < Math.min(last.totalPages, 20) ? last.page + 1 : undefined,
    enabled: Number.isFinite(genreId) && genreId > 0,
    staleTime: 10 * 60 * 1000,
  });

  // Strict client-side guard on top of TMDB's with_genres filter:
  // only keep movies whose genre id list actually contains this genre
  // (if the API result includes genre ids; otherwise trust the discover filter).
  const movies = (data?.pages ?? [])
    .flatMap((p) => p.results)
    .filter((m) => {
      const ids = m.genreIds ?? m.genre_ids;
      return !Array.isArray(ids) || ids.includes(genreId);
    });
  // De-dupe across pages and normalize to the shared MovieSummary shape
  const seen = new Set<number>();
  const uniqueMovies: MovieSummary[] = movies
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .map((m) => ({
      id: m.id,
      title: m.title,
      posterPath: m.posterPath ?? null,
      backdropPath: null,
      releaseDate: m.releaseDate ?? "",
      voteAverage: m.voteAverage ?? 0,
      voteCount: 0,
      overview: m.overview ?? "",
      genreIds: m.genreIds ?? m.genre_ids ?? [],
    }));

  const totalResults = data?.pages[0]?.totalResults ?? 0;

  // GSAP: stagger-in newly added cards. The counter is reset synchronously
  // when the genre changes (the grid is also keyed by genreId, so its DOM is
  // recreated fresh and stale cards can never be left at opacity 0).
  const gridRef = useRef<HTMLDivElement>(null);
  const animatedCount = useRef(0);
  const animatedGenre = useRef(genreId);
  if (animatedGenre.current !== genreId) {
    animatedGenre.current = genreId;
    animatedCount.current = 0;
  }
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.children).slice(animatedCount.current);
    if (cards.length === 0) return;
    animatedCount.current = grid.children.length;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: "power2.out" },
    );
    return () => {
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: "opacity,transform" });
    };
  }, [genreId, uniqueMovies.length]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-10 text-center px-4 border-b border-border/50">
        <div className="text-5xl mb-3">{GENRE_ICONS[genreName] || <Film className="w-12 h-12 text-primary mx-auto" />}</div>
        <h1 className="text-5xl md:text-6xl font-display font-bold uppercase tracking-tighter mb-3 text-glow">
          {genreName || "Genre"} Movies
        </h1>
        {totalResults > 0 && (
          <p className="text-muted-foreground text-lg">
            {totalResults.toLocaleString()} titles — only {genreName || "this genre"}, nothing else.
          </p>
        )}
      </section>

      <div className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-muted-foreground py-20">
            Couldn't load movies for this genre. Please try again.
          </p>
        ) : uniqueMovies.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">
            No movies found for this genre.
          </p>
        ) : (
          <>
            <div
              key={genreId}
              ref={gridRef}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              {uniqueMovies.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>

            {hasNextPage && (
              <div className="flex justify-center mt-12">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-2 font-display uppercase tracking-widest"
                >
                  {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
