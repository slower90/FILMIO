import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import { useRef, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchCategory(path: string, maxPages: number): Promise<RowMovie[]> {
  const url = path.startsWith("/api/")
    ? `${path}?maxPages=${maxPages}`
    : `/api/movies/${path}?maxPages=${maxPages}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const data = await res.json();
  return data.results ?? [];
}

async function fetchGenre(genreId: number, maxPages = 2): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/by-genre?genreId=${genreId}&maxPages=${maxPages}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.results ?? [];
}

async function fetchAnimeRow(): Promise<RowMovie[]> {
  const res = await fetch("/api/anime/top?filter=bypopularity&type=tv");
  if (!res.ok) return [];
  const d = await res.json();
  return (d.results ?? []).map((a: any) => ({
    id: a.id,
    title: a.title,
    posterPath: a.posterPath,   // full URL — tmdbPosterUrl handles it
    releaseDate: a.releaseDate,
    voteAverage: a.voteAverage,
    linkHref: a.anilistUrl ?? a.malUrl ?? "/anime",
    externalLink: !!(a.anilistUrl || a.malUrl),
  }));
}

function useMovieCategory(key: string, path: string, maxPages = 3) {
  return useQuery<RowMovie[]>({
    queryKey: ["movies", key, maxPages],
    queryFn: () => fetchCategory(path, maxPages),
    staleTime: 5 * 60 * 1000,
  });
}

function useGenreRow(id: number) {
  return useQuery<RowMovie[]>({
    queryKey: ["home-genre", id],
    queryFn: () => fetchGenre(id, 2),
    staleTime: 10 * 60 * 1000,
  });
}

// TMDB genre IDs
const GENRE_ROWS = [
  { id: 28,   name: "⚔️ Action Hits" },
  { id: 18,   name: "🎭 Award-Winning Drama" },
  { id: 35,   name: "😂 Laugh Out Loud Comedy" },
  { id: 27,   name: "👻 Horror & Thrills" },
  { id: 878,  name: "🚀 Science Fiction" },
] as const;

function GenreRow({ id, name }: { id: number; name: string }) {
  const { data, isLoading } = useGenreRow(id);
  return (
    <MovieRow
      title={name}
      movies={data ?? []}
      isLoading={isLoading}
      className="border-b border-border/30"
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const { isSignedIn, isLoaded, user } = useUser();
  const heroRef  = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef   = useRef<HTMLParagraphElement>(null);
  const ctaRef   = useRef<HTMLDivElement>(null);

  const { data: trendingMovies,  isLoading: loadingTrending  } = useMovieCategory("trending",     "trending",     3);
  const { data: popularMovies,   isLoading: loadingPopular   } = useMovieCategory("popular",      "popular",      3);
  const { data: topRatedMovies,  isLoading: loadingTopRated  } = useMovieCategory("top-rated",    "top-rated",    3);
  const { data: newReleases,     isLoading: loadingNew       } = useMovieCategory("new-releases", "new-releases", 2);

  const { data: animeMovies, isLoading: loadingAnime } = useQuery<RowMovie[]>({
    queryKey: ["home-anime"],
    queryFn: fetchAnimeRow,
    staleTime: 15 * 60 * 1000,
  });

  // Hero entrance animation
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(titleRef.current, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7 })
      .fromTo(subRef.current,   { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.35")
      .fromTo(ctaRef.current,   { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 }, "-=0.3");
    return () => { tl.kill(); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vh] bg-primary/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] bg-primary/5 rounded-full blur-[100px] mix-blend-screen" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h1
            ref={titleRef}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-bold uppercase tracking-tighter mb-6 leading-none"
            style={{ opacity: 0 }}
          >
            The serious film <br />
            <span className="text-primary text-glow">Lover&apos;s Network</span>
          </h1>

          <p
            ref={subRef}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ opacity: 0 }}
          >
            Track what you watch. Follow trusted critics. Connect with
            industry professionals. Discover cinema without the noise.
          </p>

          <div ref={ctaRef} className="flex flex-wrap gap-4 justify-center" style={{ opacity: 0 }}>
            {isLoaded && isSignedIn ? (
              <>
                <Button asChild size="lg" className="font-display uppercase tracking-wider px-8">
                  <Link href="/watchlist">My Watchlist</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="font-display uppercase tracking-wider px-8"
                >
                  <Link href="/discover">
                    Discover More <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg" className="font-display uppercase tracking-wider px-8">
                  <Link href="/sign-up">Create Free Account</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="font-display uppercase tracking-wider px-8"
                >
                  <Link href="/genres">Browse Genres</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Carousels ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border/30">

        <MovieRow
          title="🔥 Trending This Week"
          movies={trendingMovies ?? []}
          isLoading={loadingTrending}
          className="border-b border-border/30"
        />

        <MovieRow
          title="🎬 New in Cinemas"
          movies={newReleases ?? []}
          isLoading={loadingNew}
          className="border-b border-border/30"
        />

        <MovieRow
          title="📈 Popular Right Now"
          movies={popularMovies ?? []}
          isLoading={loadingPopular}
          className="border-b border-border/30"
        />

        <MovieRow
          title="⭐ All-Time Classics"
          movies={topRatedMovies ?? []}
          isLoading={loadingTopRated}
          className="border-b border-border/30"
        />

        {/* Genre rows */}
        {GENRE_ROWS.map((g) => (
          <GenreRow key={g.id} id={g.id} name={g.name} />
        ))}

        {/* Anime row */}
        <MovieRow
          title="🌸 Top Anime"
          movies={animeMovies ?? []}
          isLoading={loadingAnime}
          className="border-b border-border/30"
        />

      </div>

      {/* ── Industry CTA ──────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wider mb-4">
            Are you an industry professional?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Directors, writers, composers, and crew — create a verified profile and connect directly with audiences.
          </p>
          <Button
            asChild
            variant="outline"
            className="font-display uppercase tracking-wider"
          >
            <Link href="/professionals">
              Explore Profiles <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/30 py-8">
        <div className="container mx-auto px-4 flex flex-wrap gap-6 items-center justify-between text-xs text-muted-foreground">
          <span className="font-display uppercase tracking-widest font-bold text-foreground/60">
            MAD MAX
          </span>
          <nav className="flex flex-wrap gap-4">
            {[
              { href: "/genres", label: "Genres" },
              { href: "/anime",  label: "Anime" },
              { href: "/news",   label: "News" },
              { href: "/professionals", label: "Industry" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-foreground transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
