import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number; // 0 to 10
  max?: number;
  className?: string;
  starClassName?: string;
}

export function RatingStars({ rating, max = 10, className, starClassName }: RatingStarsProps) {
  // Convert 10-point scale to 5 stars for display
  const stars = Math.round((rating / max) * 5 * 2) / 2;
  
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (stars >= i) {
          return <Star key={i} className={cn("w-4 h-4 fill-primary text-primary", starClassName)} />;
        } else if (stars >= i - 0.5) {
          return (
            <div key={i} className="relative">
              <Star className={cn("w-4 h-4 text-muted-foreground", starClassName)} />
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <Star className={cn("w-4 h-4 fill-primary text-primary", starClassName)} />
              </div>
            </div>
          );
        } else {
          return <Star key={i} className={cn("w-4 h-4 text-muted-foreground", starClassName)} />;
        }
      })}
      <span className="ml-1 text-xs font-medium text-muted-foreground">
        {rating.toFixed(1)}/10
      </span>
    </div>
  );
}
