import { ArrowUpRight, Orbit } from "lucide-react";
import { Link } from "wouter";
import { tmdbPosterUrl } from "@/lib/utils";
import { withMovieTitle } from "@/lib/movie-links";
import type { RowMovie } from "@/components/movie-row";

const THREAD_LABELS = [
  "A nearby feeling",
  "A faraway echo",
  "A new point of view",
  "A thread to keep",
];

interface StoryConstellationProps {
  anchor?: RowMovie;
  threads: RowMovie[];
  isLoading?: boolean;
}

function StoryLink({ movie, children, className }: { movie: RowMovie; children: React.ReactNode; className?: string }) {
  const href = withMovieTitle(movie.linkHref ?? `/movies/${movie.id}`, movie.title);
  if (movie.externalLink) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <Link href={href} className={className}>{children}</Link>;
}

function LoadingConstellation() {
  return (
    <div className="story-constellation-map" aria-label="Loading story constellation">
      <div className="story-constellation-origin animate-pulse bg-muted/50" />
      <div className="story-constellation-orbit">
        {[0, 1, 2, 3].map((index) => <div key={index} className="story-constellation-thread animate-pulse bg-muted/40" />)}
      </div>
    </div>
  );
}

export function StoryConstellation({ anchor, threads, isLoading }: StoryConstellationProps) {
  const visibleThreads = threads.filter((movie) => movie.id !== anchor?.id).slice(0, 4);

  return (
    <section className="story-constellation" aria-labelledby="story-constellation-title">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="editorial-kicker"><Orbit className="h-3.5 w-3.5" aria-hidden="true" /> A living index</p>
            <h2 id="story-constellation-title" className="editorial-heading mt-4">
              Follow the <em>thread</em>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              A film is an origin, not a destination. Move through the feeling, the place, and the point of view that gather around it.
            </p>
          </div>
          <p className="max-w-xs text-xs uppercase leading-relaxed tracking-[0.16em] text-muted-foreground md:text-right">
            No ranking. No finish line.<br />Just another way in.
          </p>
        </div>

        {isLoading ? (
          <LoadingConstellation />
        ) : anchor ? (
          <div className="story-constellation-map mt-10">
            <div className="story-constellation-origin">
              <span className="story-constellation-coordinate">Origin / 00</span>
              <StoryLink movie={anchor} className="group block">
                <div className="story-constellation-origin-image">
                  <img
                    src={tmdbPosterUrl(anchor.posterPath)}
                    alt={anchor.title}
                    width={342}
                    height={513}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Start anywhere</p>
                    <h3 className="mt-2 font-display text-2xl font-medium uppercase leading-none tracking-[-0.03em] group-hover:text-primary md:text-3xl">
                      {anchor.title}
                    </h3>
                  </div>
                  <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                </div>
              </StoryLink>
            </div>

            <div className="story-constellation-orbit" aria-label="Story threads">
              {visibleThreads.map((movie, index) => (
                <StoryLink key={`${movie.id}-${movie.title}`} movie={movie} className="story-constellation-thread group">
                  <span className="story-thread-number">0{index + 1}</span>
                  <div className="story-thread-poster">
                    <img
                      src={tmdbPosterUrl(movie.posterPath)}
                      alt=""
                      width={342}
                      height={513}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">{THREAD_LABELS[index]}</p>
                    <h3 className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-tight group-hover:text-primary">{movie.title}</h3>
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Open thread <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                </StoryLink>
              ))}
              {visibleThreads.length === 0 && (
                <div className="story-constellation-thread story-constellation-empty">
                  More threads will appear as the cinema archive comes into focus.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-10 border border-dashed border-border p-8 text-sm text-muted-foreground">
            The constellation is still forming. Try a feeling above to open a new path.
          </div>
        )}
      </div>
    </section>
  );
}