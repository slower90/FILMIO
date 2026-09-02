import { apiFetch } from "@/lib/api-url";

export type PrismRating = {
  averageRating: number;
  totalRatings: number;
  weightedScore: number;
};

export type PrismRatings = Record<string, PrismRating>;

/**
 * FILMIO is the only rating shown in the UI. External ratings are discovery
 * metadata only; the public FILMIO score is its own Bayesian aggregate.
 */
export function getPrismDisplayRating(
  _externalVoteAverage: number | null | undefined,
  rating: PrismRating | undefined,
): number {
  if (!rating || rating.totalRatings <= 0) return 0;
  if (Number.isFinite(rating.weightedScore) && rating.weightedScore > 0) {
    return Math.max(0, Math.min(10, rating.weightedScore));
  }
  return Math.max(0, Math.min(10, rating.averageRating));
}

export async function fetchPrismRatings(movieIds: number[]): Promise<PrismRatings> {
  const ids = [...new Set(movieIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return {};

  const response = await apiFetch(`/api/movies/ratings?ids=${ids.join(",")}`);
  if (!response.ok) throw new Error("Unable to load FILMIO ratings");
  const data = await response.json() as {
    ratings?: Record<string, Omit<PrismRating, "weightedScore"> & { weightedScore?: number }>;
  };
  const ratings = Object.fromEntries(
    Object.entries(data.ratings ?? {}).map(([id, value]) => [
      id,
      {
        ...value,
        weightedScore: value.weightedScore ?? value.averageRating,
      },
    ]),
  );
  return ratings;
}

export function formatPrismRating(
  ratings: PrismRatings | undefined,
  movieId: number,
  tmdbVoteAverage?: number | null,
): string {
  const rating = ratings?.[String(movieId)];
  const score = getPrismDisplayRating(tmdbVoteAverage, rating);
  return score > 0 ? score.toFixed(1) : "—";
}