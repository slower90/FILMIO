import { useUser } from "@clerk/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Compass,
  ExternalLink,
  Eye,
  Film,
  Fingerprint,
  GitCompare,
  Layers3,
  LockKeyhole,
  Map,
  NotebookPen,
  Palette,
  RefreshCw,
  ScanLine,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  getGetTrendingMoviesQueryKey,
  getGetViewingHistoryQueryKey,
  getGetWatchlistQueryKey,
  getListMyRatingsQueryKey,
  useGetTrendingMovies,
  useGetViewingHistory,
  useGetWatchlist,
  useListMyRatings,
} from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { SurpriseMe } from "@/components/surprise-me";
import {
  CINEMA_OS_TEST_IDS,
  getProfileActivityState,
  readCinemaLocal,
  saveCinemaLocal,
} from "@/lib/cinema-os-state";
import { withMovieTitle } from "@/lib/movie-links";
import { useActiveProfile } from "@/lib/profile-context";
import { tmdbPosterUrl } from "@/lib/utils";

type CinemaMovie = {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  overview?: string;
  voteAverage?: number;
};

type AfterglowEntry = {
  movieId: number | null;
  movieTitle: string;
  note: string;
  updatedAt: string;
};

const STORAGE_KEYS = {
  afterglow: "filmio:cinema-os:afterglow",
  doubleFeature: "filmio:cinema-os:double-feature",
  spoilerVault: "filmio:cinema-os:spoiler-vault",
  passport: "filmio:cinema-os:passport",
  curriculum: "filmio:cinema-os:curriculum",
} as const;

const CURATOR_TRACKS = [
  { title: "The patient frame", note: "Films that let silence become a character.", mark: "A / 01" },
  { title: "New Indian cinema", note: "A route through voices that refuse one language.", mark: "B / 04" },
  { title: "After the twist", note: "When a reveal is only the beginning of the conversation.", mark: "C / 02" },
];

function isAfterglow(value: unknown): value is AfterglowEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<AfterglowEntry>;
  return typeof entry.movieTitle === "string" && typeof entry.note === "string" && typeof entry.updatedAt === "string";
}

function isPair(value: unknown): value is [number | null, number | null] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => item === null || typeof item === "number");
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatYear(date?: string | null) {
  if (!date) return "Year unknown";
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? "Year unknown" : String(year);
}

function FilmLink({ movie, className = "" }: { movie: CinemaMovie; className?: string }) {
  return (
    <Link
      href={withMovieTitle(`/movies/${movie.id}`, movie.title)}
      className={className}
      data-testid={`link-cinema-os-film-${movie.id}`}
    >
      {movie.title}
    </Link>
  );
}

function ModuleHeader({
  index,
  eyebrow,
  title,
  note,
  icon: Icon,
}: {
  index: string;
  eyebrow: string;
  title: string;
  note: string;
  icon: typeof Film;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div className="flex gap-4">
        <span className="cinema-os-index pt-1">{index}</span>
        <div>
          <p className="editorial-kicker">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium uppercase tracking-[-0.045em] sm:text-5xl">{title}</h2>
        </div>
      </div>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground sm:pt-1 sm:text-right">{note}</p>
    </div>
  );
}

