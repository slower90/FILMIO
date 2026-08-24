import { Link, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import {
  useGetMovieStats,
  useListReviews,
  useGetWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
   getGetWatchlistQueryKey,
   getGetMovieStatsQueryKey,
  useUpsertRating,
  useCreateReview,
   getListReviewsQueryKey,
} from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import { tmdbBackdropUrl, tmdbPosterUrl, tmdbLogoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingStars } from "@/components/rating-stars";
import { ReviewCard } from "@/components/review-card";
import { Clock, Calendar, Star, Play, Plus, Check, Clapperboard } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createWatchlistAddPayload } from "@/lib/authenticated-flow-contracts";
import { recordRecentlyViewedForUser } from "@/lib/viewing-history";
import { useUser } from "@clerk/react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  submitRatingAndReview,
  validateReviewForm,
} from "@/lib/review-submissions";
import { getMovieLoadingQuote } from "@/lib/movie-quotes";
import { getPrismDisplayRating } from "@/lib/mad-max-ratings";
import { CatalogStatusNotice, type CatalogMetadata } from "@/components/catalog-status-notice";

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

async function fetchMovieOverview(movieId: number, mediaType: "movie" | "tv"): Promise<any> {
  const res = await fetch(`/api/movies/${movieId}/overview?type=${mediaType}`);
  if (!res.ok) throw new Error("Unable to load movie");
  return res.json();
}

interface MovieOverviewResponse {
  movie: any;
  credits: { cast: any[] };
  providers: { flatrate: any[]; free: any[]; ads: any[]; rent: any[]; buy: any[]; link: string | null };
  videos: { results: any[] };
  metadata?: CatalogMetadata;
}

type WatchProvider = {
  providerId: number;
  providerName: string;
  logoPath: string;
};

function providerWatchUrl(providerName: string, title: string): string | null {
  const query = encodeURIComponent(title);
  const name = providerName.toLowerCase();
  if (name.includes("netflix")) return `https://www.netflix.com/in/search?q=${query}`;
  if (name.includes("prime")) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${query}`;
  if (name.includes("apple tv")) return `https://tv.apple.com/in/search?term=${query}`;
  if (name.includes("google play")) return `https://play.google.com/store/search?q=${query}&c=movies`;
  if (name === "youtube" || name.includes("youtube")) return `https://www.youtube.com/results?search_query=${query}`;
  if (name.includes("hotstar")) return `https://www.hotstar.com/in/search?q=${query}`;
  if (name.includes("sonyliv")) return `https://www.sonyliv.com/search?query=${query}`;
  if (name.includes("zee5")) return `https://www.zee5.com/search?q=${query}`;
  if (name.includes("mx player")) return `https://www.mxplayer.in/search?query=${query}`;
  if (name.includes("plex")) return `https://watch.plex.tv/search?query=${query}`;
  if (name.includes("aha")) return `https://www.aha.video/search?query=${query}`;
  if (name.includes("sun nxt")) return `https://www.sunnxt.com/search/${query}`;
  if (name.includes("crunchyroll")) return `https://www.crunchyroll.com/search?q=${query}`;
  if (name.includes("mubi")) return `https://mubi.com/en/search?query=${query}`;
  return null;
}

