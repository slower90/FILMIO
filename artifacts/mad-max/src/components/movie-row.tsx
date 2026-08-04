import { useRef } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface RowMovie {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  voteAverage?: number | null;
}

interface MovieRowProps {
  title: string;
  movies: RowMovie[];
  isLoading?: boolean;
  className?: string;
}

const SKELETON_COUNT = 12;

export function MovieRow({ title, movies, isLoading, className }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: direction === "right" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <section className={cn("py-10", className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-display font-bold uppercase tracking-wider">{title}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => scroll("left")}
              className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center hover:bg-accent hover:border-primary transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center hover:bg-accent hover:border-primary transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scroll track */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth pb-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="flex-none w-32 md:w-36"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="aspect-[2/3] rounded bg-muted animate-pulse" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="mt-1 h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              ))
            : movies.map((movie) => {
                const year = movie.releaseDate
                  ? new Date(movie.releaseDate).getFullYear()
                  : null;
                return (
                  <Link key={movie.id} href={`/movies/${movie.id}`}>
                    <div className="flex-none w-32 md:w-36 group cursor-pointer">
                      <div className="aspect-[2/3] rounded overflow-hidden bg-muted relative">
                        <img
                          src={tmdbPosterUrl(movie.posterPath)}
                          alt={movie.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Rating badge */}
                        {movie.voteAverage && movie.voteAverage > 0 ? (
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
                            <Star className="w-2.5 h-2.5 fill-primary text-primary" />
                            <span className="text-[10px] font-bold text-white leading-none">
                              {movie.voteAverage.toFixed(1)}
                            </span>
                          </div>
                        ) : null}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                      <p className="mt-2 text-xs font-display uppercase tracking-wide font-semibold line-clamp-1 group-hover:text-primary transition-colors leading-tight">
                        {movie.title}
                      </p>
                      {year && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{year}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
