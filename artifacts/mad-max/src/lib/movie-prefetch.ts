import type { QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-url";
import type { CatalogMetadata } from "@/components/catalog-status-notice";

export type MovieMediaType = "movie" | "tv";

export interface MovieOverviewResponse {
  movie: any;
  credits: { cast: any[] };
  providers: { flatrate: any[]; free: any[]; ads: any[]; rent: any[]; buy: any[]; link: string | null };
  videos: { results: any[] };
  metadata?: CatalogMetadata;
}

export function getMovieOverviewQueryKey(movieId: number, mediaType: MovieMediaType) {
  return ["movie-overview", movieId, mediaType] as const;
}

export async function fetchMovieOverview(
  movieId: number,
  mediaType: MovieMediaType,
): Promise<MovieOverviewResponse> {
  const response = await apiFetch(`/api/movies/${movieId}/overview?type=${mediaType}`);
  if (!response.ok) throw new Error("Unable to load movie");
  return response.json() as Promise<MovieOverviewResponse>;
}

export function prefetchMovieOverview(
  queryClient: QueryClient,
  movieId: number,
  mediaType: MovieMediaType = "movie",
) {
  const queryKey = getMovieOverviewQueryKey(movieId, mediaType);
  const queryState = queryClient.getQueryState(queryKey);
  if (queryState?.data !== undefined || queryState?.fetchStatus === "fetching") return;

  return queryClient.prefetchQuery({
    queryKey,
    queryFn: () => fetchMovieOverview(movieId, mediaType),
    staleTime: 10 * 60 * 1000,
  });
}