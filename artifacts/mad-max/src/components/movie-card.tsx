import { Link } from "wouter";
import { type MovieSummary } from "@workspace/api-client-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchPrismRatings, getPrismDisplayRating } from "@/lib/mad-max-ratings";
import { withMovieTitle } from "@/lib/movie-links";

interface MovieCardProps {
  movie: Pick<MovieSummary, "id" | "title" | "posterPath" | "releaseDate" | "overview" | "voteAverage">;
  showDescription?: boolean;
}

export function MovieCard({ movie, showDescription = false }: MovieCardProps) {
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "";
  const { data: ratings } = useQuery({
    queryKey: ["mad-max-rating", movie.id],
    queryFn: () => fetchPrismRatings([movie.id]),
    staleTime: 5 * 60 * 1000,
  });
  const rating = ratings?.[String(movie.id)];
  const displayRating = getPrismDisplayRating(movie.voteAverage, rating);

  return (
    <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)}>
      <div className="group relative h-full cursor-pointer overflow-hidden rounded-md border border-border bg-card flex flex-col transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_16px_28px_-20px_hsl(var(--primary)/0.7)] focus-within:border-primary/60">
        <div className="aspect-[2/3] w-full overflow-hidden relative">
          <img
            src={tmdbPosterUrl(movie.posterPath)}
            alt={movie.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/95 via-background/25 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="mb-2 flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="text-sm font-bold">
                FILMIO {displayRating.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3">{movie.overview}</p>
          </div>
        </div>
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="font-display uppercase tracking-wide font-bold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {movie.title}
          </h3>
          {year && (
            <p className="text-xs text-muted-foreground mt-1">{year}</p>
          )}
          {showDescription && movie.overview && (
            <p className="text-xs leading-relaxed text-muted-foreground/80 line-clamp-2 mt-2">
              {movie.overview}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
