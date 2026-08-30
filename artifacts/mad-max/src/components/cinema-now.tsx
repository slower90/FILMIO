import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  Film,
  Globe2,
  MapPin,
  MessageCircle,
  Radar,
  RotateCcw,
  Star,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { tmdbPosterUrl } from "@/lib/utils";
import { withMovieTitle } from "@/lib/movie-links";
import { fetchPrismRatings, type PrismRatings } from "@/lib/mad-max-ratings";
import type { RowMovie } from "@/components/movie-row";
import { apiFetch } from "@/lib/api-url";
import { LazyBlurImage } from "@/components/lazy-blur-image";

type CinemaNowNewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  category: "film" | "anime";
  publishedAt: string;
};

type PulseSignal = {
  id: string;
  kind: "watching" | "ratings" | "regional" | "upcoming" | "journal";
  label: string;
  detail: string;
  qualifier: string;
  source: string;
  href: string;
  movie?: RowMovie;
  metric?: string;
};

type CinemaNowProps = {
  movies: RowMovie[];
  upcomingMovies: RowMovie[];
  isLoading: boolean;
  isUpcomingLoading: boolean;
};

async function fetchIndianPulse(): Promise<RowMovie[]> {
  const response = await apiFetch("/api/movies/indian?maxPages=1");
  if (!response.ok) throw new Error("Unable to load regional cinema signals");
  const data = await response.json() as { results?: RowMovie[] };
  return data.results ?? [];
}

async function fetchCinemaNews(): Promise<CinemaNowNewsItem[]> {
  const response = await apiFetch("/api/news");
  if (!response.ok) throw new Error("Unable to load journal signals");
  const data = await response.json() as { items?: CinemaNowNewsItem[] };
  return data.items ?? [];
}

function formatPublishedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function SignalIcon({ kind }: { kind: PulseSignal["kind"] }) {
  if (kind === "regional") return <MapPin aria-hidden="true" />;
  if (kind === "ratings") return <MessageCircle aria-hidden="true" />;
  if (kind === "upcoming") return <Clock3 aria-hidden="true" />;
  if (kind === "journal") return <BookOpen aria-hidden="true" />;
  return <TrendingUp aria-hidden="true" />;
}

