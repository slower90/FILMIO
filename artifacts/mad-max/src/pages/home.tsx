import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { HeroCarousel, type HeroMovie } from "@/components/hero-carousel";
import { MoodAgentRow } from "@/components/mood-agent-row";
import { TopTen } from "@/components/top-ten";
import { RecentlyViewedRow } from "@/components/recently-viewed-row";
import { ClipSection, type ClipItem } from "@/components/clip-section";
import { ActorRow } from "@/components/actor-row";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, ExternalLink, Clock, Film, Tv } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CatalogStatusNotice, type CatalogMetadata } from "@/components/catalog-status-notice";

gsap.registerPlugin(ScrollTrigger);

// ── Fetchers ─────────────────────────────────────────────────────────────────
type CatalogMovies = RowMovie[] & { metadata?: CatalogMetadata };

async function fetchCategory(path: string, maxPages: number): Promise<CatalogMovies> {
  const url = path.startsWith("/api/")
    ? `${path}?maxPages=${maxPages}`
    : `/api/movies/${path}?maxPages=${maxPages}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const data = await res.json();
  return Object.assign((data.results ?? []).map((movie: RowMovie) =>
    path.startsWith("tv-")
      ? { ...movie, linkHref: `/movies/${movie.id}?type=tv` }
      : movie,
  ), { metadata: data.metadata });
}

async function fetchGenre(genreId: number, maxPages = 1): Promise<RowMovie[]> {
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
    linkHref: a.anilistUrl ?? a.malUrl ?? "/anime",
    externalLink: !!(a.anilistUrl || a.malUrl),
  }));
}

async function fetchClips(): Promise<ClipItem[]> {
  const res = await fetch("/api/movies/clips");
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

async function fetchPersonalizedMovies(): Promise<RowMovie[]> {
  const res = await fetch("/api/recommendations?limit=20");
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data;
}

function useMovieCategory(key: string, path: string, maxPages = 3) {
  return useMovieCategoryWhen(key, path, maxPages, true);
}

function useMovieCategoryWhen(key: string, path: string, maxPages = 3, enabled = true) {
  return useQuery<CatalogMovies>({
    queryKey: ["movies", key, maxPages],
    queryFn: () => fetchCategory(path, maxPages),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

function useGenreRow(id: number, enabled = true) {
  return useQuery<RowMovie[]>({
    queryKey: ["home-genre", id],
    queryFn: () => fetchGenre(id, 1),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

function useNearViewport(ref: React.RefObject<Element | null>) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return ready;
}

// Indian cinema rows (origin country IN, optionally by original language)
const INDIAN_ROWS = [
  { language: "",   name: "Trending in India" },
  { language: "hi", name: "Bollywood Blockbusters" },
  { language: "ta", name: "Tamil & Kollywood" },
  { language: "te", name: "Telugu / Tollywood" },
] as const;

async function fetchIndian(language: string): Promise<RowMovie[]> {
  const res = await fetch(
    `/api/movies/indian?maxPages=1${language ? `&language=${language}` : ""}`,
  );
  if (!res.ok) return [];
  const d = await res.json();
  return d.results ?? [];
}

function IndianRow({ language, name }: { language: string; name: string }) {
  const { data, isLoading } = useQuery<RowMovie[]>({
    queryKey: ["home-indian", language],
    queryFn: () => fetchIndian(language),
    staleTime: 10 * 60 * 1000,
  });
  return (
    <MovieRow
      title={name}
      movies={data ?? []}
      isLoading={isLoading}
      className="border-b border-border/30"
    />
  );
}

// TMDB genre IDs
const GENRE_ROWS = [
  { id: 28,   name: "Action & Adventure" },
  { id: 878,  name: "Sci-Fi Picks" },
  { id: 16,   name: "Anime & Animation Picks" },
  { id: 35,   name: "Comedy Picks" },
  { id: 18,   name: "Drama Picks" },
  { id: 27,   name: "Horror & Thrills" },
  { id: 10749, name: "Romance Picks" },
  { id: 9648, name: "Mystery Picks" },
  { id: 53,   name: "Thriller Picks" },
  { id: 12,   name: "Adventure Picks" },
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

type DiscoveryTab = "for-you" | "trending" | "genres" | "india" | "watch-next";

const DISCOVERY_TABS: Array<{
  id: DiscoveryTab;
  label: string;
}> = [
  { id: "for-you", label: "For You" },
  { id: "trending", label: "Trending" },
  { id: "genres", label: "Genres" },
  { id: "india", label: "India" },
  { id: "watch-next", label: "Watch Next" },
];

function DiscoveryMenu({
  activeTab,
  onChange,
}: {
  activeTab: DiscoveryTab;
  onChange: (tab: DiscoveryTab) => void;
}) {
  return (
    <nav id="discovery-program" aria-label="Discovery programme" className="sticky top-[4.75rem] z-30 border-y border-border/50 bg-background/95 shadow-[0_10px_26px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-md sm:top-[4.5rem]">
      <div className="container mx-auto flex justify-between gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:justify-center sm:gap-5">
        {DISCOVERY_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={activeTab === id ? "page" : undefined}
            data-testid={`button-discovery-tab-${id}`}
            className={`shrink-0 border-b-2 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors sm:text-xs ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function DiscoveryHeading({
  eyebrow,
  title,
  description,
  centered = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  centered?: boolean;
}) {
  return (
    <div className={`container mx-auto px-4 pb-1 pt-12 md:pt-16 ${centered ? "text-center" : ""}`}>
      <p className="editorial-kicker">{eyebrow}</p>
      <h2 className={`editorial-heading mt-4 ${centered ? "mx-auto" : ""}`}>{title}</h2>
      <p className={`mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground ${centered ? "mx-auto" : ""}`}>{description}</p>
    </div>
  );
}

function uniqueMovies(...groups: Array<RowMovie[] | undefined>): RowMovie[] {
  const seen = new Set<number>();
  return groups
    .flatMap((group) => group ?? [])
    .filter((movie) => {
      if (seen.has(movie.id)) return false;
      seen.add(movie.id);
      return true;
    });
}

interface TrendingNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  category: "film" | "anime";
  publishedAt: string;
  thumbnail: string | null;
  excerpt: string;
}

