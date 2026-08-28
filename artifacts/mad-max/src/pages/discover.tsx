import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { HeroCarousel, type HeroMovie } from "@/components/hero-carousel";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { ArrowUpRight, Compass } from "lucide-react";

// Genre row IDs and names for logged-in users
const GENRE_ROWS = [
  { id: 28,   name: "Action" },
  { id: 18,   name: "Drama" },
  { id: 35,   name: "Comedy" },
  { id: 27,   name: "Horror" },
  { id: 878,  name: "Science Fiction" },
  { id: 16,   name: "Animation" },
  { id: 53,   name: "Thriller" },
  { id: 10749, name: "Romance" },
] as const;

async function fetchCategory(path: string, maxPages = 1): Promise<HeroMovie[]> {
  const res = await fetch(`/api/movies/${path}?maxPages=${maxPages}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.results ?? [];
}

async function fetchGenre(genreId: number): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/by-genre?genreId=${genreId}&maxPages=1`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.results ?? [];
}

function useNearViewport(ref: React.RefObject<Element | null>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return ready;
}

function GenreRow({ id, name }: { id: number; name: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const nearViewport = useNearViewport(rowRef);
  const { data, isLoading } = useQuery<RowMovie[]>({
    queryKey: ["discover-genre", id],
    queryFn: () => fetchGenre(id),
    enabled: nearViewport,
    staleTime: 10 * 60 * 1000,
  });
  return (
    <div ref={rowRef}>
      <MovieRow
        title={name}
        movies={data ?? []}
        isLoading={!nearViewport || isLoading}
        className="border-b border-border/30"
      />
    </div>
  );
}

export default function Discover() {
  const { user } = useUser();

  const { data: trending, isLoading: loadingTrending } = useQuery<HeroMovie[]>({
    queryKey: ["discover-trending"],
    queryFn: () => fetchCategory("trending", 1),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newReleases, isLoading: loadingNew } = useQuery<RowMovie[]>({
    queryKey: ["discover-new-releases"],
    queryFn: () => fetchCategory("new-releases", 1),
    staleTime: 5 * 60 * 1000,
  });

  const { data: popular, isLoading: loadingPopular } = useQuery<RowMovie[]>({
    queryKey: ["discover-popular"],
    queryFn: () => fetchCategory("popular", 1),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topRated, isLoading: loadingTopRated } = useQuery<RowMovie[]>({
    queryKey: ["discover-top-rated"],
    queryFn: () => fetchCategory("top-rated", 1),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <Navbar />

      <div className="pt-[4.5rem]">
        <HeroCarousel movies={trending ?? []} />
      </div>

      <div className="container mx-auto px-4 pt-10 pb-3">
        <div className="flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="cinema-kicker mb-3 flex items-center gap-2"><Compass className="h-3.5 w-3.5" /> Your daily shortlist</p>
            <h1 className="text-4xl font-display font-bold uppercase tracking-[0.04em] md:text-5xl">
              {user?.firstName ? `Welcome back, ${user.firstName}.` : "Find your next film."}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              A sharper cinema feed for the midnight crowd. New releases, enduring favorites, and the good kind of strange.
            </p>
          </div>
          <Link href="/genres" className="inline-flex min-h-11 items-center gap-2 self-start text-xs font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:text-foreground sm:self-auto">
            Browse genres <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Category rows */}
      <div className="mt-2 border-t border-border/50 bg-card/[0.08]">
        <MovieRow
          title="Trending this week"
          movies={trending ?? []}
          isLoading={loadingTrending}
          className="border-b border-border/30"
        />
        <MovieRow
          title="New in cinemas"
          movies={newReleases ?? []}
          isLoading={loadingNew}
          className="border-b border-border/30"
        />
        <MovieRow
          title="Popular right now"
          movies={popular ?? []}
          isLoading={loadingPopular}
          className="border-b border-border/30"
        />
        <MovieRow
          title="All-time classics"
          movies={topRated ?? []}
          isLoading={loadingTopRated}
          className="border-b border-border/30"
        />

        {/* Genre rows */}
        {GENRE_ROWS.map((g) => (
          <GenreRow key={g.id} id={g.id} name={g.name} />
        ))}
      </div>
    </div>
  );
}
