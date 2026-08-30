import { useInfiniteQuery } from "@tanstack/react-query";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { Film, Loader2, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { FreeClassic, FreeClassicSource, FreeClassicsResponse } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api-url";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SourceFilter = "all" | FreeClassicSource;
const PAGE_SIZE = 20;

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "archive", label: "Internet Archive" },
  { value: "youtube", label: "YouTube" },
  { value: "wikimedia", label: "Wikimedia Commons" },
];

async function fetchFreeClassics(page: number, source: SourceFilter): Promise<FreeClassicsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (source !== "all") params.set("source", source);
  const response = await apiFetch(`/api/free-classics?${params.toString()}`);
  if (!response.ok) throw new Error("Unable to load Free Classics");
  const data = (await response.json()) as Partial<FreeClassicsResponse>;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    fetchedAt: data.fetchedAt ?? "",
    page: data.page ?? page,
    totalPages: data.totalPages ?? page,
    totalResults: data.totalResults ?? data.items?.length ?? 0,
  };
}

function sourceMimeType(item: FreeClassic): string {
  const source = item.mediaUrl ?? item.embedUrl;
  if (/\.webm(?:[?#]|$)/i.test(source)) return "video/webm";
  if (/\.ogv(?:[?#]|$)/i.test(source)) return "video/ogg";
  return "video/mp4";
}

function FreeClassicsVideoPlayer({ item }: { item: FreeClassic }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  useEffect(() => {
    if (!videoRef.current || !item.mediaUrl) return;
    const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      preload: "metadata",
      poster: item.posterUrl,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      sources: [{ src: item.mediaUrl, type: sourceMimeType(item) }],
      controlBar: {
        children: [
          "playToggle",
          "progressControl",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "playbackRateMenuButton",
          "fullscreenToggle",
        ],
      },
    });
    playerRef.current = player;
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [item]);

  if (!item.mediaUrl) {
    return (
      <iframe
        src={item.embedUrl}
        title={`Play ${item.title}`}
        className="h-full w-full"
        allow="fullscreen; autoplay"
        allowFullScreen
        data-testid={`iframe-free-classic-${item.source}-${item.identifier}`}
      />
    );
  }

  return (
    <div className="filmio-video-player h-full w-full" data-vjs-player>
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered h-full w-full"
        playsInline
        aria-label={`Play ${item.title}`}
        data-testid={`video-free-classic-${item.source}-${item.identifier}`}
      />
    </div>
  );
}

export function FreeClassicsCard({ item }: { item: FreeClassic }) {
  const sourceName = item.sourceLabel || SOURCE_FILTERS.find((filter) => filter.value === item.source)?.label || "Free source";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group w-[9.2rem] flex-none text-left sm:w-40 md:w-44"
          data-testid={`card-free-classic-${item.source}-${item.identifier}`}
          aria-label={`Play ${item.title}, ${item.year ?? "classic film"}, from ${sourceName}`}
        >
          <div className="poster-shell poster-lift relative aspect-[2/3] overflow-hidden rounded-[0.35rem] border border-border/70">
            {item.posterUrl ? (
              <img
                src={item.posterUrl}
                alt={`${item.title} poster`}
                width={342}
                height={513}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground"><Film aria-hidden="true" /></div>
            )}
            <div className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-primary px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Free &amp; Legal
              </span>
              <span className="inline-flex w-fit max-w-full truncate rounded-sm border border-primary/50 bg-background/85 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary backdrop-blur">
                {item.licenseLabel}
              </span>
            </div>
            <span className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-display font-semibold uppercase leading-tight tracking-[0.08em] transition-colors group-hover:text-primary">{item.title}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.year ?? "Classic"} · {sourceName}</p>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl border-primary/25 bg-background p-4 sm:p-6" data-testid={`dialog-free-classic-${item.source}-${item.identifier}`}>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl uppercase tracking-wider">{item.title}</DialogTitle>
          <DialogDescription>
            {item.year ? `${item.year} · ` : ""}{item.creator ? `${item.creator} · ` : ""}{item.licenseLabel} · {sourceName}
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden border border-border bg-black">
          {item.playback === "video" ? <FreeClassicsVideoPlayer item={item} /> : (
            <iframe
              src={item.embedUrl}
              title={`Watch ${item.title} on ${sourceName}`}
              className="h-full w-full"
              allow="fullscreen; autoplay"
              allowFullScreen
              data-testid={`iframe-free-classic-${item.source}-${item.identifier}`}
            />
          )}
        </div>
        {item.description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center border border-primary/50 px-4 text-xs font-bold uppercase tracking-wider text-primary hover:border-primary hover:bg-primary/10"
          >
            View source
          </a>
          <DialogClose asChild>
            <button type="button" className="min-h-11 border border-border px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary" data-testid={`button-close-free-classic-${item.source}-${item.identifier}`}>
              Close player
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FreeClassicsSection({ fullPage = false }: { fullPage?: boolean }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const query = useInfiniteQuery<FreeClassicsResponse>({
    queryKey: ["free-classics", sourceFilter],
    queryFn: ({ pageParam }) => fetchFreeClassics(Number(pageParam), sourceFilter),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30 * 60 * 1000,
  });
  const allItems = query.data?.pages.flatMap((page) => page.items) ?? [];
  const seen = new Set<string>();
  const uniqueItems = allItems.filter((item) => {
    const key = `${item.source}:${item.identifier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const items = fullPage ? uniqueItems : uniqueItems.slice(0, 10);

  return (
    <section className={fullPage ? "border-t border-border/30 pb-20" : "border-y border-border/30 py-10"} data-testid="free-classics-section">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex items-end justify-between border-l-2 border-primary pl-3">
          <div>
            <p className="cinema-kicker">The free screening room</p>
            <h2 className="mt-2 text-2xl font-display font-bold uppercase tracking-[0.09em] md:text-3xl">Free Classics</h2>
          </div>
          {!fullPage && <Link href="/free-classics" className="inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wider text-primary hover:text-foreground" data-testid="link-see-all-free-classic">
            See All <span aria-hidden="true" className="ml-2">→</span>
          </Link>}
        </div>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">Enduring films from the Internet Archive, verified free-to-watch YouTube channels, and Wikimedia Commons. Every title carries its source and license label.</p>
        {fullPage && (
          <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Filter Free Classics by source" data-testid="free-classics-source-filters">
            {SOURCE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={sourceFilter === filter.value}
                onClick={() => setSourceFilter(filter.value)}
                className={`min-h-11 border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${sourceFilter === filter.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                data-testid={`filter-free-classics-${filter.value}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
        {query.isLoading ? (
          <div className="flex gap-3 overflow-hidden" data-testid="free-classics-loading">{Array.from({ length: fullPage ? 8 : 6 }).map((_, index) => <div key={index} className="w-[9.2rem] flex-none sm:w-40 md:w-44"><div className="aspect-[2/3] animate-pulse rounded bg-muted" /><div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" /></div>)}</div>
        ) : query.isError ? (
          <div className="flex items-center gap-3 border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="free-classics-error"><p>Free Classics are temporarily unavailable.</p><button type="button" onClick={() => query.refetch()} className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-foreground" data-testid="button-retry-free-classics"><RotateCcw className="h-3.5 w-3.5" /> Retry</button></div>
        ) : items.length === 0 ? (
          <p className="border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="free-classics-empty">{sourceFilter === "all" ? "No Free Classics are available right now." : "No films are available from this source right now."}</p>
        ) : (
           <div className={fullPage ? "grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6" : "flex gap-3 overflow-x-auto pb-4 [scrollbar-width:none]"} aria-label="Free Classics films" data-testid="free-classics-grid">
            {items.map((item) => <FreeClassicsCard key={`${item.source}:${item.identifier}`} item={item} />)}
          </div>
        )}
         {fullPage && query.hasNextPage && (
           <div className="mt-10 flex justify-center">
             <button
               type="button"
               onClick={() => query.fetchNextPage()}
               disabled={query.isFetchingNextPage}
               className="inline-flex min-h-11 items-center gap-2 border border-primary/50 px-5 text-xs font-bold uppercase tracking-wider text-primary transition hover:border-primary hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
               data-testid="button-load-more-free-classics"
             >
               {query.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
               {query.isFetchingNextPage ? "Loading screening room" : "Load more classics"}
             </button>
           </div>
         )}
         {fullPage && !query.hasNextPage && items.length > 0 && (
           <p className="mt-10 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">End of the available screening room</p>
         )}
      </div>
    </section>
  );
}