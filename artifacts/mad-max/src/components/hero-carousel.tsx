import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Star, Play, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tmdbBackdropUrl } from "@/lib/utils";
import type { RowMovie } from "@/components/movie-row";
import gsap from "gsap";

export interface HeroMovie extends RowMovie {
  backdropPath?: string | null;
  overview?: string;
}

const AUTO_ADVANCE_MS = 6000;

export function HeroCarousel({ movies }: { movies: HeroMovie[] }) {
  const slides = movies.slice(0, 10);
  const [index, setIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const bgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      // Side effects OUTSIDE the state updater (Strict Mode safe)
      const prevEl = bgRefs.current[prev];
      const nextEl = bgRefs.current[target];
      if (prevEl && nextEl) {
        gsap.killTweensOf([prevEl, nextEl]);
        gsap.to(prevEl, { opacity: 0, duration: 0.7, ease: "power2.inOut" });
        gsap.fromTo(
          nextEl,
          { opacity: 0, scale: 1.06 },
          { opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" },
        );
      }
      if (contentRef.current) {
        gsap.killTweensOf(contentRef.current);
        gsap.fromTo(
          contentRef.current,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.15 },
        );
      }

      indexRef.current = target;
      setIndex(target);
    },
    [slides.length],
  );

  // Auto-advance
  useEffect(() => {
    if (slides.length < 2) return;
    timerRef.current = setInterval(() => goTo(indexRef.current + 1), AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, goTo]);

  // Kill any in-flight tweens on unmount
  useEffect(() => {
    return () => {
      gsap.killTweensOf(bgRefs.current.filter(Boolean));
      if (contentRef.current) gsap.killTweensOf(contentRef.current);
    };
  }, []);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => goTo(indexRef.current + 1), AUTO_ADVANCE_MS);
  };

  if (slides.length === 0) {
    return (
      <section className="relative h-[62vh] min-h-[420px] bg-card animate-pulse" />
    );
  }

  const movie = slides[index];
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;

  return (
    <section className="relative h-[68vh] min-h-[460px] max-h-[720px] overflow-hidden">
      {/* Backdrops — stacked, crossfaded by GSAP */}
      {slides.map((m, i) => (
        <div
          key={m.id}
          ref={(el) => { bgRefs.current[i] = el; }}
          className="absolute inset-0"
          style={{ opacity: i === 0 ? 1 : 0 }}
        >
          <img
            src={tmdbBackdropUrl((m as HeroMovie).backdropPath ?? m.posterPath)}
            alt={m.title}
            className="w-full h-full object-cover object-top"
            loading={i === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />

      {/* Content */}
      <div className="absolute inset-0 flex items-end md:items-center">
        <div className="container mx-auto px-4 pb-16 md:pb-0">
          <div ref={contentRef} className="max-w-xl">
            <p className="text-primary font-display uppercase tracking-[0.3em] text-xs font-bold mb-3">
              #{index + 1} Trending This Week
            </p>
            <h1 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tight leading-none mb-4 text-glow">
              {movie.title}
            </h1>
            <div className="flex items-center gap-4 mb-5 text-sm">
              {movie.voteAverage && movie.voteAverage > 0 ? (
                <span className="flex items-center gap-1 font-bold">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  {movie.voteAverage.toFixed(1)}
                </span>
              ) : null}
              {year && <span className="text-muted-foreground">{year}</span>}
            </div>
            {movie.overview && (
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed line-clamp-3 mb-7 max-w-lg">
                {movie.overview}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-display uppercase tracking-wider px-8">
                <Link href={`/movies/${movie.id}`}>
                  <Play className="w-4 h-4 mr-2 fill-current" /> Watch Now
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="font-display uppercase tracking-wider px-8 bg-background/40 backdrop-blur-sm"
              >
                <Link href={`/movies/${movie.id}`}>
                  <Info className="w-4 h-4 mr-2" /> Details
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Prev / Next arrows — bottom-right pair */}
      <div className="absolute bottom-5 right-4 md:right-8 flex gap-2 z-10">
        <button
          onClick={() => { goTo(index - 1); resetTimer(); }}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/70 hover:border-primary transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => { goTo(index + 1); resetTimer(); }}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/70 hover:border-primary transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => { goTo(i); resetTimer(); }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-8 bg-primary" : "w-3 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
