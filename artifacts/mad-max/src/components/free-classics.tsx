import { useQuery } from "@tanstack/react-query";
import { Film, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
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

export interface FreeClassic {
  identifier: string;
  title: string;
  description?: string | null;
  year?: number | string | null;
  creator?: string | null;
  posterUrl?: string | null;
  embedUrl: string;
}

interface FreeClassicsResponse {
  items: FreeClassic[];
  fetchedAt: string;
}

async function fetchFreeClassics(): Promise<FreeClassicsResponse> {
  const response = await apiFetch("/api/free-classics");
  if (!response.ok) throw new Error("Unable to load Free Classics");
  const data = (await response.json()) as Partial<FreeClassicsResponse>;
  return { items: Array.isArray(data.items) ? data.items : [], fetchedAt: data.fetchedAt ?? "" };
}

export function FreeClassicsCard({ item }: { item: FreeClassic }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group w-[9.2rem] flex-none text-left sm:w-40 md:w-44"
          data-testid={`card-free-classic-${item.identifier}`}
          aria-label={`Play ${item.title}, ${item.year ?? "classic film"}`}
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
                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> 100% Free &amp; Legal
              </span>
              <span className="inline-flex w-fit rounded-sm border border-primary/50 bg-background/85 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary backdrop-blur">
                Public Domain
              </span>
            </div>
            <span className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-display font-semibold uppercase leading-tight tracking-[0.08em] transition-colors group-hover:text-primary">{item.title}</p>
          {item.year && <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{item.year}</p>}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl border-primary/25 bg-background p-4 sm:p-6" data-testid={`dialog-free-classic-${item.identifier}`}>
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl uppercase tracking-wider">{item.title}</DialogTitle>
          <DialogDescription>
            {item.year ? `${item.year} · ` : ""}{item.creator ? `${item.creator} · ` : ""}100% Free &amp; Legal · Public Domain
          </DialogDescription>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden border border-border bg-black">
          <iframe
            src={item.embedUrl}
            title={`Watch ${item.title} on Internet Archive`}
            className="h-full w-full"
            allow="fullscreen; autoplay"
            allowFullScreen
            data-testid={`iframe-free-classic-${item.identifier}`}
          />
        </div>
        {item.description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
        <DialogClose asChild>
          <button type="button" className="min-h-11 self-start border border-border px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary" data-testid={`button-close-free-classic-${item.identifier}`}>
            Close player
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export function FreeClassicsSection({ fullPage = false }: { fullPage?: boolean }) {
  const query = useQuery<FreeClassicsResponse>({
    queryKey: ["free-classics"],
    queryFn: fetchFreeClassics,
    staleTime: 30 * 60 * 1000,
  });
  const items = fullPage ? query.data?.items ?? [] : (query.data?.items ?? []).slice(0, 10);

  return (
    <section className={fullPage ? "border-t border-border/30 pb-20" : "border-y border-border/30 py-10"} data-testid="free-classics-section">
      <div className="container mx-auto px-4">
        <div className="mb-5 flex items-end justify-between border-l-2 border-primary pl-3">
          <div>
            <p className="cinema-kicker">The archive screening room</p>
            <h2 className="mt-2 text-2xl font-display font-bold uppercase tracking-[0.09em] md:text-3xl">Free Classics</h2>
          </div>
          {!fullPage && <Link href="/free-classics" className="inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wider text-primary hover:text-foreground" data-testid="link-see-all-free-classics">See All <span aria-hidden="true" className="ml-2">→</span></Link>}
        </div>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">Enduring films, ready to watch legally and freely through the Internet Archive.</p>
        {query.isLoading ? (
          <div className="flex gap-3 overflow-hidden" data-testid="free-classics-loading">{Array.from({ length: fullPage ? 8 : 6 }).map((_, index) => <div key={index} className="w-[9.2rem] flex-none sm:w-40 md:w-44"><div className="aspect-[2/3] animate-pulse rounded bg-muted" /><div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" /></div>)}</div>
        ) : query.isError ? (
          <div className="flex items-center gap-3 border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="free-classics-error"><p>Free Classics are temporarily unavailable.</p><button type="button" onClick={() => query.refetch()} className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary hover:text-foreground" data-testid="button-retry-free-classics"><RotateCcw className="h-3.5 w-3.5" /> Retry</button></div>
        ) : items.length === 0 ? (
          <p className="border border-dashed border-border p-6 text-sm text-muted-foreground" data-testid="free-classics-empty">No Free Classics are available right now.</p>
        ) : (
          <div className={fullPage ? "grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6" : "flex gap-3 overflow-x-auto pb-4 [scrollbar-width:none]"} aria-label="Free Classics films" data-testid="free-classics-grid">
            {items.map((item) => <FreeClassicsCard key={item.identifier} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}