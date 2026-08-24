import { useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Star, Plus, Check } from "lucide-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { createWatchlistAddPayload } from "@/lib/authenticated-flow-contracts";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useUser } from "@clerk/react";
import {
  getGetWatchlistQueryKey,
  useAddToWatchlist,
  useGetWatchlist,
  useRemoveFromWatchlist,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { fetchPrismRatings, getPrismDisplayRating, type PrismRatings } from "@/lib/mad-max-ratings";
import { withMovieTitle } from "@/lib/movie-links";

gsap.registerPlugin(ScrollTrigger);

export interface RowMovie {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  voteAverage?: number;
  /** Override the link href (e.g. for anime cards). Defaults to /movies/:id */
  linkHref?: string;
  /** If set, link opens in a new tab */
  externalLink?: boolean;
}

interface MovieRowProps {
  title?: string;
  movies: RowMovie[];
  isLoading?: boolean;
  className?: string;
}

const SKELETON_COUNT = 12;

// ── Individual card ───────────────────────────────────────────────────────────
function MovieCard({
  movie,
  rating,
}: {
  movie: RowMovie;
  rating?: { averageRating: number; totalRatings: number };
}) {
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const href = withMovieTitle(movie.linkHref ?? `/movies/${movie.id}`, movie.title);
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const { data: watchlist } = useGetWatchlist({
    query: { queryKey: getGetWatchlistQueryKey(), enabled: !!isSignedIn },
  });
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const isSaved = watchlist?.some((entry) => entry.movieId === movie.id) ?? false;
  const isSaving = addToWatchlist.isPending || removeFromWatchlist.isPending;

  const openMovie = (
    <div
      className="poster-shell relative aspect-[2/3] overflow-hidden rounded-[0.35rem] border border-border/70"
    >
      <img
        src={tmdbPosterUrl(movie.posterPath)}
        alt={movie.title}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div
        className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-1 backdrop-blur-sm"
        title="FILMIO rating"
        aria-label={
          rating && rating.totalRatings > 0
            ? `FILMIO rating ${getPrismDisplayRating(movie.voteAverage, rating).toFixed(1)} out of 10`
            : "FILMIO rating 0.0 out of 10"
        }
      >
        <Star className="h-2.5 w-2.5 fill-primary text-primary" />
        <span className="text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-primary">
          FILMIO
        </span>
        <span className="text-[10px] font-bold leading-none text-white">
          {getPrismDisplayRating(movie.voteAverage, rating).toFixed(1)}
        </span>
      </div>
       <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(var(--ink)/0.48)] via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </div>
  );

  const handleWatchlist = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isSignedIn || isSaving) return;
    const onSuccess = () =>
      queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });

    if (isSaved) {
      removeFromWatchlist.mutate({ movieId: movie.id }, { onSuccess });
    } else {
      addToWatchlist.mutate(
        {
          data: createWatchlistAddPayload({
            movieId: movie.id,
            movieTitle: movie.title,
            moviePosterPath: movie.posterPath,
            movieReleaseDate: movie.releaseDate,
          }),
        },
        { onSuccess },
      );
    }
  };

  return (
    <div
      className="group w-36 flex-none transform-gpu transition-[transform,opacity] duration-200 hover:-translate-y-1.5 hover:scale-[1.025] focus-within:-translate-y-1.5 md:w-40"
    >
      {movie.externalLink ? (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${movie.title}`}>
          {openMovie}
        </a>
      ) : (
        <Link href={href} aria-label={`Open ${movie.title}`}>
          {openMovie}
        </Link>
      )}
       <p className="mt-2 line-clamp-1 text-xs font-display font-semibold uppercase tracking-[0.08em] leading-tight group-hover:text-primary">
        {movie.title}
      </p>
      {year && <p className="mt-0.5 text-[10px] text-muted-foreground">{year}</p>}
      {isSignedIn ? (
        <button
          type="button"
          onClick={handleWatchlist}
          disabled={isSaving}
          aria-label={isSaved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
          className={cn(
             "mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded border px-1.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors",
            isSaved
              ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25"
              : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
          )}
        >
          {isSaved ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {isSaving ? "Saving..." : isSaved ? "Saved" : "Watchlist"}
        </button>
      ) : (
        <Link
          href="/sign-in"
          onClick={(event) => event.stopPropagation()}
           className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded border border-border bg-card px-1.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Watchlist
        </Link>
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
export function MovieRow({ title, movies, isLoading, className }: MovieRowProps) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const ratingIds = movies.map((movie) => movie.id);
  const { data: prismRatings } = useQuery<PrismRatings>({
    queryKey: ["mad-max-ratings", ratingIds],
    queryFn: () => fetchPrismRatings(ratingIds),
    enabled: ratingIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // ScrollTrigger: fade-in + slide-up when row enters viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Start invisible so there's no flash before GSAP takes over
    gsap.set(el, { opacity: 0, y: 48 });
    const ctx = gsap.context(() => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 90%",
          once: true,
        },
      });
    });
    return () => ctx.revert();
  }, []);

  // Momentum horizontal scroll: convert vertical wheel → horizontal with GSAP
  useEffect(() => {
    const track = scrollRef.current;
    if (!track) return;

    const onWheel = (e: WheelEvent) => {
      // Let native horizontal scroll pass through (trackpad)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const target = track.scrollLeft + e.deltaY * 2.5;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        track.scrollLeft = target;
        return;
      }
      gsap.to(track, {
        scrollLeft: target,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    track.addEventListener("wheel", onWheel, { passive: false });
    return () => track.removeEventListener("wheel", onWheel);
  }, []);

  const visibleMovies = expanded ? movies : movies.slice(0, 8);

  return (
    <section ref={sectionRef} className={cn("py-9 md:py-11", className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        {title ? (
           <div className="mb-5 flex items-end justify-between border-l-2 border-primary pl-3">
             <h2 className="text-2xl font-display font-bold uppercase tracking-[0.09em] md:text-3xl">{title}</h2>
             <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">Curated for tonight</span>
          </div>
        ) : null}

        {/* Scroll track — overflow-y:visible lets hovered cards scale up without clipping */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-4"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            overflowY: "visible",
          }}
        >
          {isLoading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div
                  key={i}
                   className="flex-none w-36 md:w-40"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                   <div className="poster-shell aspect-[2/3] rounded animate-pulse" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="mt-1 h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              ))
             : visibleMovies.map((movie) => (
               <MovieCard
                 key={movie.id}
                 movie={movie}
                 rating={prismRatings?.[String(movie.id)]}
               />
             ))}
          {!isLoading && movies.length > 8 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
               className="group flex-none w-36 md:w-40 aspect-[2/3] rounded border border-primary/35 bg-primary/[0.06] flex flex-col items-center justify-center gap-3 text-primary transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
              aria-label={`See more movies in ${title}`}
            >
               <span className="w-11 h-11 rounded-full border border-current flex items-center justify-center transition-transform group-hover:translate-x-1">
                <ChevronRight className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-display font-bold uppercase tracking-widest text-center px-2">
                See more
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