function uniqueProviders(providers: WatchProvider[], seen: Set<number>): WatchProvider[] {
  return providers.filter((provider) => {
    if (seen.has(provider.providerId)) return false;
    seen.add(provider.providerId);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MovieDetail() {
  const { id } = useParams();
  const search = useSearch();
  const movieId = parseInt(id || "0", 10);
  const searchParams = new URLSearchParams(search);
  const titleHint = searchParams.get("title") || undefined;
  const mediaType = searchParams.get("type") === "tv" ? "tv" : "movie";
  const loadingQuote = getMovieLoadingQuote(titleHint);
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const { data: watchlist } = useGetWatchlist({
    query: { queryKey: getGetWatchlistQueryKey(), enabled: !!isSignedIn },
  });
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const isInWatchlist =
    watchlist?.some((entry) => entry.movieId === movieId) ?? false;
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const upsertRating = useUpsertRating();
  const createReview = useCreateReview();

  const { data: overview, isLoading: loadingMovie } = useQuery<MovieOverviewResponse>({
    queryKey: ["movie-overview", movieId, mediaType],
    queryFn: () => fetchMovieOverview(movieId, mediaType),
    enabled: !!movieId,
    staleTime: 10 * 60 * 1000,
  });
  const movie = overview?.movie;
  const credits = overview?.credits;
  const providers = overview?.providers;
  const videos = overview?.videos;
  const { data: stats } = useGetMovieStats(movieId, {
    query: { queryKey: getGetMovieStatsQueryKey(movieId), enabled: !!movieId },
  });
  const { data: criticReviews } = useListReviews(
    { movieId, type: "critic" },
    { query: { queryKey: getListReviewsQueryKey({ movieId, type: "critic" }), enabled: !!movieId } },
  );
  const { data: audienceReviews } = useListReviews(
    { movieId, type: "audience" },
    { query: { queryKey: getListReviewsQueryKey({ movieId, type: "audience" }), enabled: !!movieId } },
  );

  const handleWatchlistToggle = () => {
    if (!movie || !isSignedIn) return;

    if (isInWatchlist) {
      removeFromWatchlist.mutate(
        { movieId },
        {
          onSuccess: () =>
            queryClient.invalidateQueries({
              queryKey: getGetWatchlistQueryKey(),
            }),
        },
      );
      return;
    }

    addToWatchlist.mutate(
      {
        data: createWatchlistAddPayload({
          movieId,
          movieTitle: movie.title,
          moviePosterPath: movie.posterPath,
          movieReleaseDate: movie.releaseDate,
        }),
      },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: getGetWatchlistQueryKey(),
          }),
      },
    );
  };

  const handleReviewSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    const score = Number(rating);
    const content = reviewContent.trim();
    const validationError = validateReviewForm({
      isSignedIn: !!isSignedIn,
      rating,
      reviewContent,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    submitRatingAndReview({
      movieId,
      rating,
      reviewContent: content,
      upsertRating,
      createReview,
      effects: {
        invalidateRatingStats: () =>
          queryClient.invalidateQueries({
            queryKey: getGetMovieStatsQueryKey(movieId),
          }),
        invalidateAudienceReviews: () =>
          queryClient.invalidateQueries({
            queryKey: getListReviewsQueryKey({ movieId, type: "audience" }),
          }),
        setMessage: setFormMessage,
        setError: setFormError,
        clearForm: () => {
          setReviewContent("");
          setRating("");
        },
      },
    });
  };

  useEffect(() => {
    if (!movie) return;
    void recordRecentlyViewedForUser(
      {
        id: movie.id,
        title: movie.title,
        posterPath: movie.posterPath,
        releaseDate: movie.releaseDate,
      },
      !!isSignedIn,
    );
  }, [movie, isSignedIn]);

  // "You Might Also Like" — TMDB recommendations for this movie
  const { data: recommendations, isLoading: loadingRecs } = useQuery<
    RowMovie[]
  >({
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
  ) ?? videos?.results?.find((v) => v.type === "Teaser" && v.site === "YouTube");
  const cast = credits?.cast?.slice(0, 20) || [];
  const [trailerPlaying, setTrailerPlaying] = useState(false);

  useEffect(() => {
    if (!trailerPlaying) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTrailerPlaying(false);
    };
    const handleTrailerMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      let message: { event?: string; info?: number } | null = null;
      try {
        message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (message?.event === "onStateChange" && Number(message.info) === 0) {
        setTrailerPlaying(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("message", handleTrailerMessage);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("message", handleTrailerMessage);
    };
  }, [trailerPlaying]);

  if (loadingMovie) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <div className="flex flex-1 items-center justify-center px-6 py-20">
          <div className="w-full max-w-2xl text-center">
            <Clapperboard className="mx-auto mb-6 h-10 w-10 animate-pulse text-primary" />
            <p className="cinema-kicker mb-4">Loading your feature</p>
            {titleHint && (
              <p className="mb-6 text-sm uppercase tracking-[0.18em] text-muted-foreground">
                {titleHint}
              </p>
            )}
            <blockquote className="font-display text-3xl uppercase leading-tight tracking-wide text-foreground md:text-5xl">
              “{loadingQuote.text}”
            </blockquote>
            <cite className="mt-5 block text-xs not-italic uppercase tracking-[0.2em] text-primary">
              — {loadingQuote.source}
            </cite>
            <div className="mx-auto mt-10 h-1 max-w-xs overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-[loading-bar_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) return null;
  const displayRating = getPrismDisplayRating(
    movie.voteAverage,
    stats
      ? { averageRating: stats.averageRating, totalRatings: stats.totalRatings }
      : undefined,
  );
  const hasRatings = (stats?.totalRatings ?? 0) > 0;
  const reviewCount =
    (stats?.criticReviews ?? 0) + (stats?.audienceReviews ?? 0);
  const RATING_SCALE_MAX = 10;
  const shownProviderIds = new Set<number>();
  const freeProviders = uniqueProviders(
    [...(providers?.free ?? []), ...(providers?.ads ?? [])],
    shownProviderIds,
  );
  const streamProviders = uniqueProviders(providers?.flatrate ?? [], shownProviderIds);
  const rentBuyProviders = uniqueProviders(
    [...(providers?.rent ?? []), ...(providers?.buy ?? [])],
    shownProviderIds,
  );
  const canonicalUrl = new URL(window.location.pathname, window.location.origin).toString();
  const posterUrl = movie.posterPath
    ? new URL(movie.posterPath, window.location.origin).toString()
    : undefined;
  const releaseYear = movie.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : undefined;
  const mediaLabel = mediaType === "tv" ? "TV series" : "movie";
  const pageTitle = releaseYear
    ? `${movie.title} (${releaseYear}) Ratings & Reviews | FILMIO`
    : `${movie.title} Ratings & Reviews | FILMIO`;
  const movieDescription = [
    `${movie.title}${releaseYear ? ` (${releaseYear})` : ""} ${mediaLabel} ratings, reviews, cast, trailer, story, and where to watch in India.`,
    movie.overview,
    "See the FILMIO community rating and discover what to watch next.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": mediaType === "tv" ? "TVSeries" : "Movie",
        "@id": `${canonicalUrl}#title`,
        name: movie.title,
        description: movie.overview || movieDescription,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        ...(movie.releaseDate ? { datePublished: movie.releaseDate } : {}),
        ...(posterUrl ? { image: posterUrl } : {}),
        ...(movie.genres?.length
          ? { genre: movie.genres.map((genre: { name: string }) => genre.name) }
          : {}),
        ...(movie.runtime ? { duration: `PT${movie.runtime}M` } : {}),
        ...(hasRatings
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: stats?.averageRating,
                ratingCount: stats?.totalRatings,
                ...(reviewCount > 0 ? { reviewCount } : {}),
                bestRating: RATING_SCALE_MAX,
                worstRating: 1,
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "FILMIO",
            item: new URL("/", window.location.origin).toString(),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: mediaType === "tv" ? "TV Shows" : "Movies",
            item: new URL(
              mediaType === "tv" ? "/discover?type=tv" : "/discover",
              window.location.origin,
            ).toString(),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: movie.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={movieDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={movieDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content={mediaType === "tv" ? "video.tv_show" : "video.movie"} />
        {posterUrl && <meta property="og:image" content={posterUrl} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={movieDescription} />
        {posterUrl && <meta name="twitter:image" content={posterUrl} />}
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 pt-6">
        <CatalogStatusNotice metadata={overview?.metadata} />
      </main>

      {/* ── Hero: full backdrop banner (click to play trailer) ───────────── */}
      <div
        className={`relative h-[56vh] md:h-[68vh] w-full group/banner ${trailer ? "cursor-pointer" : ""}`}
        onClick={() => trailer && setTrailerPlaying(true)}
        onKeyDown={(e) => {
          if (trailer && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setTrailerPlaying(true);
          }
        }}
        role={trailer ? "button" : undefined}
        tabIndex={trailer ? 0 : undefined}
        aria-label={trailer ? `Play ${movie.title} trailer` : undefined}
      >
        {trailerPlaying && trailer ? (
          <div className="absolute inset-0 z-20 bg-black">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent px-4 pb-8 pt-4 md:px-8">
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt="FILMIO"
                className="h-8 w-auto object-contain md:h-10"
              />
            </div>
            <iframe
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title={`${movie.title} trailer`}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              onLoad={(event) => {
                const youtubeOrigin = "https://www.youtube.com";
                const playerId = "mad-max-trailer";
                const listeningMessage = JSON.stringify({
                  event: "listening",
                  id: playerId,
                  channel: "widget",
                });
                const stateChangeMessage = JSON.stringify({
                  event: "command",
                  func: "addEventListener",
                  args: ["onStateChange"],
                  id: playerId,
                  channel: "widget",
                });
                event.currentTarget.contentWindow?.postMessage(listeningMessage, youtubeOrigin);
                event.currentTarget.contentWindow?.postMessage(stateChangeMessage, youtubeOrigin);
              }}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setTrailerPlaying(false);
              }}
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close trailer"
            >
              Close trailer
            </button>
          </div>
        ) : (
          <>
            <div className="absolute inset-0">
              <img
                src={tmdbBackdropUrl(movie.backdropPath || movie.posterPath)}
                alt={movie.title}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/60" />

            {/* Centered play button over the backdrop */}
            {trailer && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/40 bg-black/50 shadow-2xl backdrop-blur-sm transition-all duration-300 group-hover/banner:scale-110 group-hover/banner:border-primary group-hover/banner:bg-primary/80 md:h-24 md:w-24">
                  <Play className="ml-1 h-9 w-9 fill-white text-white md:h-11 md:w-11" />
                </div>
                <span className="rounded-full border border-white/30 bg-black/60 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                  Watch trailer
                </span>
              </div>
            )}
            {!trailer && (
              <div className="absolute bottom-8 left-4 z-10 rounded border border-white/20 bg-black/50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70 backdrop-blur-sm">
                Trailer unavailable
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Movie info: poster + title + meta, right below the banner ────── */}
      <div className="container mx-auto px-4 relative z-10 -mt-24 md:-mt-32">
        <div className="flex flex-col md:flex-row gap-8 items-end">
          <img
            src={tmdbPosterUrl(movie.posterPath)}
            alt={movie.title}
            className="w-32 md:w-44 lg:w-56 rounded-md shadow-2xl border border-border/50 hidden md:block box-glow shrink-0"
          />

          <div className="flex-1 space-y-4 pb-1">
            <h1 className="text-[clamp(2.25rem,5.5vw,5.5rem)] font-display font-semibold uppercase tracking-tight text-glow">
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
                FILMIO Rating{" "}
                {displayRating.toFixed(1)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {movie.genres?.map((g: { id: number; name: string }) => (
                <Link
                  key={g.id}
                  href={`/genre/${g.id}`}
                  className="px-3 py-1 rounded-full border border-border bg-background/50 text-xs font-display uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
                >
                  {g.name}
                </Link>
              ))}
            </div>

            {movie.overview && (
              <p className="text-base text-foreground/80 leading-relaxed max-w-3xl line-clamp-3">
                {movie.overview}
              </p>
            )}

            <div className="flex flex-wrap gap-4 pt-2">
              {isSignedIn ? (
                <Button
                  size="lg"
                  variant={isInWatchlist ? "default" : "secondary"}
                  className="gap-2"
                  onClick={handleWatchlistToggle}
                  disabled={
                    addToWatchlist.isPending || removeFromWatchlist.isPending
                  }
                >
                  {isInWatchlist ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  {isInWatchlist ? "Saved to Watchlist" : "Save to Watchlist"}
                </Button>
              ) : (
                <Button asChild size="lg" variant="secondary" className="gap-2">
                  <Link href="/sign-in">
                    <Plus className="w-5 h-5" />
                    Sign in to Save
                  </Link>
                </Button>
              )}

              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setShowReviewForm((open) => !open);
                  setFormError(null);
                  setFormMessage(null);
                }}
              >
                Rate & Review
              </Button>
            </div>
            {showReviewForm && (
              <form
                onSubmit={handleReviewSubmit}
                className="mt-5 max-w-xl rounded-md border border-border bg-card/80 p-4 space-y-4"
              >
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="movie-rating">Your rating</Label>
                    <select
                      id="movie-rating"
                      value={rating}
                      onChange={(event) => setRating(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      disabled={
                        upsertRating.isPending || createReview.isPending
                      }
                    >
                      <option value="">Select 1–10</option>
                      {Array.from({ length: 10 }, (_, index) => index + 1).map(
                        (score) => (
                          <option key={score} value={score}>
                            {score} / 10
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A written review is optional. If provided, use at least 10
                    characters.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movie-review">Review (optional)</Label>
                  <Textarea
                    id="movie-review"
                    value={reviewContent}
                    onChange={(event) => setReviewContent(event.target.value)}
                    placeholder="What did you think?"
                    rows={4}
                    disabled={upsertRating.isPending || createReview.isPending}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-destructive" role="alert">
                    {formError}
                  </p>
                )}
                {formMessage && (
                  <p className="text-sm text-primary" role="status">
                    {formMessage}
                  </p>
                )}
                {!isSignedIn ? (
                  <Button asChild type="button">
                    <Link href="/sign-in">Sign in to submit</Link>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={upsertRating.isPending || createReview.isPending}
                  >
                    {upsertRating.isPending || createReview.isPending
                      ? "Saving…"
                      : "Submit rating"}
                  </Button>
                )}
              </form>
            )}
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
            <p className="text-lg text-foreground/80 leading-relaxed">
              {movie.overview}
            </p>
          </section>

          {/* Cast — compact horizontal carousel */}
          {cast.length > 0 && (
            <section>
              <h2 className="text-2xl font-display font-bold uppercase tracking-wider mb-4 border-b border-border pb-2">
                Cast &amp; Crew
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin snap-x">
                {cast.map((person) => (
                  <div
                    key={person.id}
                    className="group cursor-pointer shrink-0 w-24 md:w-28 snap-start"
                  >
                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-2 bg-muted border border-border/50 group-hover:border-primary transition-colors">
                      {person.profilePath ? (
                        <img
                          src={tmdbPosterUrl(person.profilePath)}
                          alt={person.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                          No Image
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-xs leading-tight text-center group-hover:text-primary transition-colors line-clamp-2">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground text-center line-clamp-2">
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
                  <TabsTrigger
                    value="critic"
                    className="font-display uppercase tracking-widest"
                  >
                    Critic ({stats?.criticReviews || 0})
                  </TabsTrigger>
                  <TabsTrigger
                    value="audience"
                    className="font-display uppercase tracking-widest"
                  >
                    Audience ({stats?.audienceReviews || 0})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="critic" className="space-y-4">
                {criticReviews && criticReviews.length > 0 ? (
                  criticReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      showMovie={false}
                    />
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
                    <ReviewCard
                      key={review.id}
                      review={review}
                      showMovie={false}
                    />
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
                FILMIO Rating
              </h3>
              <div className="flex items-end gap-3 mb-6">
                <span className="text-5xl font-display font-bold text-primary">
                  {displayRating.toFixed(1)}
                </span>
                <span className="text-xl text-muted-foreground font-display mb-1">
                  / 10
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {stats.totalRatings > 0
                  ? `${stats.totalRatings} user ratings`
                  : "FILMIO score"}
              </p>

              {stats.totalRatings > 0 && <div className="space-y-2">
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => {
                  const dist = stats.ratingDistribution?.find(
                    (d) => d.score === score,
                  );
                  const count = dist?.count || 0;
                  const percent =
                    stats.totalRatings > 0
                      ? (count / stats.totalRatings) * 100
                      : 0;
                  return (
                    <div
                      key={score}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-4 text-right">{score}</span>
                      <Star className="w-3 h-3 text-muted-foreground" />
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {providers &&
            (providers.flatrate?.length > 0 || providers.free?.length > 0 || providers.ads?.length > 0 || providers.rent?.length > 0 || providers.buy?.length > 0) && (
              <div className="bg-card border border-border rounded-md p-6">
                <h3 className="font-display uppercase tracking-wider font-bold text-lg mb-4">
                  Where to Watch
                </h3>
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Availability may vary by region. Select a provider to open the official watch options.
                </p>

                {freeProviders.length > 0 && (
                  <div className="mb-5 rounded-md border border-primary/30 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
                       No-cost / ad-supported
                    </p>
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                      Free or ad-supported availability in India.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {freeProviders.map((p) => {
                        const href = providerWatchUrl(p.providerName, movie.title);
                        const content = (
                          <img src={tmdbLogoUrl(p.logoPath)} alt={p.providerName} className="h-10 w-10 rounded" />
                        );
                        return href ? <a
                          key={`${p.providerId}-${p.providerName}`}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                           aria-label={`Open official OTT options for ${movie.title} on ${p.providerName}`}
                          className="block rounded shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title={`${p.providerName} · Free or with ads`}
                        >
                          {content}
                        </a> : <span key={`${p.providerId}-${p.providerName}`} title={`${p.providerName} official link unavailable`} className="block rounded opacity-70">{content}</span>;
                      })}
                    </div>
                  </div>
                )}

                {streamProviders.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                      Stream
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {streamProviders.map((p) => {
                        const href = providerWatchUrl(p.providerName, movie.title);
                        const content = (
                          <img src={tmdbLogoUrl(p.logoPath)} alt={p.providerName} className="h-10 w-10 rounded" />
                        );
                        return href ? <a
                          key={p.providerId}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Watch ${movie.title} on ${p.providerName}`}
                          className="block rounded shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title={p.providerName}
                        >
                          {content}
                        </a> : <span key={p.providerId} title={`${p.providerName} official link unavailable`} className="block rounded opacity-70">{content}</span>;
                      })}
                    </div>
                  </div>
                )}

                {rentBuyProviders.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                      Rent / Buy
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {rentBuyProviders.map((p) => {
                        const href = providerWatchUrl(p.providerName, movie.title);
                        const content = (
                          <img src={tmdbLogoUrl(p.logoPath)} alt={p.providerName} className="h-10 w-10 rounded" />
                        );
                        return href ? <a
                          key={p.providerId}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Rent or buy ${movie.title} on ${p.providerName}`}
                          className="block rounded shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title={p.providerName}
                        >
                          {content}
                        </a> : <span key={p.providerId} title={`${p.providerName} official link unavailable`} className="block rounded opacity-70">{content}</span>;
                      })}
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
            title="🎯 Recommended Movies — You Might Also Like"
            movies={filteredRecs}
            isLoading={loadingRecs}
          />
        </div>
      )}

      <Link
        href="/free-movies"
        className="group mx-auto mt-12 flex max-w-5xl items-center justify-between gap-6 overflow-hidden rounded-md border border-primary/40 bg-gradient-to-r from-primary/15 via-card to-primary/5 px-6 py-7 transition-all hover:border-primary hover:shadow-[0_18px_45px_-24px_hsl(var(--primary)/0.8)] md:px-10"
         aria-label="Find where to stream more movies"
      >
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-background/70 text-primary transition-transform group-hover:scale-110">
            <Clapperboard className="h-7 w-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">FILMIO</p>
            <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wider md:text-2xl">
               Find where to stream
            </h2>
             <p className="mt-1 text-sm text-muted-foreground">Explore official OTT availability, including no-cost and ad-supported options in India.</p>
          </div>
        </div>
        <span className="hidden shrink-0 text-2xl text-primary transition-transform group-hover:translate-x-1 sm:block">→</span>
      </Link>

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
