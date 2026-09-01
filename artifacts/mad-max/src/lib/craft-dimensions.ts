import { apiFetch } from "@/lib/api-url";

export type CraftDimension = {
  key: string;
  score: number | null;
  confidence: "overall" | "emerging" | "measured";
  evidenceCount: number;
};

export type CraftDiscussion = {
  title: string;
  snippet: string;
  subreddit: string;
  score: number;
  comments: number;
  url: string;
};

export type CraftDimensionsResponse = {
  movieId: number;
  overallScore: number;
  dimensions: CraftDimension[];
  sources: {
    filmio: {
      totalRatings: number;
      averageRating: number;
      totalReviews: number;
    };
    reddit: {
      status: "available" | "unavailable" | "not_found";
      totalResults: number;
      posts: CraftDiscussion[];
    };
  };
  updatedAt: string;
};

export async function fetchCraftDimensions(
  movieId: number,
  title: string,
  baselineScore: number,
): Promise<CraftDimensionsResponse> {
  const params = new URLSearchParams({
    title,
    baselineScore: String(baselineScore),
  });
  const response = await apiFetch(`/api/movies/${movieId}/craft-dimensions?${params.toString()}`);
  if (!response.ok) throw new Error("Unable to load craft dimensions");
  return response.json() as Promise<CraftDimensionsResponse>;
}