import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface ClipItem {
  id: string;
  movieId: number;
  title: string;
  movieTitle: string;
  key: string;
  type: string;
  posterPath?: string | null;
}

type AdTracking = {
  impression: string[];
  start: string[];
  complete: string[];
  skip: string[];
};

type AdCreative = {
  mediaUrl: string;
  tracking: AdTracking;
  skipAfter: number | null;
};

const textContent = (parent: Element, name: string) =>
  parent.querySelector(name)?.textContent?.trim() ?? "";

function parseVast(xml: string): AdCreative | null {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  if (document.querySelector("parsererror")) return null;
  const linear = document.querySelector("Linear");
  const media = Array.from(linear?.querySelectorAll("MediaFile") ?? [])
    .filter((item) => {
      const type = item.getAttribute("type") ?? "";
      return type.startsWith("video/") || type === "";
    })
    .sort((a, b) => Number(b.getAttribute("bitrate") ?? 0) - Number(a.getAttribute("bitrate") ?? 0))[0];
  const mediaUrl = media?.textContent?.trim();
  if (!linear || !mediaUrl) return null;

  const tracking = (event: string) =>
    Array.from(linear.querySelectorAll(`TrackingEvents Tracking[event="${event}"]`))
      .map((item) => item.textContent?.trim())
      .filter((url): url is string => Boolean(url));
  const duration = textContent(linear, "Duration").split(":").map(Number);
  const durationSeconds = duration.length === 3
    ? duration[0] * 3600 + duration[1] * 60 + duration[2]
    : null;
  const skipOffset = linear.getAttribute("skipoffset");
  let skipAfter: number | null = null;
  if (skipOffset?.endsWith("%") && durationSeconds) {
    skipAfter = durationSeconds * Number.parseFloat(skipOffset) / 100;
  } else if (skipOffset?.includes(":")) {
    const parts = skipOffset.split(":").map(Number);
    skipAfter = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : null;
  }

  return {
    mediaUrl,
    skipAfter,
    tracking: {
      impression: Array.from(document.querySelectorAll("Impression"))
        .map((item) => item.textContent?.trim())
        .filter((url): url is string => Boolean(url)),
      start: tracking("start"),
      complete: tracking("complete"),
      skip: tracking("skip"),
    },
  };
}

function track(urls: string[]) {
  urls.forEach((url) => {
    const expanded = url.replace(/\[CACHEBUSTING\]/gi, `${Date.now()}`);
    if (navigator.sendBeacon) navigator.sendBeacon(expanded);
    else void fetch(expanded, { mode: "no-cors", keepalive: true }).catch(() => undefined);
  });
}

export function ClipSection({ clips, isLoading }: { clips: ClipItem[]; isLoading?: boolean }) {
  const [selected, setSelected] = useState<ClipItem | null>(null);
  const [ad, setAd] = useState<AdCreative | null>(null);
  const [adState, setAdState] = useState<"loading" | "playing" | "fallback" | "done">("done");
  const [adTime, setAdTime] = useState(0);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setAd(null);
    setAdState("loading");
    tracked.current = new Set();
    fetch("/api/movies/clip-ad")
      .then(async (response) => {
        if (!response.ok) throw new Error("ad request failed");
        return response.json().catch(() => null);
      })
      .then((data) => {
        if (cancelled) return;
        if (!data?.enabled) {
          setAdState("fallback");
          return;
        }
        const creative = parseVast(data.vastXml);
        if (!creative) throw new Error("invalid VAST response");
        setAd(creative);
        setAdState("playing");
      })
      .catch(() => {
        if (!cancelled) setAdState("fallback");
      });
    return () => { cancelled = true; };
  }, [selected]);

  const finishAd = useCallback((event: "complete" | "skip" | "fallback") => {
    if (event === "complete" || event === "skip") {
      if (ad && !tracked.current.has(event)) {
        track(ad.tracking[event]);
        tracked.current.add(event);
      }
    }
    setAdState("done");
  }, [ad]);

  useEffect(() => {
    if (adState !== "playing" || !ad || !adVideoRef.current) return;
    const video = adVideoRef.current;
    const onTime = () => setAdTime(video.currentTime);
    const onStart = () => {
      if (!tracked.current.has("impression")) {
        track(ad.tracking.impression);
        track(ad.tracking.start);
        tracked.current.add("impression");
        tracked.current.add("start");
      }
    };
    const onError = () => finishAd("fallback");
    const onEnded = () => finishAd("complete");
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onStart, { once: true });
    video.addEventListener("error", onError);
    video.addEventListener("ended", onEnded);
    void video.play().catch(onError);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("error", onError);
      video.removeEventListener("ended", onEnded);
    };
  }, [ad, adState, finishAd]);

  return (
    <>
      <section className="border-b border-border/30 bg-card/30 py-10">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">
                FILMIO clips
              </p>
              <h2 className="text-2xl md:text-3xl font-display font-bold uppercase tracking-wider">
                Bloopers & Behind the Scenes
              </h2>
            </div>
            <span className="hidden sm:block text-xs text-muted-foreground">Watch the moment</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="aspect-video rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : clips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              New clips are being prepared.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {clips.slice(0, 8).map((clip) => (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => setSelected(clip)}
                  className="group relative aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted text-left"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w780${clip.posterPath ?? ""}`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-70 transition duration-300 group-hover:scale-105 group-hover:opacity-50"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-primary p-2 text-primary-foreground shadow-lg">
                    <Play className="w-4 h-4 fill-current" />
                  </span>
                  <span className="absolute inset-x-3 bottom-3">
                    <span className="block text-[10px] uppercase tracking-wider text-primary font-bold">{clip.type}</span>
                    <span className="block text-xs font-bold text-white line-clamp-1">{clip.title}</span>
                    <span className="block text-[10px] text-white/60 mt-1">{clip.movieTitle}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl overflow-hidden border-border bg-[#0b0b10] p-0">
          <DialogTitle className="sr-only">{selected?.title ?? "Video clip"}</DialogTitle>
          {selected && (adState === "loading" || adState === "playing") ? (
            <div className="relative flex aspect-video flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
              {adState === "playing" && ad ? (
                <>
                  <video ref={adVideoRef} src={ad.mediaUrl} className="absolute inset-0 h-full w-full object-contain" playsInline muted />
                  {ad.skipAfter !== null && adTime >= ad.skipAfter ? (
                    <button type="button" onClick={() => finishAd("skip")} className="absolute bottom-4 right-4 rounded bg-black/80 px-3 py-2 text-xs font-bold text-white">
                      Skip ad
                    </button>
                  ) : null}
                  <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wider text-white">Advertisement</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Preparing your preview…</p>
                </>
              )}
            </div>
          ) : selected ? (
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${selected.key}?autoplay=1&rel=0`}
                title={selected.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
          {selected && (
            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
              <p className="truncate text-sm font-semibold">{selected.title}</p>
              <button type="button" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close video">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}