function SignalTarget({
  signal,
  children,
}: {
  signal: PulseSignal;
  children: React.ReactNode;
}) {
  const className = "cinema-now-signal group";
  if (signal.kind === "journal") {
    return (
      <a
        href={signal.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={signal.href} className={className}>
      {children}
    </Link>
  );
}

function TrendPulse({ signal, index }: { signal: PulseSignal; index: number }) {
  return (
    <li>
      <SignalTarget signal={signal}>
        <span className="cinema-now-signal-index" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="cinema-now-signal-marker" aria-hidden="true">
          <SignalIcon kind={signal.kind} />
        </span>
        {signal.movie?.posterPath ? (
          <LazyBlurImage
            src={tmdbPosterUrl(signal.movie.posterPath, "w92")}
            placeholderSrc={tmdbPosterUrl(signal.movie.posterPath, "w92")}
            alt=""
            width={46}
            height={69}
            className="cinema-now-signal-poster"
            wrapperClassName="cinema-now-signal-poster"
          />
        ) : (
          <span className="cinema-now-signal-poster cinema-now-signal-poster--empty" aria-hidden="true">
            <Film />
          </span>
        )}
        <span className="min-w-0">
          <span className="cinema-now-signal-label">
            {signal.label}
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
          <span className="cinema-now-signal-detail">
            {signal.detail}
          </span>
          <span className="cinema-now-signal-meta">
            <span>{signal.qualifier}</span>
            <span className="cinema-now-signal-separator" aria-hidden="true">/</span>
            <span>{signal.source}</span>
          </span>
        </span>
        {signal.metric && (
          <span className="cinema-now-signal-metric">{signal.metric}</span>
        )}
      </SignalTarget>
    </li>
  );
}

function CinemaGraph({
  signals,
  isLoading,
  hasSourceError,
  onRetry,
}: {
  signals: PulseSignal[];
  isLoading: boolean;
  hasSourceError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="cinema-now-graph" aria-label="Loading cinema pulse">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="cinema-now-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="cinema-now-graph cinema-now-graph--empty" role="status">
        <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
        <p>No global signal has cleared the observation window yet.</p>
        <button type="button" onClick={onRetry} className="cinema-now-retry">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Check again
        </button>
      </div>
    );
  }

  return (
    <div className="cinema-now-graph">
      <ol aria-label="Observed cinema signals" aria-live="polite">
        {signals.map((signal, index) => (
          <TrendPulse key={signal.id} signal={signal} index={index} />
        ))}
      </ol>
      {hasSourceError && (
        <p className="cinema-now-coverage-note" role="status">
          Coverage is limited while one signal source catches up.
        </p>
      )}
    </div>
  );
}

export function CinemaNow({
  movies,
  upcomingMovies,
  isLoading,
  isUpcomingLoading,
}: CinemaNowProps) {
  const regionalQuery = useQuery({
    queryKey: ["home-cinema-now-india"],
    queryFn: fetchIndianPulse,
    staleTime: 10 * 60 * 1000,
  });
  const newsQuery = useQuery({
    queryKey: ["home-trending-news"],
    queryFn: fetchCinemaNews,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });
  const ratingIds = movies.slice(0, 8).map((movie) => movie.id);
  const ratingsQuery = useQuery<PrismRatings>({
    queryKey: ["home-cinema-now-ratings", ratingIds],
    queryFn: () => fetchPrismRatings(ratingIds),
    enabled: ratingIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const ratingEntry = movies
    .map((movie) => ({ movie, rating: ratingsQuery.data?.[String(movie.id)] }))
    .filter((entry): entry is { movie: RowMovie; rating: NonNullable<typeof entry.rating> } =>
      Boolean(entry.rating?.totalRatings),
    )
    .sort((a, b) => b.rating.totalRatings - a.rating.totalRatings)[0];
  const leadingMovie = movies[0];
  const regionalMovie = regionalQuery.data?.[0];
  const upcomingMovie = upcomingMovies[0];
  const journalItem = newsQuery.data?.[0];

  const signals: PulseSignal[] = [
    ...(leadingMovie
      ? [{
          id: `watching-${leadingMovie.id}`,
          kind: "watching" as const,
          label: "Global catalog attention",
          detail: `${leadingMovie.title} leads this week's TMDB trending signal.`,
          qualifier: "Global / 7-day window",
          source: "TMDB",
          href: withMovieTitle(`/movies/${leadingMovie.id}`, leadingMovie.title),
          movie: leadingMovie,
          metric: "01 / trend",
        }]
      : []),
    ...(ratingEntry
      ? [{
          id: `ratings-${ratingEntry.movie.id}`,
          kind: "ratings" as const,
          label: "FILMIO community context",
          detail: `${ratingEntry.rating.totalRatings.toLocaleString("en-IN")} ratings recorded for ${ratingEntry.movie.title}.`,
          qualifier: "FILMIO / all-time archive",
          source: "FILMIO",
          href: withMovieTitle(`/movies/${ratingEntry.movie.id}`, ratingEntry.movie.title),
          movie: ratingEntry.movie,
          metric: `${ratingEntry.rating.totalRatings.toLocaleString("en-IN")} ratings`,
        }]
      : []),
    ...(regionalMovie
      ? [{
          id: `regional-${regionalMovie.id}`,
          kind: "regional" as const,
          label: "Regional discovery",
          detail: `${regionalMovie.title} is moving through the India-origin discovery feed.`,
          qualifier: "India / origin-country feed",
          source: "TMDB",
          href: withMovieTitle(`/movies/${regionalMovie.id}`, regionalMovie.title),
          movie: regionalMovie,
          metric: "IN / signal",
        }]
      : []),
    ...(upcomingMovie
      ? [{
          id: `upcoming-${upcomingMovie.id}`,
          kind: "upcoming" as const,
          label: "Coming into focus",
          detail: `${upcomingMovie.title} is listed in the upcoming India release feed.`,
          qualifier: "India / release context",
          source: "TMDB",
          href: withMovieTitle(`/movies/${upcomingMovie.id}`, upcomingMovie.title),
          movie: upcomingMovie,
          metric: "Next / release",
        }]
      : []),
    ...(journalItem
      ? [{
          id: `journal-${journalItem.id}`,
          kind: "journal" as const,
          label: "Journal scene signal",
          detail: journalItem.title,
          qualifier: `${journalItem.category === "anime" ? "Anime" : "Film"} / ${formatPublishedDate(journalItem.publishedAt)}`,
          source: journalItem.source,
          href: journalItem.url,
          metric: "Read / scene",
        }]
      : []),
  ];

  const sourceLoading = isLoading || isUpcomingLoading || regionalQuery.isLoading || newsQuery.isLoading;
  const graphLoading = signals.length === 0 && sourceLoading;
  const hasSourceError = regionalQuery.isError || newsQuery.isError || ratingsQuery.isError;
  const retry = () => {
    void Promise.all([
      regionalQuery.refetch(),
      newsQuery.refetch(),
      ratingsQuery.refetch(),
    ]);
  };

  return (
    <section className="cinema-now" aria-labelledby="cinema-now-title">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="cinema-now-layout">
          <div className="cinema-now-intro">
            <p className="editorial-kicker">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> Cinema now
            </p>
            <h2 id="cinema-now-title" className="editorial-heading mt-4">
              The world is watching
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
              A living pulse of the stories entering FILMIO through catalog attention,
              community context, regional discovery, and the Journal.
            </p>
            <div className="cinema-now-source-line">
              <span><Radar className="h-3.5 w-3.5" aria-hidden="true" /> Observation window: current</span>
              <span><Star className="h-3.5 w-3.5" aria-hidden="true" /> Sources: TMDB + FILMIO</span>
            </div>
            <Link href="/discover" className="cinema-now-explore">
              Explore the live signal <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <CinemaGraph
            signals={signals}
            isLoading={graphLoading}
            hasSourceError={hasSourceError}
            onRetry={retry}
          />
        </div>
      </div>
    </section>
  );
}