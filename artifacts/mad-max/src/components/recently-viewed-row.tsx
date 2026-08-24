import { useEffect, useState } from "react";
import { MovieRow, type RowMovie } from "@/components/movie-row";
import {
  clearRecentlyViewed,
  HISTORY_EVENT,
  loadRecentlyViewed,
} from "@/lib/viewing-history";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function RecentlyViewedRow() {
  const [movies, setMovies] = useState<RowMovie[]>([]);
  const { isSignedIn } = useUser();

  useEffect(() => {
    let active = true;
    const update = () => {
      void loadRecentlyViewed(!!isSignedIn).then((next) => {
        if (active) setMovies(next);
      });
    };
    update();
    window.addEventListener(HISTORY_EVENT, update);
    return () => {
      active = false;
      window.removeEventListener(HISTORY_EVENT, update);
    };
  }, [isSignedIn]);

  if (movies.length === 0) return null;
  return (
    <div className="relative border-b border-border/30">
      <MovieRow title="🕘 Recently Viewed" movies={movies} />
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-4 top-2 gap-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => {
          void clearRecentlyViewed(!!isSignedIn).then((cleared) => {
            if (cleared) setMovies([]);
          });
        }}
        aria-label="Clear recently viewed history"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  );
}