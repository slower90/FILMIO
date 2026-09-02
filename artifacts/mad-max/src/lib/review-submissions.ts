export type ReviewFormInput = {
  isSignedIn: boolean;
  rating: string;
  reviewContent: string;
  containsSpoilers?: boolean;
};

export function validateReviewForm({
  isSignedIn,
  rating,
  reviewContent,
  containsSpoilers,
}: ReviewFormInput): string | null {
  if (!isSignedIn) return "Please sign in to submit a rating or review.";

  const score = Number(rating);
  const content = reviewContent.trim();
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return "Choose a rating from 1 to 10.";
  }
  if (content.length > 0 && content.length < 10) {
    return "Reviews must be at least 10 characters.";
  }
  return null;
}

type Mutation = {
  mutate: (
    variables: unknown,
    callbacks: { onSuccess: () => void; onError: () => void },
  ) => void;
};

export type ReviewSubmissionEffects = {
  invalidateRatingStats: () => void;
  invalidateCraftSignal?: () => void;
  invalidateAudienceReviews: () => void;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
  clearForm: () => void;
};

export function submitRatingAndReview({
  movieId,
  rating,
  reviewContent,
  containsSpoilers,
  profileId,
  upsertRating,
  createReview,
  effects,
}: {
  movieId: number;
  rating: string;
  reviewContent: string;
  containsSpoilers?: boolean;
  profileId?: number;
  upsertRating: Mutation;
  createReview: Mutation;
  effects: ReviewSubmissionEffects;
}) {
  const score = Number(rating);
  const content = reviewContent.trim();
  const ratingPayload = {
    data: { movieId, score },
    ...(profileId ? { params: { profileId } } : {}),
  };

  upsertRating.mutate(
    ratingPayload,
    {
      onSuccess: () => {
        effects.invalidateRatingStats();
        effects.invalidateCraftSignal?.();
        if (!content) {
          effects.setMessage("Your rating was saved.");
          effects.clearForm();
          return;
        }
        createReview.mutate(
          {
            data: {
              movieId,
              rating: score,
              content,
              ...(containsSpoilers !== undefined ? { containsSpoilers } : {}),
            },
          },
          {
            onSuccess: () => {
              effects.invalidateAudienceReviews();
              effects.invalidateRatingStats();
              effects.invalidateCraftSignal?.();
              effects.clearForm();
              effects.setMessage("Your rating and review were saved.");
            },
            onError: () =>
              effects.setError(
                "Could not save your review. Your rating was saved; please try again.",
              ),
          },
        );
      },
      onError: () =>
        effects.setError("Could not save your rating. Please try again."),
    },
  );
}

export function validateCommentSubmission(
  isSignedIn: boolean,
  comment: string,
): string | null {
  if (!isSignedIn) return "Please sign in to comment.";
  if (!comment.trim()) return "Enter a comment before submitting.";
  return null;
}

export function submitComment({
  reviewId,
  comment,
  createComment,
  onSuccess,
  onError,
}: {
  reviewId: number;
  comment: string;
  createComment: Mutation;
  onSuccess: () => void;
  onError: () => void;
}) {
  createComment.mutate(
    { id: reviewId, data: { content: comment.trim() } },
    { onSuccess, onError },
  );
}
