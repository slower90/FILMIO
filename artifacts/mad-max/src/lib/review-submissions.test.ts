import assert from "node:assert/strict";
import { test } from "node:test";
import {
  submitComment,
  submitRatingAndReview,
  validateCommentSubmission,
  validateReviewForm,
} from "./review-submissions";

function deferredMutation() {
  let callbacks: { onSuccess: () => void; onError: () => void } | undefined;
  const calls: unknown[] = [];
  return {
    calls,
    mutate(variables: unknown, next: typeof callbacks) {
      calls.push(variables);
      callbacks = next;
    },
    succeed() {
      callbacks?.onSuccess();
    },
    fail() {
      callbacks?.onError();
    },
  };
}

test("rating-only submissions validate input, save, and refresh stats", () => {
  assert.equal(
    validateReviewForm({ isSignedIn: true, rating: "", reviewContent: "" }),
    "Choose a rating from 1 to 10.",
  );
  assert.equal(
    validateReviewForm({
      isSignedIn: true,
      rating: "7",
      reviewContent: "too short",
    }),
    "Reviews must be at least 10 characters.",
  );

  const rating = deferredMutation();
  const review = deferredMutation();
  const events: string[] = [];
  submitRatingAndReview({
    movieId: 42,
    rating: "8",
    reviewContent: "",
    upsertRating: rating,
    createReview: review,
    effects: {
      invalidateRatingStats: () => events.push("stats"),
      invalidateAudienceReviews: () => events.push("audience"),
      setMessage: (message) => events.push(message),
      setError: (message) => events.push(`error:${message}`),
      clearForm: () => events.push("clear"),
    },
  });
  assert.deepEqual(rating.calls, [{ data: { movieId: 42, score: 8 } }]);
  rating.succeed();
  assert.deepEqual(events, ["stats", "Your rating was saved.", "clear"]);
  assert.deepEqual(review.calls, []);
});

test("rating-plus-review refreshes reviews and stats without a page reload", () => {
  const rating = deferredMutation();
  const review = deferredMutation();
  const events: string[] = [];
  submitRatingAndReview({
    movieId: 42,
    rating: "9",
    reviewContent: "A thoughtful review.",
    upsertRating: rating,
    createReview: review,
    effects: {
      invalidateRatingStats: () => events.push("stats"),
      invalidateAudienceReviews: () => events.push("audience"),
      setMessage: (message) => events.push(message),
      setError: (message) => events.push(`error:${message}`),
      clearForm: () => events.push("clear"),
    },
  });
  rating.succeed();
  assert.deepEqual(review.calls, [
    { data: { movieId: 42, rating: 9, content: "A thoughtful review." } },
  ]);
  review.succeed();
  assert.deepEqual(events, [
    "stats",
    "audience",
    "stats",
    "clear",
    "Your rating and review were saved.",
  ]);
});

test("sends ratings to the active viewing profile", () => {
  const rating = deferredMutation();
  const review = deferredMutation();

  submitRatingAndReview({
    movieId: 550,
    rating: "8",
    reviewContent: "",
    profileId: 12,
    upsertRating: rating,
    createReview: review,
    effects: {
      invalidateRatingStats: () => undefined,
      invalidateAudienceReviews: () => undefined,
      setMessage: () => undefined,
      setError: () => undefined,
      clearForm: () => undefined,
    },
  });

  assert.deepEqual(rating.calls, [
    { data: { movieId: 550, score: 8 }, params: { profileId: 12 } },
  ]);
});

test("signed-out rating and comment submissions are blocked with prompts", () => {
  assert.equal(
    validateReviewForm({ isSignedIn: false, rating: "8", reviewContent: "" }),
    "Please sign in to submit a rating or review.",
  );
  assert.equal(
    validateCommentSubmission(false, "A comment"),
    "Please sign in to comment.",
  );
  assert.equal(
    validateCommentSubmission(true, "   "),
    "Enter a comment before submitting.",
  );
});

test("successful comments send trimmed content and refresh through the callback", () => {
  const comment = deferredMutation();
  let refreshed = false;
  let failed = false;
  submitComment({
    reviewId: 7,
    comment: "  Great take!  ",
    createComment: comment,
    onSuccess: () => {
      refreshed = true;
    },
    onError: () => {
      failed = true;
    },
  });
  assert.deepEqual(comment.calls, [
    { id: 7, data: { content: "Great take!" } },
  ]);
  comment.succeed();
  assert.equal(refreshed, true);
  assert.equal(failed, false);
});
