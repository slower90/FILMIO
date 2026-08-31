import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Compass, Eye, Heart, Languages, MapPin, Star, UserRound } from "lucide-react";
import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import type { Rating, ViewingHistoryEntry, WatchlistEntry } from "@workspace/api-client-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { withMovieTitle } from "@/lib/movie-links";
import { Button } from "@/components/ui/button";
import type { CinemaPreferenceKey, CinemaPreferences } from "@/lib/cinema-preferences";
import { apiFetch } from "@/lib/api-url";
import { LazyBlurImage } from "@/components/lazy-blur-image";
import { CinemaEmptyState } from "@/components/cinema-empty-state";

type GraphFilter = "all" | "watched" | "rated" | "loved" | "disliked";
type SignalKind = "actor" | "director" | "genre" | "country" | "decade" | "language";

type MovieOverview = {
  movie?: {
    id: number;
    title: string;
    posterPath: string | null;
    releaseDate: string;
    genres: Array<{ id: number; name: string }>;
    originalLanguage?: string | null;
    productionCountries?: string[];
  };
  credits?: {
    cast: Array<{ id: number; name: string }>;
    crew: Array<{ id: number; name: string; job: string }>;
  };
};

type GraphMovie = {
  id: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  watched: boolean;
  watchlisted: boolean;
  rating?: number;
  overview?: MovieOverview;
};

type Signal = {
  key: string;
  label: string;
  kind: SignalKind;
  score: number;
  count: number;
};

type GraphNode = {
  id: string;
  label: string;
  kind: "room" | "movie" | SignalKind;
  x: number;
  y: number;
  movie?: GraphMovie;
  signal?: Signal;
};

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic",
  bn: "Bengali",
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ml: "Malayalam",
  mr: "Marathi",
  pt: "Portuguese",
  ru: "Russian",
  ta: "Tamil",
  te: "Telugu",
  zh: "Mandarin",
};

const FILTERS: Array<{ value: GraphFilter; label: string }> = [
  { value: "all", label: "All signals" },
  { value: "watched", label: "Watched" },
  { value: "rated", label: "Rated" },
  { value: "loved", label: "Loved · 8+" },
  { value: "disliked", label: "Disliked · 1–4" },
];

const PREFERENCE_KEY_BY_KIND: Record<SignalKind, CinemaPreferenceKey> = {
  actor: "favoriteActor",
  director: "favoriteDirector",
  genre: "favoriteGenre",
  country: "favoriteCountry",
  decade: "favoriteDecade",
  language: "favoriteLanguage",
};

function yearOf(movie: GraphMovie) {
  const year = movie.releaseDate?.slice(0, 4);
  return year && Number(year) > 1800 ? year : null;
}

function decadeOf(movie: GraphMovie) {
  const year = yearOf(movie);
  return year ? `${Math.floor(Number(year) / 10) * 10}s` : null;
}

function languageName(code?: string | null) {
  if (!code) return null;
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

function collectSignals(movies: GraphMovie[]): Signal[] {
  const buckets = new Map<string, Signal>();
  const add = (kind: SignalKind, label: string, weight: number) => {
    const key = `${kind}:${label}`;
    const current = buckets.get(key);
    if (current) {
      current.count += 1;
      current.score += weight;
    } else {
      buckets.set(key, { key, label, kind, count: 1, score: weight });
    }
  };

  movies.forEach((movie) => {
    const detail = movie.overview;
    if (!detail?.movie) return;
    const weight = movie.rating ? 1 + movie.rating / 10 : 1;
    detail.credits?.crew
      .filter((person) => person.job === "Director")
      .slice(0, 2)
      .forEach((person) => add("director", person.name, weight));
    detail.credits?.cast.slice(0, 4).forEach((person) => add("actor", person.name, weight));
    detail.movie.genres.slice(0, 4).forEach((genre) => add("genre", genre.name, weight));
    detail.movie.productionCountries?.slice(0, 2).forEach((country) => add("country", country, weight));
    const decade = decadeOf(movie);
    if (decade) add("decade", decade, weight);
    const language = languageName(detail.movie.originalLanguage);
    if (language) add("language", language, weight);
  });

  return [...buckets.values()].sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label));
}

