import { Link } from "wouter";
import {
  type Review,
  useListComments,
  useCreateComment,
  getListCommentsQueryKey,
  useLikeReview,
} from "@workspace/api-client-react";
import { RatingStars } from "./rating-stars";
import { Heart, MessageSquare, BadgeCheck, Eye, EyeOff } from "lucide-react";
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
import { LazyBlurImage } from "@/components/lazy-blur-image";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const commentsQuery = useListComments(review.id, {
    query: {
      queryKey: getListCommentsQueryKey(review.id),
      enabled: commentsOpen,
    },
  });
  const createComment = useCreateComment();
  const likeReview = useLikeReview();
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
            <LazyBlurImage
              src={
                review.authorAvatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${review.authorName}`
              }
              placeholderSrc={review.authorAvatarUrl ?? undefined}
              alt={review.authorName || "User"}
              width={40}
              height={40}
              className="h-full w-full rounded-full object-cover"
              wrapperClassName="h-10 w-10 shrink-0 rounded-full border border-border bg-muted"
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
          <LazyBlurImage
            src={tmdbPosterUrl(review.moviePosterPath, "w92")}
            placeholderSrc={tmdbPosterUrl(review.moviePosterPath, "w92")}
            alt={review.movieTitle || "Movie"}
            width={92}
            height={138}
            className="h-full w-full rounded object-cover"
            wrapperClassName="h-12 w-8 shrink-0 rounded"
          />
          <span className="font-display uppercase tracking-wide text-sm font-bold group-hover:text-primary transition-colors line-clamp-1">
            {review.movieTitle}
          </span>
        </Link>
      )}

      {review.containsSpoilers && !spoilerRevealed ? (
        <div className="rounded border border-primary/25 bg-primary/[0.04] px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <EyeOff className="h-4 w-4" />
            Spoiler protected
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Reveal this review only if you have seen the film.</p>
          <button
            type="button"
            onClick={() => setSpoilerRevealed(true)}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded border border-primary/40 px-3 text-xs font-bold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/10"
          >
            <Eye className="h-4 w-4" />
            Reveal review
          </button>
        </div>
      ) : (
        <div>
          {review.containsSpoilers && (
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <Eye className="h-3.5 w-3.5" /> Spoilers revealed
            </p>
          )}
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {review.content}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 mt-auto pt-2 border-t border-border/50">
        <button
          type="button"
          onClick={() => {
            if (!isSignedIn || likeReview.isPending) return;
            likeReview.mutate(
              { id: review.id },
              { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reviews"] }) },
            );
          }}
          disabled={!isSignedIn || likeReview.isPending}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${review.isLikedByMe ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
          aria-label={isSignedIn ? `${review.isLikedByMe ? "Unlike" : "Like"} review` : "Sign in to like this review"}
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
              <div className="flex items-center gap-2" aria-label="Loading comments">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
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
