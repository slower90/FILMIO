import { useUser } from "@clerk/react";
import {
  getGetSurprisePickQueryKey,
  GetSurprisePickLens,
  useGetSurprisePick,
  type GetSurprisePickLens as SurpriseLens,
} from "@workspace/api-client-react";
import { ArrowUpRight, ChevronRight, CircleAlert, Clock3, Film, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActiveProfile } from "@/lib/profile-context";
import { withMovieTitle } from "@/lib/movie-links";
import { cn, tmdbBackdropUrl, tmdbPosterUrl } from "@/lib/utils";

type LensOption = {
  value: SurpriseLens;
  label: string;
  note: string;
  mark: string;
};

const LENS_OPTIONS: LensOption[] = [
  { value: GetSurprisePickLens.tonight, label: "Tonight", note: "A confident pick for right now.", mark: "01" },
  { value: GetSurprisePickLens["15-minutes"], label: "15 minutes", note: "Short, sharp, and worth your time.", mark: "02" },
  { value: GetSurprisePickLens["90-minutes"], label: "90 minutes", note: "A full film without the sprawl.", mark: "03" },
  { value: GetSurprisePickLens["3-hours"], label: "Three hours", note: "Give the night room to breathe.", mark: "04" },
  { value: GetSurprisePickLens.obscure, label: "Obscure", note: "A little further off the map.", mark: "05" },
  { value: GetSurprisePickLens.emotional, label: "Emotional", note: "For when you want to feel something.", mark: "06" },
  { value: GetSurprisePickLens["visually-insane"], label: "Visually insane", note: "Let the frame do the talking.", mark: "07" },
  { value: GetSurprisePickLens["everyone-missed"], label: "Everyone missed", note: "The one that slipped through.", mark: "08" },
  { value: GetSurprisePickLens.india, label: "From India", note: "A strong voice from the subcontinent.", mark: "09" },
  { value: GetSurprisePickLens["outside-taste"], label: "Outside your taste", note: "A considered step sideways.", mark: "10" },
];

function nextSeed() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatRuntime(runtime: number | null | undefined) {
  if (!runtime) return "Runtime unavailable";
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatYear(releaseDate: string | null | undefined) {
  if (!releaseDate) return null;
  const year = new Date(releaseDate).getFullYear();
  return Number.isNaN(year) ? null : year;
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") {
    return error.error;
  }
  return "The catalog did not return a pick this time.";
}

function ResultSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-[5.6rem_minmax(0,1fr)] gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8" aria-label="Loading your film pick" role="status">
      <div className="aspect-[2/3] bg-muted/80" />
      <div className="space-y-4 pt-2">
        <div className="h-3 w-28 bg-muted/80" />
        <div className="h-10 w-4/5 bg-muted/80 sm:h-14" />
        <div className="h-3 w-2/3 bg-muted/80" />
        <div className="h-16 w-full bg-muted/60" />
      </div>
    </div>
  );
}

