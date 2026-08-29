import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { Clapperboard, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api-url";

async function fetchFreeMovies(): Promise<RowMovie[]> {
  const res = await apiFetch("/api/movies/free?maxPages=3");
  if (!res.ok) throw new Error("Unable to load free movies");
  const data = await res.json();
  return data.results ?? [];
}

export default function FreeMovies() {
  const { data: movies = [], isLoading, isError } = useQuery<RowMovie[]>({
    queryKey: ["free-movies-india"],
    queryFn: fetchFreeMovies,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <Navbar />
      <main className="pt-[4.5rem]">
        <section className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-background to-background px-4 py-14 md:py-20">
          <div className="container mx-auto max-w-5xl">
            <p className="cinema-kicker mb-4 flex items-center gap-2">
              <Clapperboard className="h-3.5 w-3.5" />
              Official OTT availability
            </p>
            <h1 className="max-w-3xl font-display text-4xl font-bold uppercase tracking-[0.04em] md:text-6xl">
              No-cost &amp; ad-supported movies on OTT
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Films currently listed as no-cost or ad-supported on official OTT platforms in India.
              Availability can change, so always confirm on the provider's official page.
            </p>
          </div>
        </section>

        {isError ? (
          <div className="container mx-auto px-4 py-16 text-center">
            <p className="text-muted-foreground">Free movie availability is temporarily unavailable.</p>
          </div>
        ) : movies.length > 0 || isLoading ? (
          <MovieRow
            title="No-cost / ad-supported on OTT · India"
            movies={movies}
            isLoading={isLoading}
            className="border-b border-border/30"
          />
        ) : (
          <div className="container mx-auto px-4 py-16 text-center">
            <p className="text-muted-foreground">No no-cost or ad-supported titles are listed right now.</p>
          </div>
        )}

        <div className="container mx-auto px-4 pt-10">
          <p className="mx-auto flex max-w-2xl items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            OTT availability is region-specific and may change.
            <ExternalLink className="h-3 w-3 shrink-0" />
          </p>
        </div>
      </main>
    </div>
  );
}