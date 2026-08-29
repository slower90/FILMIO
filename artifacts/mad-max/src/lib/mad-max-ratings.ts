import { apiFetch } from "@/lib/api-url";

export type PrismRating = {
  averageRating: number;
  totalRatings: number;
};

export type PrismRatings = Record<string, PrismRating>;

/**
 * FILMIO is the only rating shown in the UI. TMDB supplies the initial
 * baseline, and each FILMIO user average is blended with that baseline once
 * users start rating the title.
 */
export function getPrismDisplayRating(
  tmdbVoteAverage: number | null | undefined,
  rating: PrismRating | undefined,
): number {
  const tmdbRating =
    typeof tmdbVoteAverage === "number" && Number.isFinite(tmdbVoteAverage)
      ? Math.max(0, Math.min(10, tmdbVoteAverage))
      : 0;

  if (!rating || rating.totalRatings <= 0) return tmdbRating;
  if (tmdbRating <= 0) return rating.averageRating;
  return (tmdbRating + rating.averageRating) / 2;
}

export async function fetchPrismRatings(movieIds: number[]): Promise<PrismRatings> {
  const ids = [...new Set(movieIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return {};

  const response = await apiFetch(`/api/movies/ratings?ids=${ids.join(",")}`);
  if (!response.ok) throw new Error("Unable to load FILMIO ratings");
  const data = await response.json() as { ratings?: PrismRatings };
  return data.ratings ?? {};
}

export function formatPrismRating(
  ratings: PrismRatings | undefined,
  movieId: number,
  tmdbVoteAverage?: number | null,
): string {
  const rating = ratings?.[String(movieId)];
  return getPrismDisplayRating(tmdbVoteAverage, rating).toFixed(1);
}