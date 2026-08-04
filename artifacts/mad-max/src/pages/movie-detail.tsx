import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetMovieDetails,
  useGetMovieCredits,
  useGetMovieWatchProviders,
  useGetMovieVideos,
  useGetMovieStats,
  useListReviews,
} from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { tmdbBackdropUrl, tmdbPosterUrl, tmdbLogoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingStars } from "@/components/rating-stars";
import { ReviewCard } from "@/components/review-card";
import { Clock, Calendar, Star, PlayCircle, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ── Fetchers for non-spec endpoints ──────────────────────────────────────────

async function fetchMovieRecommendations(movieId: number): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/${movieId}/recommendations?maxPages=2`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

async function fetchMoviesByGenre(genreId: number): Promise<RowMovie[]> {
  const res = await fetch(`/api/movies/by-genre?genreId=${genreId}&maxPages=2`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MovieDetail() {
  const { id } = useParams();
  const movieId = parseInt(id || "0", 10);

  const { data: movie, isLoading: loadingMovie } = useGetMovieDetails(movieId, {
    query: { enabled: !!movieId },
  });
  const { data: credits } = useGetMovieCredits(movieId, {
    query: { enabled: !!movieId },
  });
  const { data: providers } = useGetMovieWatchProviders(movieId, {
    query: { enabled: !!movieId },
  });
  const { data: videos } = useGetMovieVideos(movieId, {
    query: { enabled: !!movieId },
  });
  const { data: stats } = useGetMovieStats(movieId, {
    query: { enabled: !!movieId },
  });
  const { data: criticReviews } = useListReviews(
    { movieId, type: "critic" },
    { query: { enabled: !!movieId } },
  );
  const { data: audienceReviews } = useListReviews(
    { movieId, type: "audience" },
    { query: { enabled: !!movieId } },
  );

  // "You Might Also Like" — TMDB recommendations for this movie
  const { data: recommendations, isLoading: loadingRecs } = useQuery<RowMovie[]>({
    queryKey: ["movie-recommendations", movieId],
    queryFn: () => fetchMovieRecommendations(movieId),
    enabled: !!movieId,
    staleTime: 10 * 60 * 1000,
  });

  // "More in [Genre]" — discover by first genre of this movie
  const firstGenre = movie?.genres?.[0];
  const { data: genreMovies, isLoading: loadingGenre } = useQuery<RowMovie[]>({
    queryKey: ["genre-movies", firstGenre?.id],
    queryFn: () => fetchMoviesByGenre(firstGenre!.id),
    enabled: !!firstGenre?.id,
    staleTime: 10 * 60 * 1000,
  });

  // Filter out the current movie from related rows
  const filteredRecs = recommendations?.filter((m) => m.id !== movieId) ?? [];
  const filteredGenre = genreMovies?.filter((m) => m.id !== movieId) ?? [];

  const trailer = videos?.results?.find(
    (v) => v.type === "Trailer" && v.site === "YouTube",
  );
  const cast = credits?.cast?.slice(0, 10) || [];

  if (loadingMovie) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="h-[60vh] w-full animate-pulse bg-muted" />
      </div>
    );
  }

  if (!movie) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-[60vh] md:h-[70vh] w-full">
        <div className="absolute inset-0 mask-fade-b">
          <img
            src={tmdbBackdropUrl(movie.backdropPath || movie.posterPath)}
            alt={movie.title}
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        <div className="container mx-auto px-4 h-full relative z-10 flex flex-col justify-end pb-10">
          <div className="flex flex-col md:flex-row gap-8 items-end">
            <img
              src={tmdbPosterUrl(movie.posterPath)}
              alt={movie.title}
              className="w-32 md:w-48 lg:w-64 rounded-md shadow-2xl border border-border/50 hidden md:block box-glow"
            />

            <div className="flex-1 space-y-4">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold uppercase tracking-tight text-glow">
                {movie.title}
              </h1>

              {movie.tagline && (
                <p className="text-lg md:text-xl text-primary font-medium italic">
                  "{movie.tagline}"
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {movie.releaseDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(movie.releaseDate).getFullYear()}
                  </span>
                )}
                {movie.runtime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {movie.runtime} min
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-primary">
                  <Star className="w-4 h-4 fill-primary" />
                  {movie.voteAverage.toFixed(1)}{" "}
                  <span className="text-muted-foreground">({movie.voteCount})</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {movie.genres?.map((g) => (
                  <span
                    key={g.id}
                    className="px-3 py-1 rounded-full border border-border bg-background/50 text-xs font-display uppercase tracking-widest"
                  >
                    {g.name}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                {trailer && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="lg" className="gap-2">
                        <PlayCircle className="w-5 h-5" />
                        Watch Trailer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-border">
                      <DialogHeader className="sr-only">
                        <DialogTitle>Trailer</DialogTitle>
                      </DialogHeader>
                      <div className="aspect-video w-full">
                        <iframe
                          src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <Button size="lg" variant="secondary" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Watchlist
                </Button>

                <Button size="lg" variant="outline" className="gap-2">
                  Rate & Review
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 2-col grid ──────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Synopsis + Cast + Reviews */}
        <div className="lg:col-span-2 space-y-12">
          {/* Synopsis */}
          <section>
            <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-4 border-b border-border pb-2">
              Synopsis
            </h2>
            <p className="text-lg text-foreground/80 leading-relaxed">{movie.overview}</p>
          </section>

          {/* Cast */}
          {cast.length > 0 && (
            <section>
              <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-4 border-b border-border pb-2">
                Cast
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {cast.map((person) => (
                  <div key={person.id} className="group cursor-pointer">
                    <div className="aspect-[2/3] w-full rounded overflow-hidden mb-2 bg-muted">
                      {person.profilePath ? (
                        <img
                          src={tmdbPosterUrl(person.profilePath)}
                          alt={person.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                          No Image
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                      {person.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {person.character}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section>
            <Tabs defaultValue="critic" className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold uppercase tracking-wider">
                  Reviews
                </h2>
                <TabsList>
                  <TabsTrigger value="critic" className="font-display uppercase tracking-widest">
                    Critic ({stats?.criticReviews || 0})
                  </TabsTrigger>
                  <TabsTrigger value="audience" className="font-display uppercase tracking-widest">
                    Audience ({stats?.audienceReviews || 0})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="critic" className="space-y-4">
                {criticReviews && criticReviews.length > 0 ? (
                  criticReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} showMovie={false} />
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-md">
                    No critic reviews yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audience" className="space-y-4">
                {audienceReviews && audienceReviews.length > 0 ? (
                  audienceReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} showMovie={false} />
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-md">
                    No audience reviews yet. Be the first!
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>

        {/* Right: Sidebar — Rating + Providers + Details */}
        <div className="space-y-8">
          {stats && (
            <div className="bg-card border border-border rounded-md p-6">
              <h3 className="font-display uppercase tracking-wider font-bold text-lg mb-4">
                MAD MAX Rating
              </h3>
              <div className="flex items-end gap-3 mb-6">
                <span className="text-5xl font-display font-bold text-primary">
                  {stats.averageRating.toFixed(1)}
                </span>
                <span className="text-xl text-muted-foreground font-display mb-1">/ 10</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {stats.totalRatings} user ratings
              </p>

              <div className="space-y-2">
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => {
                  const dist = stats.ratingDistribution?.find((d) => d.score === score);
                  const count = dist?.count || 0;
                  const percent =
                    stats.totalRatings > 0 ? (count / stats.totalRatings) * 100 : 0;
                  return (
                    <div key={score} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right">{score}</span>
                      <Star className="w-3 h-3 text-muted-foreground" />
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {providers &&
            (providers.flatrate?.length > 0 || providers.rent?.length > 0) && (
              <div className="bg-card border border-border rounded-md p-6">
                <h3 className="font-display uppercase tracking-wider font-bold text-lg mb-4">
                  Where to Watch
                </h3>

                {providers.flatrate && providers.flatrate.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                      Stream
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {providers.flatrate.map((p) => (
                        <img
                          key={p.providerId}
                          src={tmdbLogoUrl(p.logoPath)}
                          alt={p.providerName}
                          className="w-10 h-10 rounded shadow"
                          title={p.providerName}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {providers.rent && providers.rent.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                      Rent / Buy
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {providers.rent.map((p) => (
                        <img
                          key={p.providerId}
                          src={tmdbLogoUrl(p.logoPath)}
                          alt={p.providerName}
                          className="w-10 h-10 rounded shadow"
                          title={p.providerName}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          <div className="bg-card border border-border rounded-md p-6 space-y-4 text-sm">
            <h3 className="font-display uppercase tracking-wider font-bold text-lg mb-2">
              Details
            </h3>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-right">{movie.status}</span>
            </div>
            {movie.budget > 0 && (
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium text-right">
                  ${(movie.budget / 1_000_000).toFixed(1)}M
                </span>
              </div>
            )}
            {movie.revenue > 0 && (
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium text-right">
                  ${(movie.revenue / 1_000_000).toFixed(1)}M
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── You Might Also Like ───────────────────────────────────────────── */}
      {(filteredRecs.length > 0 || loadingRecs) && (
        <div className="mt-12 border-t border-border/50">
          <MovieRow
            title="You Might Also Like"
            movies={filteredRecs}
            isLoading={loadingRecs}
          />
        </div>
      )}

      {/* ── More in [Genre] ───────────────────────────────────────────────── */}
      {firstGenre && (filteredGenre.length > 0 || loadingGenre) && (
        <div className="border-t border-border/50">
          <MovieRow
            title={`More ${firstGenre.name} Films`}
            movies={filteredGenre}
            isLoading={loadingGenre}
          />
        </div>
      )}
    </div>
  );
}
