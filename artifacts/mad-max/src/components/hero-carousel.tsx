import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ArrowRight, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tmdbBackdropSrcSet, tmdbBackdropUrl } from "@/lib/utils";
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
  const heroRef = useRef<HTMLElement>(null);
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

  // A slow vertical drift gives the opening the feel of a projected image.
  // Only transforms are animated, so the backdrop never causes layout work.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || reduceMotion) return;
    const ctx = gsap.context(() => {
      bgRefs.current.filter(Boolean).forEach((backdrop) => {
        if (!backdrop) return;
        gsap.to(backdrop, {
          yPercent: -5,
          ease: "none",
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      });
    }, hero);
    return () => ctx.revert();
  }, [reduceMotion, slides.length]);

  // The first frame arrives as a quiet editorial reveal rather than a pop.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || reduceMotion) return;
    const items = Array.from(content.querySelectorAll<HTMLElement>("[data-hero-item]"));
    gsap.fromTo(
      items,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, delay: 0.1, ease: "power3.out" },
    );
    return () => gsap.killTweensOf(items);
  }, [reduceMotion]);

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
          gsap.set(nextEl, { opacity: 1, xPercent: incomingX, scale: 1.04 });
            gsap.to(prevEl, {
              opacity: 0,
              xPercent: outgoingX,
              duration: 0.65,
              ease: "power3.inOut",
            });
            gsap.to(nextEl, {
              xPercent: 0,
              scale: 1,
              duration: 0.75,
              ease: "power3.inOut",
            });
        }
        if (contentRef.current) {
          gsap.killTweensOf(contentRef.current);
          const items = Array.from(contentRef.current.querySelectorAll<HTMLElement>("[data-hero-item]"));
          gsap.fromTo(
            items,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.52, stagger: 0.055, ease: "power2.out", delay: 0.13 },
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
  const adjacentIndexes = new Set([
    index,
    (index + 1) % slides.length,
    (index - 1 + slides.length) % slides.length,
  ]);
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const currentRating = prismRatings?.[String(movie.id)];

  return (
    <section
      ref={heroRef}
      id="hero-opening"
      className="relative h-[min(43rem,78vh)] min-h-[38rem] max-h-[700px] cursor-grab touch-pan-y select-none overflow-hidden border-b border-border/60 active:cursor-grabbing sm:min-h-[36rem]"
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
           {adjacentIndexes.has(i) && (
             <img
               src={tmdbBackdropUrl((m as HeroMovie).backdropPath ?? m.posterPath)}
               srcSet={tmdbBackdropSrcSet((m as HeroMovie).backdropPath ?? m.posterPath)}
               sizes="100vw"
               alt={`${m.title} backdrop`}
               width={1280}
               height={720}
               className="h-full w-full object-cover object-center"
               loading={i === index ? "eager" : "lazy"}
               fetchPriority={i === index ? "high" : "low"}
               decoding="async"
             />
           )}
        </div>
      ))}

      {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/84 to-background/22 md:via-background/66 md:to-transparent" />
       <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-background/48" />
       <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/90 to-transparent" />
       {/* Content */}
      <div className="absolute inset-0 flex items-end md:items-center">
          <div className="container mx-auto px-4 pb-20 md:pb-0">
            <div ref={contentRef} className="max-w-xl md:max-w-2xl" aria-live="polite">
               <p data-hero-item className="cinema-kicker mb-4 flex items-center gap-3">
                 <span className="inline-block h-px w-8 bg-primary" aria-hidden="true" />
                 A considered place to begin
            </p>
               <h1 data-hero-item data-testid={`text-hero-title-${movie.id}`} className="max-w-2xl text-[clamp(2.9rem,7vw,6.25rem)] font-display font-semibold uppercase leading-[0.9] tracking-[-0.015em] text-glow mb-5">
              {movie.title}
            </h1>
               <div data-hero-item className="mb-5 flex flex-wrap items-center gap-2.5 text-sm">
                <span className="flex items-center gap-1.5 rounded-sm border border-primary/40 bg-[hsl(var(--ink)/0.48)] px-2.5 py-1.5 font-bold text-primary backdrop-blur-sm">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  FILMIO {getPrismDisplayRating(movie.voteAverage, currentRating).toFixed(1)}
              </span>
                {year && <span className="tabular-nums border-l border-foreground/25 pl-3 text-foreground/70">{year}</span>}
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/55">Community perspective</span>
            </div>
            {movie.overview && (
                <p data-hero-item className="mb-7 max-w-xl text-sm leading-relaxed text-foreground/78 line-clamp-3 md:text-base">
                {movie.overview}
              </p>
            )}
              <div data-hero-item className="flex flex-wrap gap-3">
                 <Button asChild size="lg" className="min-h-11 px-6 font-display uppercase tracking-[0.16em] shadow-[0_14px_26px_-18px_hsl(var(--primary)/0.9)]">
                <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)}>
                    Explore this film <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                  className="min-h-11 bg-background/40 px-6 font-display uppercase tracking-[0.16em] backdrop-blur-sm"
              >
                <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)}>
                  <Info className="w-4 h-4 mr-2" /> Details
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

       {/* Guided navigation */}
         <div className="absolute bottom-5 left-4 right-4 z-10 mx-auto flex max-w-6xl items-end justify-between gap-3 sm:bottom-6">
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">
               Swipe / drag to explore
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Choose featured film">
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => {
                    goTo(slideIndex);
                    resetTimer();
                  }}
                  className="group flex h-11 w-7 items-center justify-center"
                  aria-label={`Show featured film ${slide.title}`}
                  aria-current={slideIndex === index ? "true" : undefined}
                  data-testid={`button-hero-slide-${slide.id}`}
                >
                  <span
                    className={`h-1 transition-all duration-300 ${
                      slideIndex === index ? "w-7 bg-primary" : "w-3 bg-foreground/35 group-hover:bg-foreground/70"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("discovery-program")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })}
            className="group hidden min-h-11 items-center gap-2 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/70 transition-colors hover:text-primary md:flex"
            aria-label="Continue to the discovery program"
          >
            <span className="flex h-8 w-5 items-start justify-center rounded-full border border-foreground/40 pt-1">
              <span className="h-1.5 w-0.5 bg-primary transition-transform group-hover:translate-y-1" />
            </span>
            <span>Enter the program</span>
          </button>
      </div>
    </section>
  );
}
