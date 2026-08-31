import { Link } from "wouter";
import { type MovieSummary } from "@workspace/api-client-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { BookOpen, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchPrismRatings, getPrismDisplayRating } from "@/lib/mad-max-ratings";
import { movieStoryPath, withMovieTitle } from "@/lib/movie-links";
import { LazyBlurImage } from "@/components/lazy-blur-image";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { prefetchMovieOverview } from "@/lib/movie-prefetch";

interface MovieCardProps {
  movie: Pick<MovieSummary, "id" | "title" | "posterPath" | "releaseDate" | "overview" | "voteAverage">;
  showDescription?: boolean;
  mediaType?: "movie" | "tv";
}

export function MovieCard({ movie, showDescription = false, mediaType = "movie" }: MovieCardProps) {
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "";
  const queryClient = useQueryClient();
  const { ref: cardRef, isNearViewport } = useNearViewport<HTMLDivElement>();
  const prefetch = () => void prefetchMovieOverview(queryClient, movie.id, mediaType);

  useEffect(() => {
    if (isNearViewport) prefetch();
  }, [isNearViewport, movie.id, mediaType, queryClient]);

  const { data: ratings } = useQuery({
    queryKey: ["mad-max-rating", movie.id],
    queryFn: () => fetchPrismRatings([movie.id]),
    staleTime: 5 * 60 * 1000,
  });
  const rating = ratings?.[String(movie.id)];
  const displayRating = getPrismDisplayRating(movie.voteAverage, rating);

  return (
    <div ref={cardRef} className="flex h-full min-w-0 flex-col">
      <Link href={withMovieTitle(`/movies/${movie.id}${mediaType === "tv" ? "?type=tv" : ""}`, movie.title)} className="block h-full" data-testid={`link-movie-card-${movie.id}`} onMouseEnter={prefetch} onFocus={prefetch}>
        <div className="poster-lift group relative h-full cursor-pointer overflow-hidden rounded-md border border-border bg-card flex flex-col transition-[transform,border-color,box-shadow] duration-200 focus-within:border-primary/60" data-testid={`card-movie-${movie.id}`}>
        <div className="aspect-[2/3] w-full overflow-hidden relative">
          <LazyBlurImage
            src={tmdbPosterUrl(movie.posterPath)}
            placeholderSrc={tmdbPosterUrl(movie.posterPath, "w92")}
            alt={`${movie.title} movie poster`}
            width={342}
            height={513}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/95 via-background/25 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="mb-2 flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="tabular-nums text-sm font-bold">
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
      <Link
        href={movieStoryPath(movie.id, movie.title, mediaType)}
        className="mt-2 inline-flex items-center gap-2 self-start px-1 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-primary"
        data-testid={`link-movie-story-${movie.id}`}
      >
        <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Read the story
      </Link>
    </div>
  );
}
