import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link, useRoute } from "wouter";
import type { FreeClassic } from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { FreeClassicsVideoPlayer } from "@/components/free-classics";
import { apiFetch } from "@/lib/api-url";
import { SITE_URL } from "@/lib/seo";

async function fetchFreeClassic(source: string, identifier: string): Promise<FreeClassic> {
  const response = await apiFetch(
    `/api/free-classics/${encodeURIComponent(source)}/${encodeURIComponent(identifier)}`,
  );
  if (!response.ok) throw new Error("Free Classic unavailable");
  return (await response.json()) as FreeClassic;
}

export default function FreeClassicDetail() {
  const [, params] = useRoute<{ source: string; identifier: string }>(
    "/free-classics/:source/:identifier",
  );
  const source = params?.source ?? "";
  const identifier = params?.identifier ?? "";
  const query = useQuery({
    queryKey: ["free-classic", source, identifier],
    queryFn: () => fetchFreeClassic(source, identifier),
    enabled: Boolean(source && identifier),
    staleTime: 30 * 60 * 1000,
  });
  const item = query.data;
  const description =
    item?.description?.trim() ||
    (item
      ? `Watch ${item.title} online from a legal ${item.licenseLabel.toLowerCase()} source on FILMIO.`
      : "Watch public-domain and free classic movies online with FILMIO.");
  const title = item
    ? `${item.title} - Watch Free Classic Movie Online | FILMIO`
    : "Free Classic Movie | FILMIO";
  const canonicalUrl = item
    ? `${SITE_URL}/free-classics/${item.source}/${encodeURIComponent(item.identifier)}`
    : `${SITE_URL}/free-classics`;
  const structuredData = item
    ? {
        "@context": "https://schema.org",
        "@type": "Movie",
        name: item.title,
        description,
        url: canonicalUrl,
        image: item.posterUrl,
        ...(item.year ? { datePublished: `${item.year}-01-01` } : {}),
        isAccessibleForFree: true,
        license: item.sourceUrl,
        sameAs: item.sourceUrl,
        potentialAction: {
          "@type": "WatchAction",
          target: item.sourceUrl,
        },
      }
    : undefined;

  return (
    <div className="min-h-[100dvh] bg-background">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description.slice(0, 160)} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description.slice(0, 160)} />
        <meta property="og:type" content="video.movie" />
        {item?.posterUrl && <meta property="og:image" content={item.posterUrl} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description.slice(0, 160)} />
        {item?.posterUrl && <meta name="twitter:image" content={item.posterUrl} />}
        {structuredData && (
          <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        )}
      </Helmet>
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 pb-20 pt-24">
        {query.isLoading ? (
          <p className="py-20 text-center text-sm text-muted-foreground">Loading the screening room…</p>
        ) : query.isError || !item ? (
          <section className="py-20 text-center">
            <h1 className="font-display text-4xl font-bold uppercase tracking-wider">Classic unavailable</h1>
            <p className="mt-4 text-muted-foreground">This free-to-watch source is no longer available.</p>
            <Link href="/free-classics" className="mt-8 inline-flex min-h-11 items-center border border-primary px-5 text-xs font-bold uppercase tracking-wider text-primary">
              Back to Free Classics
            </Link>
          </section>
        ) : (
          <>
            <Link href="/free-classics" className="text-xs font-bold uppercase tracking-wider text-primary hover:text-foreground">
              ← Back to Free Classics
            </Link>
            <header className="mt-8 max-w-4xl">
              <p className="cinema-kicker">Public domain cinema · {item.sourceLabel}</p>
              <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight md:text-6xl">{item.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">{description}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary">
                {item.year ?? "Classic"} · {item.licenseLabel}
              </p>
            </header>
            <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
              <div>
                <h2 className="sr-only">Watch {item.title}</h2>
                <div className="aspect-video overflow-hidden border border-border bg-card">
                  {item.playback === "video" ? (
                    <FreeClassicsVideoPlayer item={item} />
                  ) : (
                    <iframe
                      src={item.embedUrl}
                      title={`Watch ${item.title} on ${item.sourceLabel}`}
                      className="h-full w-full"
                      allow="fullscreen; autoplay"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
              <aside className="space-y-5">
                <h2 className="font-display text-xl font-bold uppercase tracking-wider">About this free film</h2>
                {item.posterUrl && (
                  <img
                    src={item.posterUrl}
                    alt={`${item.title} movie poster`}
                    loading="lazy"
                    className="w-36 rounded border border-border object-cover"
                  />
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  FILMIO links to the official source so you can watch this classic legally and for free.
                </p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center border border-primary px-5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
                >
                  Visit official source
                </a>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}