function TrendingNewsCard({ item }: { item: TrendingNewsItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const isAnime = item.category === "anime";
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group overflow-hidden rounded-lg border border-border bg-card/40 transition hover:-translate-y-1 hover:border-primary/60 hover:bg-card"
    >
        <div className={`relative aspect-[16/9] overflow-hidden ${isAnime ? "bg-gradient-to-br from-red-950 via-rose-950 to-slate-950" : "bg-gradient-to-br from-amber-950 via-orange-950 to-slate-950"}`}>
        {item.thumbnail && !imageFailed ? (
          <img
            src={item.thumbnail}
            alt={`${item.title} — ${item.category} news`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {isAnime ? <Tv className="h-12 w-12 text-foreground/50" /> : <Film className="h-12 w-12 text-foreground/50" />}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--ink)/0.92)] via-[hsl(var(--ink)/0.15)] to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-sm border border-primary/30 bg-[hsl(var(--ink)/0.78)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur">
          {item.category === "anime" ? "Anime News" : "Film News"}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="truncate text-primary">{item.source}</span>
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {new Date(item.publishedAt).toLocaleDateString()}
          </span>
        </div>
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug group-hover:text-primary md:text-base">{item.title}</h3>
        {item.excerpt && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.excerpt}</p>}
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          Read full story <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </a>
  );
}

