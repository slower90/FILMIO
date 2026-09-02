import { useInfiniteQuery } from "@tanstack/react-query";
import { Film, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { MovieCard } from "@/components/movie-card";
import { CinemaEmptyState } from "@/components/cinema-empty-state";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-url";
import type { MoviePagedResult } from "@workspace/api-client-react";

type Collection = "trending" | "popular" | "top-rated" | "tv-popular" | "tv-top-rated" | "tv-upcoming" | "upcoming" | "in-theaters" | "indian";

const COLLECTIONS: Record<Collection, { title: string; eyebrow: string; description: string; mediaType: "movie" | "tv" }> = {
  trending: { title: "Live Signal", eyebrow: "Moving through cinema", description: "The movies finding their way into the shared atmosphere this week.", mediaType: "movie" },
  popular: { title: "Popular Movies", eyebrow: "The wide frame", description: "The titles drawing the most attention across the FILMIO catalogue.", mediaType: "movie" },
  "top-rated": { title: "Top Rated Movies", eyebrow: "Community canon", description: "Highly regarded films, ranked by the wider cinema conversation.", mediaType: "movie" },
  "tv-popular": { title: "Popular Series", eyebrow: "Series with momentum", description: "Television stories with the strongest current pull.", mediaType: "tv" },
  "tv-top-rated": { title: "Top Rated Series", eyebrow: "Long-form favourites", description: "Series that reward the time you give them.", mediaType: "tv" },
  "tv-upcoming": { title: "Series Coming Soon", eyebrow: "Next transmissions", description: "Television releases worth keeping on your radar.", mediaType: "tv" },
  upcoming: { title: "Coming Into Focus", eyebrow: "Plan your next screen", description: "Upcoming films arriving in the Indian release region.", mediaType: "movie" },
  "in-theaters": { title: "India, Right Now", eyebrow: "On the big screen", description: "Movies currently playing across the Indian release region.", mediaType: "movie" },
  indian: { title: "Indian Cinema", eyebrow: "Made for India", description: "Indian-origin films across languages and regions.", mediaType: "movie" },
};

function getPageConfig(location: string, browserSearch = "") {
  const search = new URLSearchParams(browserSearch || location.split("?")[1] || "");
  const requested = search.get("collection") as Collection | null;
  const collection = requested && requested in COLLECTIONS ? requested : "trending";
  return {
    collection,
    language: search.get("language")?.trim().toLowerCase() ?? "",
  };
}

export default function Browse() {
  const [location] = useLocation();
  const browserSearch = typeof window === "undefined" ? "" : window.location.search;
  const { collection, language } = getPageConfig(location, browserSearch);
  const config = COLLECTIONS[collection];
  const query = useInfiniteQuery<MoviePagedResult>({
    queryKey: ["catalog-page", collection, language],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        collection,
        page: String(pageParam),
        limit: "20",
      });
      if (language) params.set("language", language);
      const response = await apiFetch(`/api/movies/catalog?${params.toString()}`);
      if (!response.ok) throw new Error("Unable to load this catalogue");
      return response.json() as Promise<MoviePagedResult>;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < Math.min(lastPage.totalPages, 20) ? lastPage.page + 1 : undefined,
    staleTime: 10 * 60 * 1000,
  });

  const seen = new Set<number>();
  const movies = (query.data?.pages.flatMap((page) => page.results) ?? []).filter((movie) => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
  const totalResults = query.data?.pages[0]?.totalResults ?? 0;
  const languageLabel = language ? ` · ${language.toUpperCase()}` : "";

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <main>
        <section className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-background to-background px-4 pb-12 pt-32 md:pb-16">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm border border-primary/45 bg-primary/10 text-primary">
              <Film className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="cinema-kicker">{config.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-display font-bold uppercase tracking-[0.04em] text-glow md:text-6xl">
              {config.title}{languageLabel}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">{config.description}</p>
            {totalResults > 0 && <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">{totalResults.toLocaleString()} titles in this programme</p>}
          </div>
        </section>

        <div className="container mx-auto px-4 py-12">
          {query.isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 18 }).map((_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : query.isError ? (
            <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              This catalogue is temporarily unavailable. Please refresh and try again.
            </div>
          ) : movies.length === 0 ? (
            <CinemaEmptyState
              description="Nothing matches exactly. Try the Live Signal programme, remove the language filter, or widen the frame."
              actions={[
                { label: "Open Live Signal", href: "/browse?collection=trending", testId: "link-empty-browse-trending" },
                { label: "Discover freely", href: "/discover", testId: "link-empty-browse-discover" },
              ]}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {movies.map((movie) => <MovieCard key={movie.id} movie={movie} mediaType={config.mediaType} />)}
              </div>
              {query.hasNextPage && (
                <div className="mt-14 flex justify-center">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                    className="min-h-11 gap-2 font-display uppercase tracking-widest"
                    data-testid="button-load-more-catalog"
                  >
                    {query.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {query.isFetchingNextPage ? "Loading more" : "Load More"}
                  </Button>
                </div>
              )}
              {!query.hasNextPage && <p className="mt-14 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">End of this programme</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}