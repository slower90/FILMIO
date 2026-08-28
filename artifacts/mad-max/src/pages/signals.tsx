import { useMemo } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clapperboard,
  Radar,
  RefreshCw,
} from "lucide-react";
import {
  getListSignalsQueryKey,
  type Signal,
  type SignalsResponse,
  useListSignals,
  useMarkAllSignalsRead,
  useMarkSignalRead,
} from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { useActiveProfile } from "@/lib/profile-context";
import { tmdbPosterUrl } from "@/lib/utils";
import { withMovieTitle } from "@/lib/movie-links";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  "review-agreement": "A shared read",
  "review-conversation": "A conversation moved",
  "rated-trending": "A title is moving",
  "director-release": "A director returns",
  "taste-graph": "A taste connection",
};

function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

function readableKind(kind: Signal["kind"]): string {
  return KIND_LABELS[kind] ?? "A new signal";
}

function internalHref(signal: Signal): string | null {
  if (signal.href && signal.href.startsWith("/") && !signal.href.startsWith("//")) {
    return signal.href;
  }
  if (signal.movieId && signal.movieTitle) {
    return withMovieTitle(`/movies/${signal.movieId}`, signal.movieTitle);
  }
  return null;
}

function SignalPoster({ signal }: { signal: Signal }) {
  if (!signal.moviePosterPath) {
    return (
      <div className="signal-poster signal-poster--empty" aria-hidden="true">
        <Clapperboard className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={tmdbPosterUrl(signal.moviePosterPath, "w185")}
      alt=""
      className="signal-poster"
      loading="lazy"
      decoding="async"
    />
  );
}

function SignalRow({
  signal,
  index,
  onMarkRead,
}: {
  signal: Signal;
  index: number;
  onMarkRead: (signal: Signal) => void;
}) {
  const href = internalHref(signal);

  return (
    <article className={cn("signal-row", !signal.isRead && "signal-row--unread")}>
      <div className="flex items-start gap-3">
        <span className="signal-index" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <SignalPoster signal={signal} />
      </div>

      <div className="min-w-0">
        <p className="signal-label">{readableKind(signal.kind)}</p>
        <p className="signal-body">{signal.body}</p>
        {signal.movieTitle && href ? (
          <Link
            href={href}
            onClick={() => {
              if (!signal.isRead) onMarkRead(signal);
            }}
            className="signal-movie"
            data-testid={`link-signal-movie-${signal.id}`}
          >
            <span className="truncate">{signal.movieTitle}</span>
            <ArrowUpRight className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          </Link>
        ) : signal.movieTitle ? (
          <p className="signal-movie">
            <span className="truncate">{signal.movieTitle}</span>
          </p>
        ) : null}
        {!signal.isRead && (
          <button
            type="button"
            onClick={() => onMarkRead(signal)}
            className="signal-read-button"
            aria-label={`Mark signal ${index + 1} as seen`}
            data-testid={`button-mark-signal-read-${signal.id}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Mark as seen
          </button>
        )}
      </div>

      <time className="signal-meta" dateTime={signal.createdAt}>
        {timeAgo(signal.createdAt)}
      </time>
    </article>
  );
}

function SignalSkeleton() {
  return (
    <div className="space-y-0 border-y border-border/80" aria-label="Loading signals">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[2.65rem_minmax(0,1fr)] gap-4 border-b border-border/70 p-5 last:border-b-0">
          <div className="h-16 w-10 animate-pulse bg-muted/70" />
          <div className="space-y-3 pt-1">
            <div className="h-2.5 w-28 animate-pulse bg-muted/70" />
            <div className="h-4 w-4/5 animate-pulse bg-muted/70" />
            <div className="h-3 w-32 animate-pulse bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SignedOutSignals() {
  return (
    <div className="mx-auto flex min-h-[58vh] max-w-2xl items-center justify-center px-5 py-24 text-center">
      <div className="w-full border border-border bg-card/45 px-6 py-12 sm:px-14">
        <div className="signals-empty-mark mx-auto mb-8">
          <Radar className="h-7 w-7" strokeWidth={1.4} />
        </div>
        <p className="cinema-kicker">Personal radar</p>
        <h1 className="mt-4 text-3xl font-medium tracking-[-0.04em] sm:text-5xl">
          Your signals live behind the screen.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
          Sign in to keep the small moments that connect your movie life: a review that found its audience, a familiar taste, a title worth catching.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in?redirect=%2Fsignals"
            className="inline-flex min-h-11 items-center justify-center bg-primary px-6 text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/90"
            data-testid="button-sign-in-signals"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up?redirect=%2Fsignals"
            className="inline-flex min-h-11 items-center justify-center border border-border px-6 text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:border-primary hover:text-primary"
            data-testid="button-sign-up-signals"
          >
            Join FILMIO
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Signals() {
  const { isLoaded, isSignedIn } = useUser();
  const { activeProfile } = useActiveProfile();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const profileParams = useMemo(
    () => (activeProfile ? { profileId: activeProfile.id } : undefined),
    [activeProfile],
  );
  const queryKey = getListSignalsQueryKey(profileParams);
  const { data, isLoading, isError, refetch, isFetching } = useListSignals(profileParams, {
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey,
    },
  });
  const markSignalRead = useMarkSignalRead();
  const markAllSignalsRead = useMarkAllSignalsRead();
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markRead = (signal: Signal) => {
    if (signal.isRead || markSignalRead.isPending) return;
    markSignalRead.mutate(
      { id: signal.id },
      {
        onSuccess: (updatedSignal) => {
          queryClient.setQueryData<SignalsResponse>(queryKey, (previous) => {
            if (!previous) return previous;
            return {
              ...previous,
              unreadCount: Math.max(0, previous.unreadCount - 1),
              items: previous.items.map((item) =>
                item.id === updatedSignal.id ? { ...item, isRead: true } : item,
              ),
            };
          });
        },
      },
    );
  };

  const markAllRead = () => {
    if (unreadCount === 0 || markAllSignalsRead.isPending) return;
    markAllSignalsRead.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData<SignalsResponse>(queryKey, (previous) =>
          previous
            ? {
                ...previous,
                unreadCount: 0,
                items: previous.items.map((item) => ({ ...item, isRead: true })),
              }
            : previous,
        );
      },
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <main className="container mx-auto px-5 pb-24 pt-32">
          <SignalSkeleton />
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <main className="signals-page pt-20">
          <SignedOutSignals />
        </main>
      </div>
    );
  }

  return (
    <div className="signals-page min-h-[100dvh] bg-background pb-24">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-5 pb-10 pt-32 sm:px-8">
        <section className="signals-intro-grid border-b border-border/80 pb-12">
          <div>
            <p className="editorial-kicker">Private frequency</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-medium tracking-[-0.07em] sm:text-7xl">
              SIGNALS
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              A quiet record of what is finding its way back to you.
              {activeProfile?.name ? ` Tuned to ${activeProfile.name}.` : ""}
            </p>
          </div>
          <div className="flex items-end justify-between gap-6 sm:justify-end">
            <div className="signals-radar-mark" aria-hidden="true">
              <span />
            </div>
            <div className="pb-1 text-right">
              <p className="text-3xl font-medium tracking-[-0.06em] text-primary">{unreadCount}</p>
              <p className="mt-1 max-w-[8rem] text-[10px] font-bold uppercase leading-relaxed tracking-[0.16em] text-muted-foreground">
                {unreadCount === 1 ? "signal waiting" : "signals waiting"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Latest transmissions</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  The moments worth carrying forward.
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markAllSignalsRead.isPending}
                  className="inline-flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary disabled:cursor-wait disabled:opacity-50"
                  data-testid="button-mark-all-signals-read"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {markAllSignalsRead.isPending ? "Saving" : "Mark all as seen"}
                </button>
              )}
            </div>

            {isLoading ? (
              <SignalSkeleton />
            ) : isError ? (
              <div className="border-y border-border/80 px-5 py-16">
                <CircleAlert className="h-6 w-6 text-primary" aria-hidden="true" />
                <h2 className="mt-5 text-xl font-medium normal-case tracking-tight">The radar went quiet.</h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  We could not tune into your latest signals. Try the frequency again.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary hover:text-foreground"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="border-y border-border/80 px-5 py-16 sm:px-8">
                <div className="signals-empty-mark mb-8">
                  <Radar className="h-6 w-6" strokeWidth={1.4} />
                </div>
                <h2 className="text-2xl font-medium normal-case tracking-tight">Nothing is asking for your attention.</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Keep exploring, rating, and leaving a considered word. The radar will only interrupt when there is something worth seeing.
                </p>
                <button
                  type="button"
                  onClick={() => setLocation("/discover")}
                  className="mt-7 inline-flex min-h-11 items-center gap-2 border-b border-primary/50 text-xs font-bold uppercase tracking-[0.16em] text-primary hover:border-primary"
                >
                  Return to discovery
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="border-b border-border/80">
                {items.map((signal, index) => (
                  <SignalRow key={signal.id} signal={signal} index={index} onMarkRead={markRead} />
                ))}
              </div>
            )}
          </div>

          <aside className="border-t border-border/80 pt-5 lg:border-l lg:border-t-0 lg:pl-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">How it works</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Signals are personal by design. They follow the profiles you watch with, not a general public feed.
            </p>
            <div className="mt-8 space-y-5 border-t border-border/70 pt-5 text-[10px] font-bold uppercase leading-relaxed tracking-[0.13em] text-muted-foreground">
              <p><span className="text-primary">01</span> Meaning before volume</p>
              <p><span className="text-primary">02</span> Your profile, your frequency</p>
              <p><span className="text-primary">03</span> Read when you are ready</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}