function TrendingNewsSection() {
  const { data, isLoading } = useQuery<{ items: TrendingNewsItem[] }>({
    queryKey: ["home-trending-news"],
    queryFn: async () => {
      const response = await fetch("/api/news");
      if (!response.ok) throw new Error("Failed to fetch trending news");
      return response.json();
    },
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
  const items = data?.items?.slice(0, 12) ?? [];

  return (
    <section className="border-b border-border/30 py-10">
      <div className="container mx-auto px-4">
        <div className="section-marker mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Latest from entertainment</p>
          <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wider">Trending News</h2>
        </div>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-md bg-muted" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Trending news is being updated.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => <TrendingNewsCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function DiscoveryPrimer({ onSelect }: { onSelect: (tab: DiscoveryTab) => void }) {
  return (
    <section className="home-primer" aria-labelledby="discovery-primer-title">
      <div className="container relative z-10 mx-auto grid gap-8 px-4 py-9 md:grid-cols-[1.1fr_0.9fr] md:items-end md:gap-16 md:py-11">
        <div>
          <p className="editorial-kicker">The FILMIO method</p>
          <h2 id="discovery-primer-title" className="editorial-heading mt-4 max-w-xl">
            Start with instinct. Keep the context close.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Take a clear first step, then look closer when you want to. No countdowns,
            pressure, or endless feed — just better signals for the film in front of you.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
          <button
            type="button"
            onClick={() => onSelect("genres")}
            className="home-primer-link w-full text-left"
            data-testid="button-primer-browse-mood"
          >
            Browse by feeling <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => onSelect("watch-next")}
            className="home-primer-link w-full text-left"
            data-testid="button-primer-plan-watch"
          >
            Plan what comes next <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("for-you");
  const progressRef = useRef<HTMLDivElement>(null);
  const discoveryShellRef = useRef<HTMLDivElement>(null);
  const belowFoldReady = useNearViewport(discoveryShellRef);
  const { data: trendingMovies, isLoading: loadingTrending } = useMovieCategory("trending", "trending", 1);

  const { data: animeMovies, isLoading: loadingAnime } = useQuery<RowMovie[]>({
    queryKey: ["home-anime"],
    queryFn: fetchAnimeRow,
    enabled: belowFoldReady,
    staleTime: 15 * 60 * 1000,
  });
  const { data: tvTopRated, isLoading: loadingTvTopRated } = useMovieCategoryWhen("tv-top-rated", "tv-top-rated", 1, belowFoldReady);
  const { data: tvUpcoming, isLoading: loadingTvUpcoming } = useMovieCategoryWhen("tv-upcoming", "tv-upcoming", 1, belowFoldReady);
  const { data: upcomingMovies, isLoading: loadingUpcoming } = useMovieCategoryWhen("upcoming", "upcoming", 1, belowFoldReady);
  const { data: theaterMovies, isLoading: loadingTheaters } = useMovieCategoryWhen("in-theaters", "in-theaters", 1, belowFoldReady);
  const homeCatalogMetadata = [trendingMovies, tvTopRated, tvUpcoming, upcomingMovies, theaterMovies]
    .map((movies) => movies?.metadata)
    .find((metadata) => metadata?.stale || metadata?.partial || metadata?.source === "unavailable");
  const { data: clips, isLoading: loadingClips } = useQuery<ClipItem[]>({
    queryKey: ["home-clips"],
    queryFn: fetchClips,
    enabled: belowFoldReady,
    staleTime: 15 * 60 * 1000,
  });
  const { data: personalizedFeed, isLoading: loadingPersonalized } = useQuery<RowMovie[]>({
    queryKey: ["personalized-recommendations"],
    queryFn: fetchPersonalizedMovies,
    enabled: belowFoldReady,
    staleTime: 5 * 60 * 1000,
  });
  // These genre pools power the genre-personalized For You row.
  // React Query deduplicates them with the genre tab requests below.
  const { data: actionMovies } = useGenreRow(28, belowFoldReady);
  const { data: comedyMovies } = useGenreRow(35, belowFoldReady);
  const { data: dramaMovies } = useGenreRow(18, belowFoldReady);
  const { data: sciFiMovies } = useGenreRow(878, belowFoldReady);

  const genreFallbackMovies = uniqueMovies(actionMovies, sciFiMovies, comedyMovies, dramaMovies);
  const personalizedMovies = personalizedFeed?.length ? personalizedFeed : genreFallbackMovies;
  const genreRows = GENRE_ROWS;

  const choosePrimerTab = (tab: DiscoveryTab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById("discovery-program")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    const progress = progressRef.current;
    if (!progress) return;
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
      <div className="film-grain min-h-screen bg-background">
      <Navbar />
      <div
        ref={progressRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 right-0 top-[4.72rem] z-[51] h-px origin-left scale-x-0 bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.55)] sm:top-[4.48rem]"
      />

      {/* The image leads; catalog context follows it like a programme note. */}
      <HeroCarousel movies={(trendingMovies ?? []) as HeroMovie[]} />
      <div className="container mx-auto px-4 pt-5">
        <CatalogStatusNotice metadata={homeCatalogMetadata} />
      </div>

      <DiscoveryPrimer onSelect={choosePrimerTab} />

      <div ref={discoveryShellRef} className="home-program-shell space-y-3 border-t border-border/30 pb-10 pt-5">
        <DiscoveryMenu activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "for-you" && (
          <>
            <DiscoveryHeading
              eyebrow="Your genre mix"
              title="One strong starting point"
              description="Action, sci-fi, comedy, and drama picks selected from real movie genres. Choose a film, then decide with the details that matter."
            />
            <MovieRow
              title="Action, Sci-Fi, Comedy & Drama"
              movies={personalizedMovies}
                isLoading={!belowFoldReady || (loadingPersonalized && !personalizedMovies.length)}
              className="border-b border-border/30"
            />
             {belowFoldReady && <ActorRow />}
             {belowFoldReady && <MoodAgentRow />}
             {belowFoldReady && <RecentlyViewedRow />}
            <MovieRow
              title="Top 10 Web Series"
              movies={tvTopRated ?? []}
              isLoading={!belowFoldReady || loadingTvTopRated}
              className="border-b border-border/30"
            />
            <MovieRow
              title="Upcoming TV Shows"
              movies={tvUpcoming ?? []}
              isLoading={!belowFoldReady || loadingTvUpcoming}
              className="border-b border-border/30"
            />
            <MovieRow
              title="Now Playing in Indian Theatres"
              movies={theaterMovies ?? []}
              isLoading={!belowFoldReady || loadingTheaters}
              className="border-b border-border/30"
            />
            <MovieRow
              title="Coming Soon in India"
              movies={upcomingMovies ?? []}
              isLoading={!belowFoldReady || loadingUpcoming}
              className="border-b border-border/30"
            />
            <ClipSection clips={clips ?? []} isLoading={!belowFoldReady || loadingClips} />
          </>
        )}

        {activeTab === "trending" && (
          <>
            <DiscoveryHeading eyebrow="What people are watching" title="Trending now" description="The most watched movies, anime, theater releases, and picks based on your mood." centered />
            <TopTen movies={trendingMovies ?? []} isLoading={loadingTrending} />
            <MovieRow title="Trending Now Movies" movies={trendingMovies ?? []} isLoading={loadingTrending} className="border-b border-border/30" />
            <MovieRow title="Trending Anime" movies={animeMovies ?? []} isLoading={loadingAnime} className="border-b border-border/30" />
            <MovieRow title="Trending in Theaters" movies={theaterMovies ?? []} isLoading={loadingTheaters} className="border-b border-border/30" />
            <MoodAgentRow heading="Trending on Your Mood" />
          </>
        )}

        {activeTab === "genres" && (
          <>
            <DiscoveryHeading eyebrow="Choose a feeling" title="Browse by mood" description="Start with the kind of story you want right now." />
            {genreRows.map((g) => <GenreRow key={g.id} id={g.id} name={g.name} />)}
          </>
        )}

        {activeTab === "india" && (
          <>
            <DiscoveryHeading eyebrow="Made for India" title="Indian cinema" description="Explore the latest favorites across Hindi, Tamil, and Telugu cinema." />
            {INDIAN_ROWS.map((r) => <IndianRow key={r.language} language={r.language} name={r.name} />)}
          </>
        )}

        {activeTab === "watch-next" && (
          <>
            <DiscoveryHeading eyebrow="Plan your next watch" title="Watch next" description="Movies, series, and cinema releases worth keeping an eye on." />
            <MovieRow title="Top 10 Web Series" movies={tvTopRated ?? []} isLoading={!belowFoldReady || loadingTvTopRated} className="border-b border-border/30" />
            <MovieRow title="Upcoming TV Shows" movies={tvUpcoming ?? []} isLoading={!belowFoldReady || loadingTvUpcoming} className="border-b border-border/30" />
            <MovieRow title="Now Playing in Indian Theatres" movies={theaterMovies ?? []} isLoading={!belowFoldReady || loadingTheaters} className="border-b border-border/30" />
            <MovieRow title="Coming Soon in India" movies={upcomingMovies ?? []} isLoading={!belowFoldReady || loadingUpcoming} className="border-b border-border/30" />
            <ClipSection clips={clips ?? []} isLoading={!belowFoldReady || loadingClips} />
          </>
        )}
      </div>

      <section className="home-approach border-t border-border/30 py-16 md:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="editorial-kicker">The FILMIO approach</p>
          <h2 className="editorial-heading mt-4">Find films worth talking about</h2>
          <div className="mt-6 grid gap-6 text-sm leading-8 text-muted-foreground md:grid-cols-2">
            <div className="space-y-4">
              <p>
                FILMIO is a discovery space for people who want more from movie night than
                another endless scroll. Explore Indian cinema, global releases, television,
                and anime in one focused catalogue, then decide what deserves your time
                through community ratings, thoughtful reviews, and useful context.
              </p>
              <p>
                Start with a mood, a genre, a cast member, or a title you already love.
                Our recommendations are built around the kind of story you want to watch,
                not just what is popular for a moment. Browse action, comedy, drama,
                romance, science fiction, thrillers, and regional favourites from Hindi,
                Tamil, Telugu, and more.
              </p>
            </div>
            <div className="space-y-4">
              <p>
                Every FILMIO score belongs to the FILMIO community and uses a clear
                one-to-ten scale. External provider scores are shown only as discovery
                context, so you can tell the difference between a platform rating and a
                source from elsewhere. Read a review, save a movie for later, or add your
                own perspective after the credits roll.
              </p>
              <p>
                Looking for where to watch? Check official availability in India alongside
                trailers, cast details, release information, and source-backed Journal
                stories. FILMIO helps you move from curiosity to a confident choice,
                whether you are planning a weekend screening, catching up on a series, or
                searching for the next film that stays with you.
              </p>
            </div>
          </div>
        </div>
      </section>

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
            <Link href="/professionals" target="_blank" rel="noopener noreferrer">
              Explore Profiles <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

    </div>
  );
}
