import type {
  Rating,
  Review,
  ViewingHistoryEntry,
  WatchlistEntry,
} from "@workspace/api-client-react";

export type ProfileMovie = {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  score?: number;
  state: "watched" | "rated" | "saved";
};

type BuildProfileCinemaDataInput = {
  isOwner: boolean;
  history: ViewingHistoryEntry[];
  ratings: Rating[];
  watchlist: WatchlistEntry[];
  reviews: Review[];
};

export function buildProfileCinemaData({
  isOwner,
  history: rawHistory,
  ratings: rawRatings,
  watchlist: rawWatchlist,
  reviews,
}: BuildProfileCinemaDataInput) {
  const history = isOwner ? rawHistory : [];
  const ratings = isOwner ? rawRatings : [];
  const watchlist = isOwner ? rawWatchlist : [];
  const movieCatalog = new Map<number, { title: string; posterPath?: string | null; releaseDate?: string | null }>();

  history.forEach((entry) => movieCatalog.set(entry.id, {
    title: entry.title,
    posterPath: entry.posterPath,
    releaseDate: entry.releaseDate,
  }));
  watchlist.forEach((entry) => movieCatalog.set(entry.movieId, {
    title: entry.movieTitle || `Film ${entry.movieId}`,
    posterPath: entry.moviePosterPath,
    releaseDate: entry.movieReleaseDate,
  }));
  reviews.forEach((review) => {
    if (review.movieTitle) {
      movieCatalog.set(review.movieId, {
        title: review.movieTitle,
        posterPath: review.moviePosterPath,
      });
    }
  });

  const watchedIds = new Set([
    ...history.map((entry) => entry.id),
    ...watchlist.filter((entry) => entry.status === "watched").map((entry) => entry.movieId),
  ]);
  const ratedMovies = ratings
    .slice()
    .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
    .map((rating) => {
      const movie = movieCatalog.get(rating.movieId);
      return {
        id: rating.movieId,
        title: movie?.title || "Catalog title unavailable",
        posterPath: movie?.posterPath,
        releaseDate: movie?.releaseDate,
        score: rating.score,
        state: "rated" as const,
      };
    });
  const watchedMovies = history.map((entry) => ({
    id: entry.id,
    title: entry.title,
    posterPath: entry.posterPath,
    releaseDate: entry.releaseDate,
    state: "watched" as const,
  }));
  const discoveries = watchlist
    .filter((entry) => entry.status === "want_to_watch")
    .slice(0, 6)
    .map((entry) => ({
      id: entry.movieId,
      title: entry.movieTitle || `Film ${entry.movieId}`,
      posterPath: entry.moviePosterPath,
      releaseDate: entry.movieReleaseDate,
      state: "saved" as const,
    }));

  return {
    history,
    ratings,
    watchlist,
    movieCatalog,
    watchedIds,
    ratedMovies,
    watchedMovies,
    discoveries,
    topTen: ratedMovies.slice(0, 10),
  };
}