function movieMatches(movie: GraphMovie, filter: GraphFilter) {
  if (filter === "watched") return movie.watched;
  if (filter === "rated") return movie.rating !== undefined;
  if (filter === "loved") return movie.rating !== undefined && movie.rating >= 8;
  if (filter === "disliked") return movie.rating !== undefined && movie.rating <= 4;
  return true;
}

function kindLabel(kind: SignalKind) {
  return kind === "actor" ? "Actor" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function iconForSignal(kind: SignalKind) {
  if (kind === "actor" || kind === "director") return <UserRound className="h-3.5 w-3.5" aria-hidden="true" />;
  if (kind === "country") return <MapPin className="h-3.5 w-3.5" aria-hidden="true" />;
  if (kind === "language") return <Languages className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Compass className="h-3.5 w-3.5" aria-hidden="true" />;
}

function buildGraph(movies: GraphMovie[], signals: Signal[], profileName: string) {
  const center = { id: "room", label: profileName, kind: "room" as const, x: 380, y: 280 };
  const movieNodes: GraphNode[] = movies.map((movie, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(movies.length, 1)) * Math.PI * 2;
    return { id: `movie:${movie.id}`, label: movie.title, kind: "movie", x: 380 + Math.cos(angle) * 142, y: 280 + Math.sin(angle) * 142, movie };
  });
  const signalNodes: GraphNode[] = signals.slice(0, 12).map((signal, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(Math.min(signals.length, 12), 1)) * Math.PI * 2;
    return { id: signal.key, label: signal.label, kind: signal.kind, x: 380 + Math.cos(angle) * 248, y: 280 + Math.sin(angle) * 248, signal };
  });
  const signalByKey = new Map(signalNodes.map((node) => [node.id, node]));
  const edges = [
    ...movieNodes.map((movie) => ({ source: center, target: movie, kind: "room" })),
    ...movieNodes.flatMap((movie) => {
      const related = signals.filter((signal) => {
        const detail = movie.movie?.overview;
        if (!detail?.movie) return false;
        if (signal.kind === "genre") return detail.movie.genres.some((genre) => genre.name === signal.label);
        if (signal.kind === "actor") return detail.credits?.cast.some((person) => person.name === signal.label);
        if (signal.kind === "director") return detail.credits?.crew.some((person) => person.name === signal.label && person.job === "Director");
        if (signal.kind === "country") return detail.movie.productionCountries?.includes(signal.label);
        if (signal.kind === "decade") return decadeOf(movie.movie!) === signal.label;
        return languageName(detail.movie.originalLanguage) === signal.label;
      }).slice(0, 3);
      return related.flatMap((signal) => {
        const target = signalByKey.get(signal.key);
        return target ? [{ source: movie, target, kind: signal.kind }] : [];
      });
    }),
  ];
  return { center, movieNodes, signalNodes, edges };
}