function EmptyState({ onTryAgain }: { onTryAgain: () => void }) {
  return (
    <div className="flex min-h-[19rem] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[23rem]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center border border-border bg-muted/30 text-primary">
        <Film className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="cinema-kicker">A quiet corner of the catalog</p>
      <h3 className="mt-3 font-display text-2xl font-semibold uppercase tracking-tight">Nothing landed</h3>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        We could not find a live film for this lens. Try a different angle and we will look again.
      </p>
      <button
        type="button"
        onClick={onTryAgain}
        className="mt-7 inline-flex min-h-11 items-center gap-2 border border-primary/45 px-5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10"
      >
        Try this lens again
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function SurpriseMe({ className }: { className?: string }) {
  const { isLoaded } = useUser();
  const { activeProfile } = useActiveProfile();
  const [open, setOpen] = useState(false);
  const [lens, setLens] = useState<SurpriseLens>(GetSurprisePickLens.tonight);
  const [avoidMovieId, setAvoidMovieId] = useState<number | undefined>();
  const [seed, setSeed] = useState(nextSeed);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const params = useMemo(
    () => ({
      lens,
      ...(activeProfile ? { profileId: activeProfile.id } : {}),
      ...(avoidMovieId ? { avoidMovieId } : {}),
      seed,
    }),
    [activeProfile, avoidMovieId, lens, seed],
  );

  const surprisePick = useGetSurprisePick(params, {
      query: {
        enabled: open && isLoaded,
      queryKey: getGetSurprisePickQueryKey(params),
    },
  });
  const { data, error, isError, isFetching, isLoading, refetch } = surprisePick;

  useEffect(() => {
    if (open && data?.movie?.id && !isFetching) titleRef.current?.focus();
  }, [data?.movie?.id, isFetching, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !data) {
      setSeed(nextSeed());
      setAvoidMovieId(undefined);
    }
  };

  const chooseLens = (nextLens: SurpriseLens) => {
    if (nextLens === lens) return;
    setLens(nextLens);
    setAvoidMovieId(undefined);
    setSeed(nextSeed());
  };

  const chooseAgain = () => {
    if (!data?.movie?.id) return;
    setAvoidMovieId(data.movie.id);
    setSeed(nextSeed());
  };

  const hasPick = Boolean(data?.movie?.id);
  const year = formatYear(data?.movie?.releaseDate);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex min-h-11 items-center gap-2 border border-primary/45 bg-primary/5 px-3.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary transition-colors hover:border-primary hover:bg-primary/12",
            className,
          )}
          aria-label="Open SURPRISE ME film picker"
          data-testid="button-surprise-me"
        >
          <Sparkles className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" aria-hidden="true" />
          <span>SURPRISE ME</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl gap-0 overflow-hidden border-primary/20 bg-[hsl(var(--surface-deep))] p-0 shadow-[0_24px_90px_-36px_hsl(var(--primary)/0.35)]">
        <div className="max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/80 px-5 pb-5 pt-7 text-left sm:px-8 sm:pb-6 sm:pt-8">
            <div className="flex items-start justify-between gap-8 pr-8">
              <div>
                <p className="cinema-kicker flex items-center gap-2">
                  <span className="h-px w-6 bg-primary" aria-hidden="true" />
                  FILMIO / one good instinct
                </p>
                <DialogTitle className="mt-4 max-w-2xl font-display text-3xl font-medium uppercase tracking-[-0.045em] sm:text-5xl">
                  Find your next film
                </DialogTitle>
                <DialogDescription className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Choose a lens. We will return one live catalog film, with the reason it made the cut.
                </DialogDescription>
              </div>
              <div className="hidden pt-1 text-right sm:block">
                <span className="block font-display text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">10 lenses</span>
                <span className="mt-2 block font-display text-3xl font-semibold text-primary">01</span>
              </div>
            </div>
          </DialogHeader>

          <section className="grid lg:grid-cols-[minmax(15rem,0.62fr)_minmax(0,1.38fr)]" aria-label="Surprise film picker">
            <div className="border-b border-border/80 bg-[hsl(var(--card)/0.42)] p-5 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary">Choose a lens</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The mood is yours. The title is ours.</p>
                </div>
                <span className="font-display text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">01 / 10</span>
              </div>

              <div className="mt-5 grid gap-1.5" role="radiogroup" aria-label="Film discovery lens">
                {LENS_OPTIONS.map((option) => {
                  const selected = option.value === lens;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseLens(option.value)}
                      className={cn(
                        "group flex min-h-[3.5rem] items-center gap-3 border px-3 text-left transition-colors motion-reduce:transition-none",
                        selected
                          ? "border-primary/65 bg-primary/10 text-foreground"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-background/40 hover:text-foreground",
                      )}
                      data-testid={`button-surprise-lens-${option.value}`}
                    >
                      <span className={cn("w-5 font-display text-[0.58rem] font-bold tracking-[0.12em]", selected ? "text-primary" : "text-muted-foreground/55")}>{option.mark}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[0.72rem] font-semibold uppercase tracking-[0.09em]">{option.label}</span>
                        <span className={cn("mt-1 block truncate text-[0.65rem] leading-none", selected ? "text-muted-foreground" : "text-muted-foreground/70")}>{option.note}</span>
                      </span>
                      <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none", selected ? "translate-x-0 text-primary" : "-translate-x-1 text-muted-foreground/50 group-hover:translate-x-0")} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative min-h-[24rem] bg-background">
              {!isLoaded || isLoading || isFetching ? (
                <div className="p-5 sm:p-8">
                  <ResultSkeleton />
                </div>
              ) : isError ? (
                <div className="flex min-h-[19rem] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[23rem]">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center border border-destructive/35 bg-destructive/10 text-destructive">
                    <CircleAlert className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="cinema-kicker text-destructive">Catalog signal interrupted</p>
                  <h3 className="mt-3 font-display text-2xl font-semibold uppercase tracking-tight">The reel went quiet</h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{getErrorMessage(error)}</p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-7 inline-flex min-h-11 items-center gap-2 border border-primary/45 px-5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10"
                  >
                    Try again
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : !hasPick ? (
                <EmptyState onTryAgain={() => void refetch()} />
              ) : data ? (
                <div className="relative overflow-hidden">
                  {data.movie.backdropPath && (
                    <img
                      src={tmdbBackdropUrl(data.movie.backdropPath, "w1280")}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-[22rem] w-full object-cover opacity-25 sm:h-[26rem]"
                    />
                  )}
                  <div className="absolute inset-0 h-[22rem] bg-gradient-to-b from-background/15 via-background/85 to-background sm:h-[26rem]" aria-hidden="true" />
                  <div className="relative p-5 pt-9 sm:p-8 sm:pt-12">
                    <div className="grid grid-cols-[5.6rem_minmax(0,1fr)] items-start gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
                      <Link
                        href={withMovieTitle(`/movies/${data.movie.id}`, data.movie.title)}
                        className="poster-lift block border border-border/80 bg-muted focus-visible:outline-offset-2"
                        aria-label={`Open ${data.movie.title}`}
                      >
                        <img
                          src={tmdbPosterUrl(data.movie.posterPath, "w342")}
                          alt={`${data.movie.title} poster`}
                          className="aspect-[2/3] w-full object-cover"
                        />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.61rem] font-bold uppercase tracking-[0.16em] text-primary">
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            {data.lensLabel || LENS_OPTIONS.find((option) => option.value === lens)?.label}
                          </span>
                          <span className="text-muted-foreground">{data.personalized ? "Personalized" : "Catalog fallback"}</span>
                        </div>
                        <h2 ref={titleRef} tabIndex={-1} className="mt-3 font-display text-2xl font-semibold uppercase leading-[0.96] tracking-[-0.045em] outline-none sm:text-5xl">
                          {data.movie.title}
                        </h2>
                        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.64rem] font-bold uppercase tracking-[0.13em] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                            {formatRuntime(data.movie.runtime)}
                          </span>
                          {year && <><span aria-hidden="true" className="text-primary/70">/</span><span>{year}</span></>}
                          {data.movie.voteAverage > 0 && <><span aria-hidden="true" className="text-primary/70">/</span><span>{data.movie.voteAverage.toFixed(1)} score</span></>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-9 border-l-2 border-primary bg-card/55 px-4 py-4 sm:mt-12 sm:px-5">
                      <p className="text-[0.61rem] font-bold uppercase tracking-[0.18em] text-primary">Why this one</p>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85">{data.explanation}</p>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {data.movie.genres.map((genre) => (
                        <span key={genre.id} className="border border-border/80 px-2.5 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {genre.name}
                        </span>
                      ))}
                      {data.signals.slice(0, 3).map((signal) => (
                        <span key={signal} className="border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-primary">
                          {signal}
                        </span>
                      ))}
                    </div>

                    <div className="mt-8 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        href={withMovieTitle(`/movies/${data.movie.id}`, data.movie.title)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 bg-primary px-5 text-[0.67rem] font-bold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/85 sm:justify-start"
                        data-testid="link-surprise-movie"
                      >
                        Open film
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={chooseAgain}
                        disabled={isFetching}
                        className="inline-flex min-h-11 items-center justify-center gap-2 border border-border px-4 text-[0.67rem] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:cursor-wait disabled:opacity-55 sm:justify-start"
                        data-testid="button-surprise-again"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Choose again
                      </button>
                    </div>

                    <p className="mt-5 flex items-start gap-2 text-[0.6rem] leading-relaxed text-muted-foreground">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 bg-primary" aria-hidden="true" />
                      {data.metadata.stale ? "Catalog data is currently cached; this is still one real catalog film." : "Selected from FILMIO's live catalog."}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SurpriseMe;