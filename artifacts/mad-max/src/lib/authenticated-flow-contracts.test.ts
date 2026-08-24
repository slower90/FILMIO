import assert from "node:assert/strict";
import test from "node:test";
import {
  createChatMessagePayload,
  createFollowPayload,
  createWatchlistAddPayload,
  createWatchlistRemovePayload,
  createWatchlistUpdatePayload,
} from "./authenticated-flow-contracts";

test("watchlist mutations preserve the generated API payload contracts", () => {
  assert.deepEqual(
    createWatchlistAddPayload({
      movieId: 42,
      movieTitle: "Mad Max",
      moviePosterPath: "/poster.jpg",
      movieReleaseDate: "1979-02-15",
    }),
    {
      movieId: 42,
      movieTitle: "Mad Max",
      moviePosterPath: "/poster.jpg",
      movieReleaseDate: "1979-02-15",
      status: "want_to_watch",
    },
  );
  assert.deepEqual(createWatchlistUpdatePayload("watched"), {
    status: "watched",
  });
  assert.deepEqual(createWatchlistRemovePayload(42), { movieId: 42 });
});

test("follow and unfollow use the generated id-only mutation contract", () => {
  assert.deepEqual(createFollowPayload("user_123"), { id: "user_123" });
});

test("chat messages send trimmed user content in the generated body shape", () => {
  assert.deepEqual(createChatMessagePayload("  Hello there  "), {
    content: "Hello there",
  });
});
