import { Navbar } from "@/components/navbar";
import { getGetWatchlistQueryKey, useGetWatchlist, useUpdateWatchlistEntry, useRemoveFromWatchlist } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Eye, Clock, Clapperboard } from "lucide-react";
import { tmdbPosterUrl } from "@/lib/utils";
import { format } from "date-fns";
import { useUser } from "@clerk/react";
import { createWatchlistRemovePayload, createWatchlistUpdatePayload } from "@/lib/authenticated-flow-contracts";
import { withMovieTitle } from "@/lib/movie-links";
import { useActiveProfile } from "@/lib/profile-context";

export default function Watchlist() {
  const { isSignedIn, isLoaded } = useUser();
  const { activeProfile } = useActiveProfile();
  const profileParams = activeProfile ? { profileId: activeProfile.id } : undefined;
  const { data: watchlist, isLoading } = useGetWatchlist(profileParams, {
    query: { queryKey: getGetWatchlistQueryKey(profileParams), enabled: isLoaded && !!isSignedIn },
  });
  const updateEntry = useUpdateWatchlistEntry();
  const removeEntry = useRemoveFromWatchlist();
  const queryClient = useQueryClient();

  const refreshWatchlist = () =>
    queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });

  if (!isLoaded || (isSignedIn && isLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto max-w-3xl px-4 pt-32 text-center">
          <Clapperboard className="mx-auto mb-6 h-16 w-16 text-primary/60" />
          <h1 className="mb-3 text-4xl font-display font-bold uppercase tracking-tight text-glow">
            Your Watchlist
          </h1>
          <p className="mb-8 text-muted-foreground">
            Sign in to save movies and keep your watchlist synced across devices.
          </p>
          <Button asChild>
            <Link href="/sign-in">Sign in to continue</Link>
          </Button>
        </main>
      </div>
    );
  }

  const wantToWatch = watchlist?.filter(e => e.status === "want_to_watch") || [];
  const watched = watchlist?.filter(e => e.status === "watched") || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-display font-bold uppercase tracking-tight text-glow">Watchlist</h1>
            <p className="text-muted-foreground font-medium">Keep track of your cinematic journey.</p>
          </div>
        </div>

        <Tabs defaultValue="want" className="w-full">
          <TabsList className="mb-8 w-full justify-start h-auto p-0 bg-transparent gap-6 border-b border-border rounded-none">
            <TabsTrigger 
              value="want" 
              className="font-display uppercase tracking-widest text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0"
            >
              Want to Watch ({wantToWatch.length})
            </TabsTrigger>
            <TabsTrigger 
              value="watched" 
              className="font-display uppercase tracking-widest text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0"
            >
              Watched ({watched.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="want" className="animate-in fade-in duration-500">
            {wantToWatch.length === 0 ? (
              <EmptyState message="Your watchlist is empty. Go discover some movies!" />
            ) : (
              <div className="space-y-4">
                {wantToWatch.map(entry => (
                  <WatchlistRow 
                    key={entry.id} 
                    entry={entry} 
                    onMarkWatched={() => updateEntry.mutate(
                       { movieId: entry.movieId, data: createWatchlistUpdatePayload("watched"), params: profileParams },
                      { onSuccess: refreshWatchlist },
                    )}
                    onRemove={() => removeEntry.mutate(
                       { ...createWatchlistRemovePayload(entry.movieId), params: profileParams },
                      { onSuccess: refreshWatchlist },
                    )}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="watched" className="animate-in fade-in duration-500">
            {watched.length === 0 ? (
              <EmptyState message="You haven't marked any movies as watched yet." />
            ) : (
              <div className="space-y-4">
                {watched.map(entry => (
                  <WatchlistRow 
                    key={entry.id} 
                    entry={entry} 
                    onMarkWatched={undefined} // Already watched
                    onRemove={() => removeEntry.mutate(
                       { ...createWatchlistRemovePayload(entry.movieId), params: profileParams },
                      { onSuccess: refreshWatchlist },
                    )}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function WatchlistRow({ entry, onMarkWatched, onRemove }: any) {
  return (
    <div className="flex bg-card border border-border rounded-md overflow-hidden group hover-elevate transition-all">
      <Link href={withMovieTitle(`/movies/${entry.movieId}`, entry.movieTitle)} className="shrink-0">
        <img 
                       src={tmdbPosterUrl(entry.moviePosterPath, "w342")}
          alt={entry.movieTitle || "Poster"} 
                       width={342}
                       height={513}
          className="w-24 md:w-32 aspect-[2/3] object-cover border-r border-border transition-transform duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="p-4 md:p-6 flex flex-col justify-between flex-1">
        <div>
          <Link href={withMovieTitle(`/movies/${entry.movieId}`, entry.movieTitle)} className="block w-fit">
            <h3 className="font-display font-bold uppercase tracking-wide text-xl md:text-2xl hover:text-primary transition-colors line-clamp-1">
              {entry.movieTitle}
            </h3>
          </Link>
          <div className="flex items-center gap-4 text-xs md:text-sm text-muted-foreground mt-2">
            {entry.movieReleaseDate && <span>{new Date(entry.movieReleaseDate).getFullYear()}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Added {format(new Date(entry.addedAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-4">
          {onMarkWatched && (
            <Button size="sm" variant="secondary" onClick={onMarkWatched} className="gap-1.5 h-8">
              <Check className="w-4 h-4" />
              Mark Watched
            </Button>
          )}
          {!onMarkWatched && (
            <span className="text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-1 bg-primary/10 px-2 py-1 rounded">
              <Eye className="w-3.5 h-3.5" /> Watched
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={onRemove} className="gap-1.5 h-8 text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-32 border border-dashed border-border rounded-lg bg-card/50">
      <Clapperboard className="w-16 h-16 mx-auto mb-6 text-muted-foreground/30" />
      <h2 className="text-2xl font-display uppercase tracking-widest text-muted-foreground">{message}</h2>
      <Button asChild className="mt-8">
        <Link href="/discover">Discover Movies</Link>
      </Button>
    </div>
  );
}