export function PersonalCinemaGraph({
  history = [],
  ratings = [],
  watchlist = [],
  profileName,
  preferences,
}: {
  history?: ViewingHistoryEntry[];
  ratings?: Rating[];
  watchlist?: WatchlistEntry[];
  profileName: string;
  preferences?: CinemaPreferences;
}) {
  const [filter, setFilter] = useState<GraphFilter>("all");
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const historyIds = useMemo(() => new Set(history.map((movie) => movie.id)), [history]);
  const ratingsByMovie = useMemo(() => new Map(ratings.map((rating) => [rating.movieId, rating.score])), [ratings]);
  const watchlistByMovie = useMemo(() => new Map(watchlist.map((entry) => [entry.movieId, entry])), [watchlist]);
  const movies = useMemo<GraphMovie[]>(() => {
    const entries = new Map<number, GraphMovie>();
    [
      ...history,
      ...ratings.map((rating) => ({
        id: rating.movieId,
        title: `Film ${rating.movieId}`,
        posterPath: null,
        releaseDate: null,
        voteAverage: null,
      })),
      ...watchlist.map((entry) => ({
        id: entry.movieId,
        title: entry.movieTitle ?? `Film ${entry.movieId}`,
        posterPath: entry.moviePosterPath ?? null,
        releaseDate: entry.movieReleaseDate ?? null,
        voteAverage: null,
      })),
    ].forEach((movie) => {
      entries.set(movie.id, {
        id: movie.id,
        title: movie.title,
        posterPath: movie.posterPath,
        releaseDate: movie.releaseDate,
        watched: historyIds.has(movie.id) || watchlistByMovie.get(movie.id)?.status === "watched",
        watchlisted: watchlistByMovie.has(movie.id),
        rating: ratingsByMovie.get(movie.id),
      });
    });
    return [...entries.values()].sort((a, b) => Number(b.rating !== undefined) - Number(a.rating !== undefined) || Number(b.watched) - Number(a.watched));
  }, [history, historyIds, ratingsByMovie, watchlist, watchlistByMovie]);

  const detailQueries = useQueries({
    queries: movies.map((movie) => ({
      queryKey: ["personal-cinema-graph-movie", movie.id],
      queryFn: async () => {
        const response = await apiFetch(`/api/movies/${movie.id}/overview`);
        if (!response.ok) throw new Error(`Could not enrich ${movie.title}`);
        return response.json() as Promise<MovieOverview>;
      },
      staleTime: 30 * 60 * 1000,
    })),
  });

  const enrichedMovies = useMemo(
    () => movies.map((movie, index) => {
      const overview = detailQueries[index]?.data;
      return overview?.movie
        ? {
            ...movie,
            title: overview.movie.title,
            posterPath: overview.movie.posterPath,
            releaseDate: overview.movie.releaseDate,
            overview,
          }
        : { ...movie, overview };
    }),
    [detailQueries, movies],
  );
  const filteredMovies = useMemo(() => enrichedMovies.filter((movie) => movieMatches(movie, filter)), [enrichedMovies, filter]);
  const signals = useMemo(() => collectSignals(filteredMovies), [filteredMovies]);
  const graphMovies = filteredMovies.slice(0, 8);
  const graph = useMemo(() => buildGraph(graphMovies, signals, profileName), [graphMovies, profileName, signals]);
  const selectedMovie = filteredMovies.find((movie) => movie.id === selectedMovieId) ?? filteredMovies[0];
  const isLoadingDetails = detailQueries.some((query) => query.isLoading);
  const counts = {
    watched: movies.filter((movie) => movie.watched).length,
    rated: movies.filter((movie) => movie.rating !== undefined).length,
    loved: movies.filter((movie) => movie.rating !== undefined && movie.rating >= 8).length,
    disliked: movies.filter((movie) => movie.rating !== undefined && movie.rating <= 4).length,
  };

  useEffect(() => {
    if (selectedMovie && !filteredMovies.some((movie) => movie.id === selectedMovie.id)) setSelectedMovieId(filteredMovies[0]?.id ?? null);
  }, [filteredMovies, selectedMovie]);

  if (movies.length === 0) {
    return (
      <div className="cinema-graph-empty">
        <Compass className="h-8 w-8 text-primary" aria-hidden="true" />
        <h2 className="mt-4 font-display text-xl font-bold uppercase">Your universe is still forming</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Rate or watch a few films and FILMIO will connect the actors, directors, genres, countries, decades, and languages that shape your taste.</p>
        <Link href="/discover" className="mt-6 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80">Find a film <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  return (
    <section className="personal-cinema-graph" aria-labelledby="cinema-graph-map-title">
      <div className="cinema-graph-toolbar">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter cinema universe">
          {FILTERS.map((item) => (
            <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`cinema-graph-filter ${filter === item.value ? "is-active" : ""}`}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground" aria-live="polite">
          {filteredMovies.length} film{filteredMovies.length === 1 ? "" : "s"} in view
        </p>
      </div>

      {filteredMovies.length === 0 ? (
        <CinemaEmptyState
          compact
          className="my-6"
          description={`This room has no ${filter} signals yet. Try another lens or add a few ratings to widen the map.`}
          actions={[
            { label: "Show all films", onClick: () => setFilter("all"), testId: "button-empty-cinema-graph-all" },
            { label: "Find a film", href: "/discover", testId: "link-empty-cinema-graph-discover" },
          ]}
        />
      ) : (
        <>
          <div className="cinema-graph-workspace">
            <div className="cinema-graph-map-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="editorial-kicker"><Compass className="h-3.5 w-3.5" aria-hidden="true" /> Taste map</p>
                  <h2 id="cinema-graph-map-title" className="mt-3 font-display text-xl font-bold uppercase">A living map of your cinema</h2>
                </div>
                {isLoadingDetails && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Connecting signals…</span>}
              </div>
              <svg className="cinema-graph-svg" viewBox="0 0 760 560" role="img" aria-labelledby="cinema-graph-map-title cinema-graph-map-description">
                <desc id="cinema-graph-map-description">Your {profileName} viewing room connects films to the people and themes that recur across your cinema.</desc>
                {graph.edges.map((edge, index) => (
                  <line key={`${edge.source.id}-${edge.target.id}-${index}`} x1={edge.source.x} y1={edge.source.y} x2={edge.target.x} y2={edge.target.y} className={`cinema-graph-edge edge-${edge.kind}`} />
                ))}
                {graph.signalNodes.map((node) => (
                  <g key={node.id} className={`cinema-graph-node cinema-graph-signal-node node-${node.kind}`} transform={`translate(${node.x} ${node.y})`}>
                    <circle r="28" />
                    <text y="3" textAnchor="middle">{node.label.length > 13 ? `${node.label.slice(0, 12)}…` : node.label}</text>
                    <title>{`${kindLabel(node.signal!.kind)}: ${node.label}, linked to ${node.signal!.count} film${node.signal!.count === 1 ? "" : "s"}`}</title>
                  </g>
                ))}
                {graph.movieNodes.map((node) => (
                  <g
                    key={node.id}
                    className={`cinema-graph-node cinema-graph-movie-node ${selectedMovie?.id === node.movie!.id ? "is-selected" : ""}`}
                    transform={`translate(${node.x} ${node.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${node.movie!.title}${node.movie!.rating ? `, rated ${node.movie!.rating} out of 10` : ""}`}
                    onClick={() => setSelectedMovieId(node.movie!.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedMovieId(node.movie!.id);
                      }
                    }}
                  >
                    <circle r="42" />
                    <image href={tmdbPosterUrl(node.movie!.posterPath)} x="-30" y="-30" width="60" height="60" preserveAspectRatio="xMidYMid slice" />
                    <text y="55" textAnchor="middle">{node.movie!.title.length > 16 ? `${node.movie!.title.slice(0, 15)}…` : node.movie!.title}</text>
                  </g>
                ))}
                <g className="cinema-graph-room-node" transform={`translate(${graph.center.x} ${graph.center.y})`}>
                  <circle r="57" />
                  <circle r="48" />
                  <text y="-3" textAnchor="middle">MY</text>
                  <text y="13" textAnchor="middle">CINEMA</text>
                  <text y="31" textAnchor="middle">UNIVERSE</text>
                </g>
              </svg>
              <p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Showing the first {graphMovies.length} films and strongest recurring signals.</p>
            </div>

            <aside className="cinema-graph-inspector" aria-live="polite">
              {selectedMovie && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="editorial-kicker"><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Selected film</p>
                      <h2 className="mt-3 font-display text-2xl font-bold uppercase leading-none">{selectedMovie.title}</h2>
                    </div>
                    {selectedMovie.rating !== undefined && <span className="cinema-graph-score"><Star className="h-3.5 w-3.5" /> {selectedMovie.rating}/10</span>}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedMovie.watched && <span className="cinema-graph-state">Watched</span>}
                    {selectedMovie.watchlisted && <span className="cinema-graph-state">In watchlist</span>}
                    {selectedMovie.rating !== undefined && selectedMovie.rating >= 8 && <span className="cinema-graph-state is-love"><Heart className="h-3 w-3" /> Loved</span>}
                    {selectedMovie.rating !== undefined && selectedMovie.rating <= 4 && <span className="cinema-graph-state is-muted">Disliked</span>}
                  </div>
                  <div className="mt-6 border-y border-border/60 py-5">
                    {selectedMovie.overview?.credits?.crew.filter((person) => person.job === "Director").slice(0, 2).map((person) => <p key={person.id} className="text-sm"><span className="text-muted-foreground">Directed by </span><strong>{person.name}</strong></p>)}
                    {selectedMovie.overview?.movie?.genres.length ? <p className="mt-2 text-sm"><span className="text-muted-foreground">Inside </span><strong>{selectedMovie.overview.movie.genres.slice(0, 3).map((genre) => genre.name).join(" · ")}</strong></p> : null}
                  </div>
                  <Link href={withMovieTitle(`/movies/${selectedMovie.id}`, selectedMovie.title)} className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80">Open film <ArrowUpRight className="h-4 w-4" /></Link>
                </>
              )}
            </aside>
          </div>

          <div className="cinema-graph-signal-grid" aria-label="Strongest cinema signals">
            {(["actor", "director", "genre", "country", "decade", "language"] as SignalKind[]).map((kind) => {
              const selectedPreference = kind === "actor"
                ? preferences?.favoriteActors?.map((person) => person.name).join(" · ") || preferences?.favoriteActor
                : kind === "director"
                  ? preferences?.favoriteDirectors?.map((person) => person.name).join(" · ") || preferences?.favoriteDirector
                  : preferences?.[PREFERENCE_KEY_BY_KIND[kind]];
              return (
                <div key={kind} className="cinema-graph-signal-card">
                  <span className="cinema-graph-signal-icon">{iconForSignal(kind)}</span>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{kind === "actor" ? "Favorite actor" : kind === "director" ? "Favorite director" : `Favorite ${kind}`}</p>
                  <p className="mt-2 font-display text-sm font-bold uppercase">{selectedPreference || "Not selected yet"}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{selectedPreference ? "Chosen by you" : "Choose this in room settings"}</p>
                </div>
              );
            })}
          </div>

          <ol className="cinema-graph-mobile-list" aria-label="Cinema universe connections">
            {filteredMovies.map((movie) => (
              <li key={movie.id}>
                <button type="button" onClick={() => setSelectedMovieId(movie.id)} className="group flex w-full items-center gap-3 text-left">
                  <LazyBlurImage
                    src={tmdbPosterUrl(movie.posterPath)}
                    placeholderSrc={tmdbPosterUrl(movie.posterPath, "w92")}
                    alt=""
                    width={44}
                    height={64}
                    wrapperClassName="h-16 w-11 shrink-0"
                  />
                  <span className="min-w-0 flex-1"><strong className="block truncate font-display text-sm uppercase group-hover:text-primary">{movie.title}</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{movie.rating ? `Rated ${movie.rating}/10` : movie.watched ? "Watched" : "Saved to watchlist"}</span></span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      <details className="cinema-graph-disclosure">
        <summary>How this universe is built</summary>
        <p>Films come from this viewing room’s watch history, ratings, and watchlist. People, genres, countries, decades, and languages come from the catalog metadata for those films. “Loved” means a personal rating of 8–10; “disliked” means 1–4. No audience behavior is inferred.</p>
      </details>
      <div className="cinema-graph-stats" aria-label="Cinema universe totals">
        <span><strong>{counts.watched}</strong> watched</span><span><strong>{counts.rated}</strong> rated</span><span><strong>{counts.loved}</strong> loved</span><span><strong>{counts.disliked}</strong> disliked</span>
      </div>
    </section>
  );
}