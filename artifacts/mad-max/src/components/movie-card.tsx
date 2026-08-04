import { Link } from "wouter";
import { type MovieSummary } from "@workspace/api-client-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { Star } from "lucide-react";

interface MovieCardProps {
  movie: MovieSummary;
}

export function MovieCard({ movie }: MovieCardProps) {
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "";

  return (
    <Link href={`/movies/${movie.id}`}>
      <div className="group relative rounded-md overflow-hidden bg-card border border-border transition-all duration-300 hover-elevate cursor-pointer h-full flex flex-col">
        <div className="aspect-[2/3] w-full overflow-hidden relative">
          <img
            src={tmdbPosterUrl(movie.posterPath)}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <div className="flex items-center gap-1 text-primary mb-2">
              <Star className="w-4 h-4 fill-primary text-primary" />
              <span className="font-bold text-sm">{movie.voteAverage?.toFixed(1) || "NR"}</span>
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
        </div>
      </div>
    </Link>
  );
}