function OsLink({
  href,
  children,
  testId,
}: {
  href: string;
  children?: React.ReactNode;
  testId: string;
}) {
  return (
    <Link href={href} className="cinema-os-small-link" data-testid={testId}>
      {children ?? "Open module"}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export default function CinemaOS() {
  const { isLoaded, isSignedIn } = useUser();
  const { activeProfile, isReady } = useActiveProfile();
  const profileParams = activeProfile ? { profileId: activeProfile.id } : undefined;
  const [afterglow, setAfterglow] = useState<AfterglowEntry>(() =>
    readCinemaLocal(
      typeof window === "undefined" ? undefined : window.localStorage,
      STORAGE_KEYS.afterglow,
      { movieId: null, movieTitle: "", note: "", updatedAt: "" },
      isAfterglow,
    ),
  );
  const [doubleFeature, setDoubleFeature] = useState<[number | null, number | null]>(() =>
    readCinemaLocal(typeof window === "undefined" ? undefined : window.localStorage, STORAGE_KEYS.doubleFeature, [null, null], isPair),
  );
  const [spoilerOpen, setSpoilerOpen] = useState(false);
  const [spoilerNote, setSpoilerNote] = useState(() =>
    readCinemaLocal(typeof window === "undefined" ? undefined : window.localStorage, STORAGE_KEYS.spoilerVault, "", isString),
  );
  const [passportCount, setPassportCount] = useState(() =>
    readCinemaLocal(typeof window === "undefined" ? undefined : window.localStorage, STORAGE_KEYS.passport, 0, isNumber),
  );
  const [curriculumProgress, setCurriculumProgress] = useState(() =>
    readCinemaLocal(typeof window === "undefined" ? undefined : window.localStorage, STORAGE_KEYS.curriculum, 1, isNumber),
  );
  const [savedMessage, setSavedMessage] = useState("");
  const cinemaSignal = useGetTrendingMovies({ page: 1 }, {
    query: { queryKey: getGetTrendingMoviesQueryKey({ page: 1 }), staleTime: 5 * 60 * 1000 },
  });
  const historyQuery = useGetViewingHistory(profileParams, {
    query: { queryKey: getGetViewingHistoryQueryKey(profileParams), enabled: isSignedIn === true && isReady && !!activeProfile },
  });
  const ratingsQuery = useListMyRatings(profileParams, {
    query: { queryKey: getListMyRatingsQueryKey(profileParams), enabled: isSignedIn === true && isReady && !!activeProfile },
  });
  const watchlistQuery = useGetWatchlist(profileParams, {
    query: { queryKey: getGetWatchlistQueryKey(profileParams), enabled: isSignedIn === true && isReady && !!activeProfile },
  });

  const films = cinemaSignal.data?.results ?? [];
  const leadFilm = films[0];
  const selectedFirst = films.find((film) => film.id === doubleFeature[0]);
  const selectedSecond = films.find((film) => film.id === doubleFeature[1]);
  const featureReady = Boolean(selectedFirst && selectedSecond && selectedFirst.id !== selectedSecond.id);

  const afterglowFilm = useMemo<CinemaMovie | undefined>(
    () => films.find((film) => film.id === afterglow.movieId) ?? (
      afterglow.movieId && afterglow.movieTitle
        ? { id: afterglow.movieId, title: afterglow.movieTitle, posterPath: null, releaseDate: null }
        : leadFilm
    ),
    [afterglow.movieId, afterglow.movieTitle, films, leadFilm],
  );
  const watchedCount = historyQuery.data?.length ?? 0;
  const ratedCount = ratingsQuery.data?.length ?? 0;
  const queuedCount = watchlistQuery.data?.filter((entry) => entry.status === "want_to_watch").length ?? 0;
  const profileActivityState = getProfileActivityState({
    isSignedIn: isSignedIn === true,
    isReady,
    historyLoading: historyQuery.isLoading,
    ratingsLoading: ratingsQuery.isLoading,
    watchlistLoading: watchlistQuery.isLoading,
    historyError: Boolean(historyQuery.error),
    ratingsError: Boolean(ratingsQuery.error),
    watchlistError: Boolean(watchlistQuery.error),
    watchedCount,
    ratedCount,
    queuedCount,
  });
  const dnaMeters = [
    ["Watched", Math.min(100, watchedCount * 12)],
    ["Rated", Math.min(100, ratedCount * 10)],
    ["Queued", Math.min(100, queuedCount * 8)],
  ] as const;

  useEffect(() => {
    if (leadFilm && !afterglow.movieTitle && typeof window !== "undefined") {
      setAfterglow((current) => ({ ...current, movieId: leadFilm.id, movieTitle: leadFilm.title }));
    }
  }, [afterglow.movieTitle, leadFilm]);

  const saveAfterglow = () => {
    const next = {
      ...afterglow,
      movieId: afterglowFilm?.id ?? afterglow.movieId,
      movieTitle: afterglowFilm?.title ?? afterglow.movieTitle,
      updatedAt: new Date().toISOString(),
    };
    setAfterglow(next);
    saveCinemaLocal(window.localStorage, STORAGE_KEYS.afterglow, next);
    setSavedMessage("Afterglow saved on this device.");
  };

  const saveDoubleFeature = () => {
    saveCinemaLocal(window.localStorage, STORAGE_KEYS.doubleFeature, doubleFeature);
    setSavedMessage("Double feature held for this device.");
  };

  const saveSpoilerNote = () => {
    saveCinemaLocal(window.localStorage, STORAGE_KEYS.spoilerVault, spoilerNote);
    setSavedMessage("Spoiler Vault updated on this device.");
  };

  const markCurriculum = () => {
    const next = Math.min(curriculumProgress + 1, 6);
    setCurriculumProgress(next);
    saveCinemaLocal(window.localStorage, STORAGE_KEYS.curriculum, next);
    setSavedMessage("Curriculum progress updated.");
  };

  return (
    <div className="cinema-os-page min-h-[100dvh]">
      <Navbar />

      <header className="cinema-os-hero">
        <div className="cinema-os-orbit" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[min(46rem,82svh)] max-w-7xl flex-col justify-between px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="flex items-center justify-between gap-4">
            <p className="cinema-os-index" data-testid="text-cinema-os-index">FILMIO / CINEMA OS / 01</p>
            <span className="hidden text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">A private screening desk</span>
          </div>
          <div className="max-w-3xl pb-4">
            <p className="cinema-kicker" data-testid="text-cinema-os-eyebrow">Your cinema, in progress</p>
            <h1 className="cinema-os-title mt-6" data-testid="heading-cinema-os">
              Choose less.<br /><em>Feel more.</em>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-foreground/70 sm:text-lg">
              Cinema OS is the place between wanting to watch something and knowing why it matters. One good instinct for tonight, then a trail worth keeping.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SurpriseMe className="min-h-12 justify-center px-5 sm:justify-start" />
              <Link href="#cinema-desk" className="inline-flex min-h-12 items-center justify-center gap-2 border border-border px-5 text-[0.65rem] font-bold uppercase tracking-[0.17em] text-muted-foreground transition hover:border-primary/60 hover:text-primary" data-testid="link-cinema-os-desk">
                Enter the desk <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border/60 pt-5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="inline-flex items-center gap-2"><ScanLine className="h-3.5 w-3.5 text-primary" /> A living taste journey</span>
            <span className="inline-flex items-center gap-2"><NotebookPen className="h-3.5 w-3.5 text-primary" /> Notes stay on this device</span>
          </div>
        </div>
      </header>

      <main id="cinema-desk" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12">
        {!isLoaded ? (
          <div className="grid gap-4 border-b border-border/70 py-8 sm:grid-cols-3" aria-label="Loading Cinema OS" role="status" data-testid="status-cinema-os-loading">
            <div className="filmio-skeleton h-20" />
            <div className="filmio-skeleton h-20" />
            <div className="filmio-skeleton h-20" />
          </div>
        ) : !isSignedIn ? (
          <div className="flex flex-col gap-3 border-b border-primary/30 bg-primary/[0.045] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid={CINEMA_OS_TEST_IDS.signedOutStatus}>
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted-foreground">You can sketch a cinema journey here. Sign in when you want your FILMIO profile, watch room, and taste graph in one place.</p>
            </div>
            <Link href="/sign-in?redirect=%2Fcinema-os" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-primary/50 px-4 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-primary hover:bg-primary/10" data-testid="link-cinema-os-sign-in">Sign in to FILMIO <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        ) : null}

        <section className="grid gap-0 border-x border-b border-border/70 lg:grid-cols-[1.02fr_1.45fr]" aria-labelledby="tonight-mode-title">
          <div className="cinema-os-module border-t-0 p-6 sm:p-9">
            <p className="cinema-os-index">Desk note / 01</p>
            <h2 id="tonight-mode-title" className="mt-5 max-w-sm font-display text-4xl font-medium uppercase leading-[0.92] tracking-[-0.055em] sm:text-6xl">The night needs one clear answer.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">Tonight Mode cuts through the catalogue and gives you one real film with a reason. No queue to maintain. No decision fatigue.</p>
            <div className="mt-8"><SurpriseMe className="min-h-12 px-5" /></div>
          </div>
          <div className="cinema-os-module border-l-0 p-6 sm:p-9 lg:border-l">
            <div className="flex items-center justify-between gap-4">
              <p className="editorial-kicker"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> A live signal</p>
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.17em] text-muted-foreground">Not a ranking</span>
            </div>
            {cinemaSignal.isLoading ? (
              <div className="mt-7 grid grid-cols-[5.5rem_1fr] gap-5" data-testid={CINEMA_OS_TEST_IDS.signalLoadingStatus} role="status">
                <div className="filmio-skeleton aspect-[2/3]" />
                <div className="space-y-3 pt-2"><div className="filmio-skeleton h-3 w-24" /><div className="filmio-skeleton h-10 w-4/5" /><div className="filmio-skeleton h-16 w-full" /></div>
              </div>
            ) : cinemaSignal.isError ? (
              <div className="mt-7 border-l-2 border-destructive/60 px-4 py-4" data-testid={CINEMA_OS_TEST_IDS.signalErrorStatus}>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-destructive"><CircleAlert className="h-4 w-4" /> Signal interrupted</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The desk could not connect to the live catalogue. Your local notes are still safe.</p>
                <button type="button" onClick={() => void cinemaSignal.refetch()} className="mt-4 inline-flex min-h-10 items-center gap-2 border border-border px-3 text-[0.62rem] font-bold uppercase tracking-wider hover:border-primary hover:text-primary" data-testid={CINEMA_OS_TEST_IDS.signalRetryButton}><RefreshCw className="h-3.5 w-3.5" /> Retry signal</button>
              </div>
            ) : !leadFilm ? (
              <div className="mt-7 border-l-2 border-primary/60 px-4 py-4" data-testid={CINEMA_OS_TEST_IDS.signalEmptyStatus}>
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">A quiet catalogue</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">There is no live film signal to place here yet. Start with Tonight Mode when the catalogue returns.</p>
              </div>
            ) : (
              <div className="mt-7 grid grid-cols-[6.2rem_minmax(0,1fr)] gap-5 sm:grid-cols-[8.2rem_minmax(0,1fr)] sm:gap-7" data-testid={`card-cinema-os-film-${leadFilm.id}`}>
                <Link href={withMovieTitle(`/movies/${leadFilm.id}`, leadFilm.title)} className="poster-lift block overflow-hidden border border-border" data-testid={`link-cinema-os-lead-poster-${leadFilm.id}`} aria-label={`Open ${leadFilm.title}`}>
                  <img src={tmdbPosterUrl(leadFilm.posterPath, "w342")} alt={`${leadFilm.title} poster`} className="cinema-os-poster" />
                </Link>
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">Why this film / first signal</p>
                  <h3 className="mt-3 font-display text-2xl font-semibold uppercase leading-[0.94] tracking-[-0.04em] sm:text-4xl"><FilmLink movie={leadFilm} /></h3>
                  <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-[0.6rem] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {formatYear(leadFilm.releaseDate)}</span>
                    {leadFilm.voteAverage ? <><span className="text-primary">/</span><span>{leadFilm.voteAverage.toFixed(1)} catalogue score</span></> : null}
                  </div>
                  <p className="mt-5 line-clamp-4 text-sm leading-6 text-muted-foreground">{leadFilm.overview || "A film waiting for a little context, and an evening willing to give it time."}</p>
                  <FilmLink movie={leadFilm} className="cinema-os-small-link mt-5" />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border-x border-b border-border/70 p-6 sm:p-9" aria-labelledby="cinema-dna-title">
          <ModuleHeader index="02" eyebrow="Cinema DNA" title="Your taste is a pattern, not a score." note="A small, readable way into the signals that make your choices feel like yours." icon={Fingerprint} />
          <div className="mt-9 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="cinema-os-panel grid gap-0 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="p-6 sm:p-8">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">Current read</p>
                {profileActivityState === "loading" ? (
                  <div className="mt-5 space-y-3" role="status" data-testid="status-cinema-os-dna-loading">
                    <div className="filmio-skeleton h-10 w-full max-w-lg" />
                    <div className="filmio-skeleton h-4 w-3/4" />
                  </div>
                ) : profileActivityState === "error" ? (
                  <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground" role="alert" data-testid="status-cinema-os-dna-error">Your private signals could not be read right now. Your local notes are still safe; try the Cinema Graph when your viewing room is available.</p>
                ) : !isSignedIn ? (
                  <p className="mt-5 max-w-lg font-display text-3xl font-medium uppercase leading-[0.98] tracking-[-0.05em] sm:text-5xl" data-testid="status-cinema-os-dna-signed-out">Sign in to turn your choices into a pattern.</p>
                ) : profileActivityState === "empty" ? (
                  <p className="mt-5 max-w-lg font-display text-3xl font-medium uppercase leading-[0.98] tracking-[-0.05em] sm:text-5xl" data-testid="status-cinema-os-dna-empty">Your pattern begins with the first film you rate or keep.</p>
                ) : (
                  <p className="mt-5 max-w-lg font-display text-3xl font-medium uppercase leading-[0.98] tracking-[-0.05em] sm:text-5xl" data-testid="text-cinema-os-dna-summary">
                    {watchedCount} watched, {ratedCount} rated, {queuedCount} waiting. Your cinema is taking shape.
                  </p>
                )}
                <div className="mt-8 flex flex-wrap gap-2">
                  {[
                    isSignedIn ? `${watchedCount} watched` : "Private by design",
                    isSignedIn ? `${ratedCount} rated` : "Sign in to map taste",
                    isSignedIn ? `${queuedCount} in the queue` : "Your choices, connected",
                  ].map((signal, index) => <span key={signal} className="border border-primary/30 bg-primary/[0.05] px-3 py-2 text-[0.61rem] font-bold uppercase tracking-[0.12em] text-primary" data-testid={`text-cinema-os-dna-signal-${index}`}>{signal}</span>)}
                </div>
              </div>
              <div className="border-t border-border/70 p-6 sm:border-l sm:border-t-0 sm:p-8">
                <div className="flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"><span>Signal strength</span><span className="text-primary">{isSignedIn ? "from your activity" : "awaiting you"}</span></div>
                <div className="mt-6 space-y-5">
                  {dnaMeters.map(([label, value]) => <div key={label} data-testid={`meter-cinema-os-dna-${label.toLowerCase()}`}><div className="mb-2 flex justify-between text-[0.6rem] font-bold uppercase tracking-[0.13em]"><span>{label}</span><span className="text-primary">{value}%</span></div><div className="h-1 bg-muted"><div className="h-1 bg-primary transition-all" style={{ width: `${value}%` }} /></div></div>)}
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between border border-primary/35 bg-primary/[0.045] p-6 sm:p-8">
              <div><Compass className="h-6 w-6 text-primary" aria-hidden="true" /><p className="mt-6 font-display text-2xl font-medium uppercase leading-none">See the whole constellation.</p><p className="mt-4 text-sm leading-6 text-muted-foreground">Films, people, genres, decades, and the links you did not notice at first.</p></div>
              <OsLink href="/profiles/graph" testId="link-cinema-os-cinema-dna">Open Cinema Graph</OsLink>
            </div>
          </div>
        </section>

        <section className="border-x border-b border-border/70 p-6 sm:p-9" aria-labelledby="afterglow-title">
          <ModuleHeader index="03" eyebrow="Afterglow" title="Keep the feeling after the credits." note="A private post-screening note. No public review pressure, no star to perform for." icon={NotebookPen} />
          <div className="mt-9 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="cinema-os-panel p-5 sm:p-7">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">Writing about</p>
              {afterglowFilm ? (
                <div className="mt-5 grid grid-cols-[4.8rem_minmax(0,1fr)] items-start gap-4">
                  <img src={tmdbPosterUrl(afterglowFilm.posterPath, "w342")} alt="" className="cinema-os-poster" data-testid={`img-cinema-os-afterglow-${afterglowFilm.id}`} />
                  <div><p className="font-display text-xl font-semibold uppercase leading-none" data-testid="text-cinema-os-afterglow-film">{afterglowFilm.title}</p><p className="mt-2 text-[0.61rem] font-bold uppercase tracking-[0.13em] text-muted-foreground">{formatYear(afterglowFilm.releaseDate)}</p></div>
                </div>
              ) : <p className="mt-5 text-sm text-muted-foreground" data-testid="status-cinema-os-afterglow-empty">Choose a film above to begin a note.</p>}
              <p className="mt-6 text-xs leading-6 text-muted-foreground">Saved locally on this device. Your note is not a server review.</p>
            </div>
            <div className="cinema-os-panel p-5 sm:p-7">
              <label htmlFor="afterglow-note" className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">One honest sentence</label>
              <textarea id="afterglow-note" value={afterglow.note} onChange={(event) => setAfterglow((current) => ({ ...current, note: event.target.value }))} placeholder="What stayed with you?" rows={6} className="cinema-os-input mt-4 resize-y" data-testid={CINEMA_OS_TEST_IDS.afterglowInput} />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[0.61rem] text-muted-foreground" data-testid="status-cinema-os-save">{savedMessage || (afterglow.updatedAt ? `Last saved ${new Date(afterglow.updatedAt).toLocaleDateString()}.` : "Nothing saved yet.")}</p><button type="button" onClick={saveAfterglow} className="inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-4 text-[0.63rem] font-bold uppercase tracking-[0.15em] text-primary-foreground hover:bg-primary/85" data-testid={CINEMA_OS_TEST_IDS.afterglowSaveButton}><Check className="h-4 w-4" /> Save afterglow</button></div>
            </div>
          </div>
        </section>

        <section className="border-x border-b border-border/70 p-6 sm:p-9" aria-labelledby="double-feature-title">
          <ModuleHeader index="04" eyebrow="Double Feature Builder" title="Put two films in conversation." note="The first film sets the question. The second film gets to answer, disagree, or complicate it." icon={GitCompare} />
          {films.length < 2 ? (
            <div className="mt-9 border-l-2 border-primary/60 px-4 py-4 text-sm leading-6 text-muted-foreground" data-testid="status-cinema-os-double-feature-empty">Two live catalogue films are needed to build a pairing.</div>
          ) : (
            <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
              {[0, 1].map((slot) => (
                <div key={slot} className="cinema-os-panel p-5 sm:p-7" data-testid={`panel-cinema-os-feature-${slot + 1}`}>
                  <div className="flex items-center justify-between gap-3"><span className="cinema-os-index">Film {String(slot + 1).padStart(2, "0")}</span><span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{slot === 0 ? "The question" : "The echo"}</span></div>
                  <select value={doubleFeature[slot] ?? ""} onChange={(event) => setDoubleFeature((current) => { const next: [number | null, number | null] = [...current]; next[slot] = event.target.value ? Number(event.target.value) : null; return next; })} className="cinema-os-input mt-5" aria-label={`Choose film ${slot + 1}`} data-testid={CINEMA_OS_TEST_IDS.featureSelect(slot + 1)}>
                    <option value="">Choose from the live signal</option>
                    {films.slice(0, 8).map((film) => <option key={film.id} value={film.id}>{film.title}</option>)}
                  </select>
                  {(slot === 0 ? selectedFirst : selectedSecond) ? <p className="mt-5 font-display text-2xl font-semibold uppercase leading-none">{slot === 0 ? selectedFirst?.title : selectedSecond?.title}</p> : <p className="mt-5 text-sm leading-6 text-muted-foreground">The empty chair is part of the ritual.</p>}
                </div>
              ))}
              <div className="flex items-center justify-center lg:px-1"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/55 text-primary"><GitCompare className="h-4 w-4" aria-hidden="true" /></div></div>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-lg text-xs leading-6 text-muted-foreground" data-testid="text-cinema-os-feature-status">{featureReady ? `${selectedFirst?.title} meets ${selectedSecond?.title}.` : "Choose two different films to give the evening a shape."}</p>
            <button type="button" onClick={saveDoubleFeature} disabled={!featureReady} className="inline-flex min-h-11 items-center justify-center gap-2 border border-primary/55 px-4 text-[0.63rem] font-bold uppercase tracking-[0.15em] text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40" data-testid={CINEMA_OS_TEST_IDS.featureSaveButton}><Bookmark className="h-4 w-4" /> Hold this pairing</button>
          </div>
        </section>

        <section className="border-x border-b border-border/70 p-6 sm:p-9" aria-labelledby="context-title">
          <ModuleHeader index="05" eyebrow="Context, not clutter" title="A few ways further in." note="Open a door when you want more than the title: craft, spoilers, company, or a place to watch." icon={Layers3} />
          <div className="mt-9 grid gap-px overflow-hidden border border-border/70 bg-border/70 md:grid-cols-2">
            <div className="cinema-os-module bg-card p-6 sm:p-8"><Eye className="h-5 w-5 text-primary" /><h3 className="mt-5 font-display text-2xl font-medium uppercase">Craft Lens</h3><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Look closer at the work: framing, edit, sound, performance, and the choices hiding in plain sight.</p><OsLink href={leadFilm ? withMovieTitle(`/movies/${leadFilm.id}`, leadFilm.title) : "/discover"} testId="link-cinema-os-craft-lens">Open a film</OsLink></div>
            <div className="cinema-os-module bg-card p-6 sm:p-8"><LockKeyhole className="h-5 w-5 text-primary" /><h3 className="mt-5 font-display text-2xl font-medium uppercase">Spoiler Vault</h3><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Write the thing you cannot say out loud yet. It stays collapsed until you decide otherwise.</p><button type="button" onClick={() => setSpoilerOpen((open) => !open)} className="cinema-os-small-link mt-4" aria-expanded={spoilerOpen} data-testid={CINEMA_OS_TEST_IDS.spoilerToggleButton}>{spoilerOpen ? "Close vault" : "Open vault"} <ChevronRight className={`h-3.5 w-3.5 transition-transform ${spoilerOpen ? "rotate-90" : ""}`} /></button>{spoilerOpen && <div className="mt-4 border-t border-border/60 pt-4"><textarea value={spoilerNote} onChange={(event) => setSpoilerNote(event.target.value)} rows={4} className="cinema-os-input" placeholder="Spoilers live here." data-testid={CINEMA_OS_TEST_IDS.spoilerInput} /><button type="button" onClick={saveSpoilerNote} className="mt-3 inline-flex min-h-10 items-center gap-2 border border-border px-3 text-[0.6rem] font-bold uppercase tracking-wider hover:border-primary hover:text-primary" data-testid={CINEMA_OS_TEST_IDS.spoilerSaveButton}>Save vault note</button></div>}</div>
            <div className="cinema-os-module bg-card p-6 sm:p-8"><Users className="h-5 w-5 text-primary" /><h3 className="mt-5 font-display text-2xl font-medium uppercase">Watch Room</h3><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Bring another person into the choice. Compare taste, make a plan, and start the same film together.</p><OsLink href="/friends" testId="link-cinema-os-watch-room">Enter Watch Room</OsLink></div>
            <div className="cinema-os-module bg-card p-6 sm:p-8"><GitCompare className="h-5 w-5 text-primary" /><h3 className="mt-5 font-display text-2xl font-medium uppercase">Taste Compatibility</h3><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">A conversation starter for two cinema universes. Find the overlap without flattening either taste.</p><OsLink href="/friends" testId="link-cinema-os-compatibility">Compare with a friend</OsLink></div>
          </div>
        </section>

        <section className="border-x border-b border-border/70 p-6 sm:p-9" aria-labelledby="journey-title">
          <ModuleHeader index="06" eyebrow="The journey" title="Your cinema has more than one horizon." note="Move outward from tonight: across places, through time, toward people, and into the work itself." icon={Map} />
          <div className="mt-9 grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
            <div className="cinema-os-panel min-h-[17rem] p-6 sm:p-8"><Map className="h-5 w-5 text-primary" /><p className="mt-7 text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">Cinema Atlas</p><h3 className="mt-3 max-w-sm font-display text-4xl font-medium uppercase leading-[0.92] tracking-[-0.05em]">Follow the film across borders.</h3><p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">A geography of the stories you seek, and the places your taste has not reached yet.</p><OsLink href="/discover" testId="link-cinema-os-atlas" /></div>
            <div className="cinema-os-panel min-h-[17rem] p-6 sm:p-8"><Ticket className="h-5 w-5 text-primary" /><p className="mt-7 text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">Cinema Passport</p><div className="mt-3 flex items-end gap-2"><span className="font-display text-6xl font-medium leading-none text-foreground" data-testid="text-cinema-os-passport-count">{passportCount}</span><span className="pb-1 text-[0.62rem] font-bold uppercase tracking-[0.13em] text-muted-foreground">stamps</span></div><p className="mt-4 text-sm leading-6 text-muted-foreground">Keep a private count of the places your watching has taken you.</p><button type="button" onClick={() => { const next = passportCount + 1; setPassportCount(next); saveCinemaLocal(window.localStorage, STORAGE_KEYS.passport, next); setSavedMessage("Passport stamp added."); }} className="cinema-os-small-link mt-4" data-testid={CINEMA_OS_TEST_IDS.passportStampButton}>Add a stamp <Check className="h-3.5 w-3.5" /></button></div>
            <div className="cinema-os-panel min-h-[17rem] p-6 sm:p-8"><BookOpen className="h-5 w-5 text-primary" /><p className="mt-7 text-[0.62rem] font-bold uppercase tracking-[0.17em] text-primary">Personal Curriculum</p><h3 className="mt-3 font-display text-3xl font-medium uppercase leading-[0.92]">A route, not a syllabus.</h3><p className="mt-4 text-sm leading-6 text-muted-foreground">Six considered steps, chosen to widen the eye without losing the thread.</p><div className="mt-5 h-1 bg-muted"><div className="h-1 bg-primary transition-all" style={{ width: `${(curriculumProgress / 6) * 100}%` }} /></div><button type="button" onClick={markCurriculum} disabled={curriculumProgress >= 6} className="cinema-os-small-link mt-4 disabled:opacity-45" data-testid={CINEMA_OS_TEST_IDS.curriculumProgressButton}>{curriculumProgress >= 6 ? "Route complete" : `Mark step ${curriculumProgress}` } <ChevronRight className="h-3.5 w-3.5" /></button></div>
          </div>
        </section>

        <section className="border-x border-b border-border/70 p-6 sm:p-9" aria-labelledby="curator-title">
          <ModuleHeader index="07" eyebrow="Human Curator Tracks" title="Someone thought about the sequence." note="Short routes with a point of view. Less volume, more intention." icon={Palette} />
          <div className="mt-9 grid gap-0 border-y border-border/70">
            {CURATOR_TRACKS.map((track, index) => <div key={track.title} className="group grid gap-4 border-b border-border/70 py-6 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center" data-testid={`row-cinema-os-curator-${index}`}><span className="cinema-os-index">{track.mark}</span><div><h3 className="font-display text-2xl font-medium uppercase tracking-[-0.03em] group-hover:text-primary">{track.title}</h3><p className="mt-2 text-sm text-muted-foreground">{track.note}</p></div><Link href="/discover" className="cinema-os-small-link" data-testid={`link-cinema-os-curator-${index}`}>Follow track <ChevronRight className="h-3.5 w-3.5" /></Link></div>)}
          </div>
        </section>

        <section className="grid gap-0 border-x border-b border-border/70 md:grid-cols-2">
          <div className="cinema-os-module p-6 sm:p-9"><div className="flex items-start justify-between gap-4"><div><p className="editorial-kicker"><Film className="h-3.5 w-3.5" /> Creator-to-Audience Bridge</p><h2 className="mt-4 max-w-md font-display text-3xl font-medium uppercase leading-[0.94] tracking-[-0.045em] sm:text-5xl">Meet the people behind the frame.</h2></div><Users className="hidden h-6 w-6 text-primary sm:block" /></div><p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">Read a filmmaker’s own context, follow the craft, and find the human thread between a finished film and the audience it is looking for.</p><OsLink href="/professionals" testId="link-cinema-os-creators">Explore professionals</OsLink></div>
          <div className="cinema-os-module border-t border-border/70 p-6 sm:p-9 md:border-l md:border-t-0"><div className="flex items-start justify-between gap-4"><div><p className="editorial-kicker"><Ticket className="h-3.5 w-3.5" /> BookMyShow handoff</p><h2 className="mt-4 max-w-md font-display text-3xl font-medium uppercase leading-[0.94] tracking-[-0.045em] sm:text-5xl">Ready to leave the desk?</h2></div><ExternalLink className="hidden h-6 w-6 text-primary sm:block" /></div><p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground">FILMIO does not claim live BookMyShow showtimes. This is an outbound handoff only, until official partner access exists.</p><a href="https://in.bookmyshow.com/" target="_blank" rel="noreferrer" className="cinema-os-small-link mt-5" data-testid="link-cinema-os-bookmyshow">Open BookMyShow <ExternalLink className="h-3.5 w-3.5" /></a></div>
        </section>

        <div className="flex flex-col gap-4 border-x border-b border-primary/30 bg-primary/[0.045] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-9" data-testid="status-cinema-os-local-storage">
          <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-xs leading-6 text-muted-foreground">Notes, pairings, passport stamps, and curriculum progress are stored locally on this device. FILMIO is not presenting them as synced account data.</p></div>
          <Link href="/discover" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-primary hover:text-primary/75" data-testid="link-cinema-os-keep-exploring">Keep exploring <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      </main>
    </div>
  );
}