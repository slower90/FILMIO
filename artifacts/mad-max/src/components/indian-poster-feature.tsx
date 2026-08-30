import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api-url";
import { withMovieTitle } from "@/lib/movie-links";
import { tmdbPosterUrl } from "@/lib/utils";
import type { RowMovie } from "@/components/movie-row";

const ROTATION_MS = 7000;

async function fetchIndianSpotlight(): Promise<RowMovie[]> {
  const response = await apiFetch("/api/movies/indian?maxPages=1");
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.results) ? data.results.slice(0, 8) : [];
}

export function IndianPosterFeature() {
  const { data: movies, isLoading } = useQuery<RowMovie[]>({
    queryKey: ["home-indian-spotlight"],
    queryFn: fetchIndianSpotlight,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const items = movies ?? [];
  const activeMovie = items[activeIndex];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || items.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [items.length, reducedMotion]);

  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) setActiveIndex(0);
  }, [activeIndex, items.length]);

  if (isLoading) {
    return (
      <section className="border-y border-border/30 py-7" aria-label="Indian cinema spotlight">
        <div className="container mx-auto px-4">
          <div className="h-[28rem] animate-pulse rounded-md bg-muted sm:h-[34rem]" />
        </div>
      </section>
    );
  }

  if (!activeMovie) return null;

  const movieHref = withMovieTitle(activeMovie.linkHref ?? `/movies/${activeMovie.id}`, activeMovie.title);
  const year = activeMovie.releaseDate ? new Date(activeMovie.releaseDate).getFullYear() : null;

  const move = (direction: number) => {
    setActiveIndex((current) => (current + direction + items.length) % items.length);
  };

  return (
    <section className="border-y border-border/30 py-7 md:py-9" aria-labelledby="indian-spotlight-title">
      <div className="container mx-auto px-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="cinema-kicker">Indian cinema</p>
            <h2 id="indian-spotlight-title" className="mt-1 font-display text-lg font-bold uppercase tracking-[0.12em]">
              Spotlight
            </h2>
          </div>
          <Link
            href="/browse?collection=indian"
            className="inline-flex min-h-11 items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary hover:text-foreground"
          >
            All India <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div
          className="relative overflow-hidden rounded-md border border-border/70 bg-[hsl(var(--ink))]"
          role="region"
          aria-roledescription="carousel"
          aria-label="Rotating Indian movie spotlight"
        >
          <img
            src={tmdbPosterUrl(activeMovie.posterPath)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--ink)/0.35)] via-[hsl(var(--ink)/0.5)] to-[hsl(var(--ink)/0.96)]" />

          <div className="relative flex min-h-[28rem] flex-col items-center justify-end px-4 pb-5 pt-8 sm:min-h-[34rem] sm:pb-7">
            <Link
              href={movieHref}
              className="group relative block w-[min(64vw,16rem)] overflow-hidden rounded-[0.35rem] border border-primary/40 shadow-[0_18px_55px_-20px_hsl(var(--primary)/0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--ink))]"
              aria-label={`Open details for ${activeMovie.title}`}
              data-testid="link-indian-spotlight-poster"
            >
              <img
                src={tmdbPosterUrl(activeMovie.posterPath)}
                alt={`${activeMovie.title} poster`}
                width={342}
                height={513}
                className="aspect-[2/3] h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <span className="absolute inset-x-2 bottom-2 rounded-sm bg-[hsl(var(--ink)/0.82)] px-2 py-2 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-primary opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Open movie details
              </span>
            </Link>

            <div className="mt-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {year ?? "Now showing"}
              </p>
              <p className="mt-1 max-w-[17rem] truncate font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
                {activeMovie.title}
              </p>
            </div>

            {items.length > 1 && (
              <div className="mt-4 flex items-center gap-2" aria-label="Spotlight controls">
                <button
                  type="button"
                  onClick={() => move(-1)}
                  className="grid min-h-11 min-w-11 place-items-center rounded-full border border-border bg-background/70 text-foreground transition hover:border-primary hover:text-primary"
                  aria-label="Previous Indian movie"
                  data-testid="button-indian-spotlight-previous"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="flex items-center gap-1.5" aria-label={`${activeIndex + 1} of ${items.length}`}>
                  {items.map((movie, index) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/50 hover:bg-foreground"}`}
                      aria-label={`Show ${movie.title}`}
                      aria-current={index === activeIndex ? "true" : undefined}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => move(1)}
                  className="grid min-h-11 min-w-11 place-items-center rounded-full border border-border bg-background/70 text-foreground transition hover:border-primary hover:text-primary"
                  aria-label="Next Indian movie"
                  data-testid="button-indian-spotlight-next"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}