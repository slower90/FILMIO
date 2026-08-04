import { useGetTrendingReviews } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

// ── Direct API fetchers for non-spec endpoints ────────────────────────────────

async function fetchMovieCategory(path: string, maxPages: number): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/${path}?maxPages=${maxPages}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const data = await res.json();
  return data.results ?? [];
}

function useMovieCategory(key: string, path: string, maxPages = 3) {
  return useQuery<RowMovie[]>({
    queryKey: ["movies", key, maxPages],
    queryFn: () => fetchMovieCategory(path, maxPages),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  const { data: trendingReviews } = useGetTrendingReviews({ limit: 4 });

  const { data: trendingMovies, isLoading: loadingTrending } = useMovieCategory(
    "trending",
    "trending",
    3,
  );
  const { data: popularMovies, isLoading: loadingPopular } = useMovieCategory(
    "popular",
    "popular",
    3,
  );
  const { data: topRatedMovies, isLoading: loadingTopRated } = useMovieCategory(
    "top-rated",
    "top-rated",
    3,
  );

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation("/discover");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || isSignedIn) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vh] bg-primary/10 rounded-full blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] bg-primary/5 rounded-full blur-[100px] mix-blend-screen" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold uppercase tracking-tighter mb-6 leading-none">
            The serious film <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200 text-glow">
              lover's network
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 font-medium">
            Track what you watch. Follow trusted critics. Connect with industry
            professionals. Discover cinema without the noise.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/sign-up">Create Free Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/search">Explore Movies</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Movie Rows ───────────────────────────────────────────────────── */}
      <div className="border-t border-border/50 bg-card/20">
        <MovieRow
          title="Trending This Week"
          movies={trendingMovies ?? []}
          isLoading={loadingTrending}
          className="border-b border-border/30"
        />

        <MovieRow
          title="Popular Right Now"
          movies={popularMovies ?? []}
          isLoading={loadingPopular}
          className="border-b border-border/30"
        />

        <MovieRow
          title="All-Time Classics"
          movies={topRatedMovies ?? []}
          isLoading={loadingTopRated}
        />
      </div>

      {/* ── Featured Reviews ─────────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wider mb-4">
              Critique That Matters
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Read reviews from verified professionals and passionate cinephiles.
              No memes, no spam, just real appreciation for the craft.
            </p>
          </div>

          {trendingReviews && trendingReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trendingReviews.map((review, i) => (
                <div
                  key={review.id}
                  className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <ReviewCard review={review} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-md">
              <p className="font-display uppercase tracking-widest text-sm">
                No reviews yet — be the first critic.
              </p>
              <Button variant="ghost" className="mt-4 gap-2" asChild>
                <Link href="/sign-up">
                  Sign up to write a review <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}

          <div className="mt-12 text-center">
            <Button variant="ghost" className="gap-2" asChild>
              <Link href="/sign-up">
                Read more reviews <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-border bg-card text-center">
        <div className="container mx-auto px-4">
          <p className="font-display font-bold text-2xl tracking-widest text-primary mb-4">
            MAD MAX
          </p>
          <p className="text-muted-foreground text-sm uppercase tracking-wider">
            For the love of cinema.
          </p>
        </div>
      </footer>
    </div>
  );
}
