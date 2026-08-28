import { Link } from "wouter";
import {
  type Review,
  useListComments,
  useCreateComment,
  getListCommentsQueryKey,
} from "@workspace/api-client-react";
import { RatingStars } from "./rating-stars";
import { Heart, MessageSquare, BadgeCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tmdbPosterUrl } from "@/lib/utils";
import { withMovieTitle } from "@/lib/movie-links";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  submitComment as submitCommentMutation,
  validateCommentSubmission,
} from "@/lib/review-submissions";

interface ReviewCardProps {
  review: Review;
  showMovie?: boolean;
}

export function ReviewCard({ review, showMovie = true }: ReviewCardProps) {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const commentsQuery = useListComments(review.id, {
    query: {
      queryKey: getListCommentsQueryKey(review.id),
      enabled: commentsOpen,
    },
  });
  const createComment = useCreateComment();
  const submitComment = () => {
    const content = comment.trim();
    const validationError = validateCommentSubmission(!!isSignedIn, content);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    submitCommentMutation({
      reviewId: review.id,
      comment: content,
      createComment,
      onSuccess: () => {
        setComment("");
        queryClient.invalidateQueries({
          queryKey: getListCommentsQueryKey(review.id),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      },
      onError: () => setError("Could not add your comment. Please try again."),
    });
  };
  return (
    <div className="bg-card border border-border rounded-md p-4 flex flex-col gap-4 hover-elevate transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${review.userId}`} className="shrink-0">
            <img
              src={
                review.authorAvatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${review.authorName}`
              }
              alt={review.authorName || "User"}
              className="w-10 h-10 rounded-full object-cover border border-border bg-muted"
            />
          </Link>
          <div>
            <Link
              href={`/profile/${review.userId}`}
              className="font-bold text-sm hover:text-primary transition-colors flex items-center gap-1"
            >
              {review.authorName}
              {review.isCriticReview && (
                <BadgeCheck className="w-3.5 h-3.5 text-primary" />
              )}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(review.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>

        {review.rating !== null && review.rating !== undefined && (
          <div className="shrink-0">
            <RatingStars rating={review.rating} />
          </div>
        )}
      </div>

      {showMovie && review.movieId && (
        <Link
          href={withMovieTitle(`/movies/${review.movieId}`, review.movieTitle || `Film ${review.movieId}`)}
          className="group flex items-center gap-3 bg-secondary/30 rounded p-2 hover:bg-secondary/50 transition-colors"
        >
          <img
            src={tmdbPosterUrl(review.moviePosterPath, "w92")}
            alt={review.movieTitle || "Movie"}
            width={92}
            height={138}
            className="w-8 h-12 object-cover rounded shrink-0"
          />
          <span className="font-display uppercase tracking-wide text-sm font-bold group-hover:text-primary transition-colors line-clamp-1">
            {review.movieTitle}
          </span>
        </Link>
      )}

      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {review.content}
      </p>

      <div className="flex items-center gap-4 mt-auto pt-2 border-t border-border/50">
        <button
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${review.isLikedByMe ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
        >
          <Heart
            className={`w-4 h-4 ${review.isLikedByMe ? "fill-primary" : ""}`}
          />
          {review.likesCount}
        </button>
        <button
          type="button"
          aria-expanded={commentsOpen}
          onClick={() => {
            setCommentsOpen((open) => !open);
            setError(null);
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {review.commentsCount}
        </button>
        {review.verifiedWatch && (
          <div className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
            <BadgeCheck className="w-3 h-3" />
            Verified Watch
          </div>
        )}
      </div>
      {commentsOpen && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          {commentsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading comments…
            </p>
          ) : commentsQuery.isError ? (
            <p className="text-xs text-destructive">
              Could not load comments. Try again.
            </p>
          ) : commentsQuery.data?.length ? (
            <div className="space-y-2">
              {commentsQuery.data.map((item) => (
                <div
                  key={item.id}
                  className="rounded bg-secondary/30 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-xs">
                    {item.authorName || "User"}
                  </p>
                  <p className="whitespace-pre-wrap">{item.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No comments yet. Start the conversation.
            </p>
          )}
          {isSignedIn ? (
            <div className="space-y-2">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment…"
                rows={2}
                disabled={createComment.isPending}
              />
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="button"
                size="sm"
                onClick={submitComment}
                disabled={createComment.isPending}
              >
                {createComment.isPending ? "Posting…" : "Post comment"}
              </Button>
            </div>
          ) : (
            <Button asChild type="button" size="sm" variant="outline">
              <Link href="/sign-in">Sign in to comment</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
