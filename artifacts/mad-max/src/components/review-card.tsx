import { Link } from "wouter";
import { type Review } from "@workspace/api-client-react";
import { RatingStars } from "./rating-stars";
import { Heart, MessageSquare, BadgeCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tmdbPosterUrl } from "@/lib/utils";

interface ReviewCardProps {
  review: Review;
  showMovie?: boolean;
}

export function ReviewCard({ review, showMovie = true }: ReviewCardProps) {
  return (
    <div className="bg-card border border-border rounded-md p-4 flex flex-col gap-4 hover-elevate transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${review.userId}`} className="shrink-0">
            <img 
              src={review.authorAvatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${review.authorName}`} 
              alt={review.authorName || "User"} 
              className="w-10 h-10 rounded-full object-cover border border-border bg-muted"
            />
          </Link>
          <div>
            <Link href={`/profile/${review.userId}`} className="font-bold text-sm hover:text-primary transition-colors flex items-center gap-1">
              {review.authorName}
              {review.isCriticReview && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
            </Link>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
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
        <Link href={`/movies/${review.movieId}`} className="group flex items-center gap-3 bg-secondary/30 rounded p-2 hover:bg-secondary/50 transition-colors">
          <img 
            src={tmdbPosterUrl(review.moviePosterPath)} 
            alt={review.movieTitle || "Movie"} 
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
        <button className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${review.isLikedByMe ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
          <Heart className={`w-4 h-4 ${review.isLikedByMe ? "fill-primary" : ""}`} />
          {review.likesCount}
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
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
    </div>
  );
}
