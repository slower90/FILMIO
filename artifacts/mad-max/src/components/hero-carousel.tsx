import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tmdbBackdropUrl } from "@/lib/utils";
import type { RowMovie } from "@/components/movie-row";
import { fetchPrismRatings, getPrismDisplayRating } from "@/lib/mad-max-ratings";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { withMovieTitle } from "@/lib/movie-links";

export interface HeroMovie extends RowMovie {
  backdropPath?: string | null;
  overview?: string;
}

const AUTO_ADVANCE_MS = 6000;

export function HeroCarousel({ movies }: { movies: HeroMovie[] }) {
  const slides = movies.slice(0, 10);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const bgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReduceMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  // Track latest index for the interval without re-creating it
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Clamp index if the slide list shrinks
  useEffect(() => {
    if (slides.length > 0 && index >= slides.length) {
      setIndex(0);
    }
  }, [slides.length, index]);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      const target = (next + slides.length) % slides.length;
      const prev = indexRef.current;
      if (target === prev) return;

        // Netflix-style horizontal slide transition with a lighter content lift.
      if (!reduceMotion) {
        const prevEl = bgRefs.current[prev];
        const nextEl = bgRefs.current[target];
        if (prevEl && nextEl) {
            const movingForward =
              target > prev || (prev === slides.length - 1 && target === 0);
            const incomingX = movingForward ? 100 : -100;
            const outgoingX = movingForward ? -100 : 100;
          gsap.killTweensOf([prevEl, nextEl]);
            gsap.set(nextEl, { opacity: 1, xPercent: incomingX, scale: 1 });
            gsap.to(prevEl, {
              opacity: 0,
              xPercent: outgoingX,
              duration: 0.65,
              ease: "power3.inOut",
            });
            gsap.to(nextEl, {
              xPercent: 0,
              duration: 0.65,
              ease: "power3.inOut",
            });
        }
        if (contentRef.current) {
          gsap.killTweensOf(contentRef.current);
          gsap.fromTo(
            contentRef.current,
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.15 },
          );
        }
      }

      indexRef.current = target;
      setIndex(target);
    },
    [reduceMotion, slides.length],
  );

  // Auto-advance
  useEffect(() => {
    if (slides.length < 2 || reduceMotion) return;
    timerRef.current = setInterval(() => goTo(indexRef.current + 1), AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goTo, reduceMotion, slides.length]);

  // Kill any in-flight tweens on unmount
  useEffect(() => {
    return () => {
      gsap.killTweensOf(bgRefs.current.filter(Boolean));
      if (contentRef.current) gsap.killTweensOf(contentRef.current);
    };
  }, []);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reduceMotion) return;
    timerRef.current = setInterval(() => goTo(indexRef.current + 1), AUTO_ADVANCE_MS);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // Keep buttons, links, and pagination dots clickable instead of treating
    // their press as a carousel gesture.
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;

    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontalSwipe) {
      goTo(indexRef.current + (deltaX < 0 ? 1 : -1));
      resetTimer();
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerCancel = () => {
    swipeStartRef.current = null;
  };

  const { data: prismRatings } = useQuery({
    queryKey: ["mad-max-hero-ratings", slides.map((slide) => slide.id)],
    queryFn: () => fetchPrismRatings(slides.map((slide) => slide.id)),
    enabled: slides.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (slides.length === 0) {
    return (
      <section className="relative h-[62vh] min-h-[420px] overflow-hidden bg-card/70">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute bottom-16 left-4 right-4 mx-auto h-20 max-w-xl animate-pulse rounded bg-muted/60" />
      </section>
    );
  }

  const movie = slides[index];
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const currentRating = prismRatings?.[String(movie.id)];

  return (
    <section
      className="relative h-[min(45rem,78vh)] min-h-[35rem] max-h-[720px] cursor-grab touch-pan-y select-none overflow-hidden border-b border-border/60 active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      aria-roledescription="carousel"
      aria-label="Trending movies"
    >
      {/* Backdrops — stacked, crossfaded by GSAP */}
      {slides.map((m, i) => (
        <div
          key={m.id}
          ref={(el) => { bgRefs.current[i] = el; }}
            className="absolute inset-0 will-change-transform"
           style={{ opacity: reduceMotion ? (i === index ? 1 : 0) : i === 0 ? 1 : 0 }}
        >
           <img
            src={tmdbBackdropUrl((m as HeroMovie).backdropPath ?? m.posterPath)}
            alt={m.title}
             className="h-full w-full object-cover object-top"
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}

      {/* Gradient overlays */}
       <div className="absolute inset-0 bg-gradient-to-r from-background via-background/72 to-background/15 md:via-background/55 md:to-transparent" />
       <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-background/45" />
       <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/65 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex items-end md:items-center">
         <div className="container mx-auto px-4 pb-16 md:pb-0">
          <div ref={contentRef} className="max-w-xl">
              <p className="cinema-kicker mb-4">
                 Discover, Rate &amp; Review Movies
            </p>
             <h1 className="max-w-2xl text-[clamp(2.65rem,6vw,5.75rem)] leading-[0.92] font-display font-semibold uppercase tracking-[0.015em] mb-5 text-glow">
              {movie.title}
            </h1>
             <div className="flex items-center gap-4 mb-5 text-sm">
              <span className="flex items-center gap-1 font-bold">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  FILMIO {getPrismDisplayRating(movie.voteAverage, currentRating).toFixed(1)}
              </span>
              {year && <span className="text-muted-foreground">{year}</span>}
            </div>
            {movie.overview && (
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed line-clamp-3 mb-7 max-w-lg">
                {movie.overview}
              </p>
            )}
             <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="min-h-11 font-display uppercase tracking-[0.16em] px-7">
                <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)}>
                   <Star className="w-4 h-4 mr-2 fill-current" /> Rate &amp; Review
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                 className="min-h-11 font-display uppercase tracking-[0.16em] px-7 bg-background/40 backdrop-blur-sm"
              >
                <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)}>
                  <Info className="w-4 h-4 mr-2" /> Details
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
       <div className="absolute bottom-6 left-4 right-4 mx-auto flex max-w-6xl items-center justify-between gap-2 z-10">
         <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">
           Swipe to explore
         </span>
         <div className="flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => { goTo(i); resetTimer(); }}
             className={`h-2 min-w-11 rounded-full transition-colors duration-300 ${
               i === index ? "bg-primary" : "bg-foreground/25 hover:bg-foreground/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
         </div>
      </div>
    </section>
  );
}
