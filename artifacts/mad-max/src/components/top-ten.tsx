import { useState } from "react";
import { Link } from "wouter";
import { withMovieTitle } from "@/lib/movie-links";
import { ChevronDown, ChevronUp, Star, Trophy } from "lucide-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { LazyBlurImage } from "@/components/lazy-blur-image";
import type { RowMovie } from "@/components/movie-row";
import { useQuery } from "@tanstack/react-query";
import { fetchPrismRatings, getPrismDisplayRating } from "@/lib/mad-max-ratings";

interface TopTenProps {
  movies: RowMovie[];
  isLoading?: boolean;
}

function TopTenSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 rounded-xl bg-card/70 animate-pulse" />
      ))}
    </div>
  );
}

export function TopTen({ movies, isLoading }: TopTenProps) {
  const [expanded, setExpanded] = useState(false);
  const rankedMovies = movies.slice(0, 10);
  const visibleMovies = expanded ? rankedMovies : rankedMovies.slice(0, 4);
  const { data: prismRatings } = useQuery({
    queryKey: ["mad-max-top-ten-ratings", rankedMovies.map((movie) => movie.id)],
    queryFn: () => fetchPrismRatings(rankedMovies.map((movie) => movie.id)),
    enabled: rankedMovies.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="border-y border-border/30 bg-gradient-to-br from-card/80 via-background to-primary/[0.04] py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <Trophy className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">
                The FILMIO list
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wider">
              Top 10 in FILMIO
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              The movies everyone is watching right now.
            </p>
          </div>
          <span className="hidden sm:block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Updated weekly
          </span>
        </div>

        {isLoading ? (
          <TopTenSkeleton />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
            {visibleMovies.map((movie, index) => {
              const rank = rankedMovies.indexOf(movie) + 1;
              const year = movie.releaseDate
                ? new Date(movie.releaseDate).getFullYear()
                : null;
              return (
                <Link key={movie.id} href={withMovieTitle(`/movies/${movie.id}`, movie.title)}>
                  <article className="group relative flex items-center gap-4 min-h-24 rounded-xl border border-border/60 bg-card/70 p-3 overflow-hidden transition-all duration-300 hover:border-primary/70 hover:bg-card hover:-translate-y-0.5">
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-center" />
                    <span className="w-10 shrink-0 text-center text-4xl font-display font-bold italic text-muted-foreground/35 group-hover:text-primary/70 transition-colors">
                      {String(rank).padStart(2, "0")}
                    </span>
                    <LazyBlurImage
                      src={tmdbPosterUrl(movie.posterPath, "w185")}
                      placeholderSrc={tmdbPosterUrl(movie.posterPath, "w92")}
                      alt={movie.title}
                      width={185}
                      height={278}
                      className="shadow-lg"
                      wrapperClassName="h-[72px] w-12 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display uppercase tracking-wide font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                        {movie.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {year && <span>{year}</span>}
                        <span className="inline-flex items-center gap-1 text-primary font-semibold">
                          <Star className="w-3 h-3 fill-primary" />
                          FILMIO {getPrismDisplayRating(movie.voteAverage, prismRatings?.[String(movie.id)]).toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <span className="text-primary/0 group-hover:text-primary transition-colors text-lg pr-1">
                      →
                    </span>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {rankedMovies.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mx-auto mt-7 flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-primary-foreground"
          >
            {expanded ? "Show less" : "Show all 10"}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
    </section>
  );
}