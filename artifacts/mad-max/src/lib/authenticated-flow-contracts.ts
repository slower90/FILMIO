import type {
  ChatMessageInput,
  WatchlistInput,
  WatchlistUpdate,
} from "@workspace/api-client-react";

export type MovieWatchlistSource = Pick<
  WatchlistInput,
  "movieId" | "movieTitle" | "moviePosterPath" | "movieReleaseDate"
  | "profileId"
>;

export function createWatchlistAddPayload(
  movie: MovieWatchlistSource,
): WatchlistInput {
  return {
    ...movie,
    status: "want_to_watch",
  };
}

export function createWatchlistUpdatePayload(
  status: WatchlistUpdate["status"],
): WatchlistUpdate {
  return { status };
}

export function createWatchlistRemovePayload(movieId: number): {
  movieId: number;
} {
  return { movieId };
}

export function createFollowPayload(id: string): { id: string } {
  return { id };
}

export function createChatMessagePayload(content: string): ChatMessageInput {
  return { content: content.trim() };
}
