import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import gsap from "gsap";
import { apiFetch } from "@/lib/api-url";
import { LazyBlurImage } from "@/components/lazy-blur-image";

interface Actor {
  id: number;
  name: string;
  profilePath?: string | null;
  knownForDepartment?: string;
}

async function fetchActors(maxPages = 1, region?: string): Promise<Actor[]> {
  const params = new URLSearchParams({ maxPages: String(maxPages) });
  if (region) params.set("region", region);
  const response = await apiFetch(`/api/movies/actors?${params}`);
  if (!response.ok) throw new Error("Failed to load actors");
  const data = await response.json();
  return data.results ?? [];
}

export function ActorRow({ showIndian = true }: { showIndian?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const indianScrollRef = useRef<HTMLDivElement>(null);
  const { data: actors, isLoading } = useQuery<Actor[]>({
    queryKey: ["home-actors"],
    queryFn: () => fetchActors(1),
    staleTime: 15 * 60 * 1000,
  });
  const { data: indianActors, isLoading: loadingIndianActors } = useQuery<Actor[]>({
    queryKey: ["home-indian-actors"],
    queryFn: () => fetchActors(1, "india"),
    enabled: showIndian,
    staleTime: 15 * 60 * 1000,
  });

  useEffect(() => {
    const tracks = [scrollRef.current, indianScrollRef.current].filter(
      (track): track is HTMLDivElement => !!track,
    );
    const handlers = tracks.map((track) => {
      const onWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        event.preventDefault();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          track.scrollLeft += event.deltaY * 2.5;
        } else {
          gsap.to(track, {
            scrollLeft: track.scrollLeft + event.deltaY * 2.5,
            duration: 0.5,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
      };
      track.addEventListener("wheel", onWheel, { passive: false });
      return { track, onWheel };
    });
    return () => handlers.forEach(({ track, onWheel }) => track.removeEventListener("wheel", onWheel));
  }, []);

  const moveActors = (direction: "left" | "right") => {
    const track = scrollRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      track.scrollBy({ left: direction === "left" ? -520 : 520, behavior: "auto" });
      return;
    }
    gsap.to(track, {
      scrollLeft: track.scrollLeft + (direction === "left" ? -520 : 520),
      duration: 0.55,
      ease: "power2.out",
      overwrite: "auto",
    });
  };
  const moveIndianActors = (direction: "left" | "right") => {
    const track = indianScrollRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      track.scrollBy({ left: direction === "left" ? -520 : 520, behavior: "auto" });
      return;
    }
    gsap.to(track, {
      scrollLeft: track.scrollLeft + (direction === "left" ? -520 : 520),
      duration: 0.55,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const actorCarousel = (
    list: Actor[] | undefined,
    loading: boolean,
    trackRef: React.RefObject<HTMLDivElement | null>,
    label: string,
    seeMore = false,
  ) => (
    <div className="group/actors relative">
      <button
        type="button"
        onClick={() => (trackRef === scrollRef ? moveActors("left") : moveIndianActors("left"))}
        aria-label={`Scroll ${label} left`}
        className="absolute left-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xl backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground md:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => (trackRef === scrollRef ? moveActors("right") : moveIndianActors("right"))}
        aria-label={`Scroll ${label} right`}
        className="absolute right-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-xl backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground md:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div ref={trackRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 touch-pan-x scroll-smooth [scrollbar-width:none] md:gap-6" role="list" aria-label={label}>
        {loading
          ? Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="w-24 flex-none snap-start animate-pulse text-center md:w-28">
                <div className="mx-auto h-24 w-24 rounded-full bg-muted md:h-28 md:w-28" />
                <div className="mx-auto mt-3 h-2.5 w-20 rounded bg-muted" />
              </div>
            ))
          : list?.slice(0, 20).map((actor) => (
              <Link key={actor.id} href={`/actors/${actor.id}`} className="group w-24 flex-none snap-start text-center md:w-28" role="listitem">
                <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-card p-0.5 shadow-lg shadow-black/30 transition duration-300 group-hover:scale-105 group-hover:border-primary group-hover:shadow-primary/20 md:h-28 md:w-28">
                  {actor.profilePath ? (
                    <LazyBlurImage src={`https://image.tmdb.org/t/p/w185${actor.profilePath}`} placeholderSrc={`https://image.tmdb.org/t/p/w92${actor.profilePath}`} alt={actor.name} width={185} height={185} className="h-full w-full rounded-full object-cover" wrapperClassName="h-full w-full rounded-full" />
                  ) : <UserRound className="mx-auto mt-5 h-9 w-9 text-muted-foreground" />}
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-semibold leading-tight group-hover:text-primary md:text-sm">{actor.name}</p>
              </Link>
            ))}
        {!loading && seeMore && (
          <Link href="/actors" className="flex w-24 flex-none snap-start flex-col items-center justify-center gap-2 text-center text-primary md:w-28" role="listitem">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/50 bg-primary/10 transition-colors hover:bg-primary hover:text-primary-foreground md:h-28 md:w-28">
              <ChevronRight className="h-6 w-6" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">See more actors</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <section className="border-b border-border/30 bg-gradient-to-b from-card/20 to-transparent py-9">
      <div className="container mx-auto px-4">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Meet the stars</p>
            <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wider text-foreground md:text-3xl">Top 20 Actors</h2>
          </div>
          <Link href="/actors" className="hidden items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 sm:flex">
            See more actors <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {actorCarousel(actors, isLoading, scrollRef, "Top 20 actors", true)}
        {showIndian && (
          <>
            <div className="mb-4 mt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">From India</p>
              <h3 className="mt-1 text-xl font-display font-bold uppercase tracking-wider text-foreground">Top Indian Actors</h3>
            </div>
            {actorCarousel(indianActors, loadingIndianActors, indianScrollRef, "Top Indian actors", true)}
          </>
        )}
        <Link href="/actors" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider text-primary sm:hidden">
          See more actors <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}