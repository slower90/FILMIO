import assert from "node:assert/strict";
import test from "node:test";
import { buildProfileCinemaData } from "./profile-identity";

const history = [{
  id: 101,
  title: "Private Watch",
  posterPath: "/private.jpg",
  releaseDate: "2024-01-01",
  voteAverage: 8,
}];
const ratings = [
  { id: 1, userId: "owner", movieId: 101, profileId: 7, score: 9, createdAt: "2026-01-01", updatedAt: "2026-01-02" },
  { id: 2, userId: "owner", movieId: 102, profileId: 7, score: 8, createdAt: "2026-01-03", updatedAt: "2026-01-03" },
];
const watchlist = [
  { id: 1, userId: "owner", movieId: 103, status: "want_to_watch" as const, movieTitle: "Private Discovery", moviePosterPath: "/discovery.jpg", movieReleaseDate: "2025-01-01", addedAt: "2026-01-04" },
  { id: 2, userId: "owner", movieId: 101, status: "watched" as const, movieTitle: "Private Watch", moviePosterPath: "/private.jpg", movieReleaseDate: "2024-01-01", addedAt: "2026-01-05" },
];
const reviews = [{
  id: 4,
  userId: "owner",
  movieId: 104,
  content: "A public review with enough words.",
  rating: 7,
  isCriticReview: false,
  verifiedWatch: true,
  likesCount: 0,
  isLikedByMe: false,
  commentsCount: 0,
  movieTitle: "Public Review",
  moviePosterPath: "/public.jpg",
  createdAt: "2026-01-06",
  updatedAt: "2026-01-06",
}];

test("scopes cinema collections to the active owner profile", () => {
  const ownerData = buildProfileCinemaData({ isOwner: true, history, ratings, watchlist, reviews });

  assert.equal(ownerData.watchedIds.size, 1);
  assert.deepEqual(ownerData.topTen.map((movie) => movie.id), [101, 102]);
  assert.deepEqual(ownerData.discoveries.map((movie) => movie.id), [103]);
  assert.equal(ownerData.movieCatalog.get(104)?.title, "Public Review");
});

test("does not expose private cinema collections for another profile", () => {
  const publicData = buildProfileCinemaData({ isOwner: false, history, ratings, watchlist, reviews });

  assert.equal(publicData.watchedIds.size, 0);
  assert.equal(publicData.topTen.length, 0);
  assert.equal(publicData.discoveries.length, 0);
  assert.equal(publicData.history.length, 0);
  assert.equal(publicData.watchlist.length, 0);
  assert.equal(publicData.movieCatalog.get(104)?.title, "Public Review");
  assert.equal(publicData.movieCatalog.has(101), false);
});