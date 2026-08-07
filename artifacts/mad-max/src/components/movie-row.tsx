import { useRef, useEffect } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface RowMovie {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  voteAverage?: number | null;
  /** Override the link href (e.g. for anime cards). Defaults to /movies/:id */
  linkHref?: string;
  /** If set, link opens in a new tab */
  externalLink?: boolean;
}

interface MovieRowProps {
  title: string;
  movies: RowMovie[];
  isLoading?: boolean;
  className?: string;
}

const SKELETON_COUNT = 12;

// ── Individual card with GSAP hover ──────────────────────────────────────────
function MovieCard({ movie }: { movie: RowMovie }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const href = movie.linkHref ?? `/movies/${movie.id}`;

  const onEnter = () => {
    gsap.to(cardRef.current, {
      y: -7,
      scale: 1.06,
      duration: 0.22,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(imgWrapRef.current, {
      boxShadow: "0 18px 40px rgba(0,0,0,0.75), 0 0 0 1.5px rgba(251,191,36,0.25)",
      duration: 0.22,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const onLeave = () => {
    gsap.to(cardRef.current, {
      y: 0,
      scale: 1,
      duration: 0.25,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(imgWrapRef.current, {
      boxShadow: "0 0px 0px rgba(0,0,0,0)",
      duration: 0.25,
      ease: "power2.inOut",
      overwrite: "auto",
    });
  };

  const inner = (
    <div
      ref={cardRef}
      className="flex-none w-32 md:w-36 cursor-pointer"
      style={{ willChange: "transform" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        ref={imgWrapRef}
        className="aspect-[2/3] rounded overflow-hidden bg-muted relative"
        style={{ boxShadow: "0 0px 0px rgba(0,0,0,0)" }}
      >
        <img
          src={tmdbPosterUrl(movie.posterPath)}
          alt={movie.title}
          className="w-full h-full object-cover"
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
        {/* Hover tint */}
        <div className="absolute inset-0 bg-primary/0 hover:bg-primary/8 transition-colors duration-200 pointer-events-none" />
      </div>
      <p className="mt-2 text-xs font-display uppercase tracking-wide font-semibold line-clamp-1 leading-tight transition-colors duration-150 hover:text-primary">
        {movie.title}
      </p>
      {year && <p className="text-[10px] text-muted-foreground mt-0.5">{year}</p>}
    </div>
  );

  if (movie.externalLink) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}

// ── Row ───────────────────────────────────────────────────────────────────────
export function MovieRow({ title, movies, isLoading, className }: MovieRowProps) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // ScrollTrigger: fade-in + slide-up when row enters viewport
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
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

  // Button scroll — GSAP-driven so it matches the momentum feel
  const scroll = (direction: "left" | "right") => {
    const track = scrollRef.current;
    if (!track) return;
    const amount = track.clientWidth * 0.75;
    gsap.to(track, {
      scrollLeft: track.scrollLeft + (direction === "right" ? amount : -amount),
      duration: 0.55,
      ease: "power2.inOut",
      overwrite: "auto",
    });
  };

  return (
    <section ref={sectionRef} className={cn("py-10", className)}>
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
                  className="flex-none w-32 md:w-36"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="aspect-[2/3] rounded bg-muted animate-pulse" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="mt-1 h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              ))
            : movies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      </div>
    </section>
  );
}
