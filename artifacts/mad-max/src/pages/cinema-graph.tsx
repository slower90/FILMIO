import { useUser } from "@clerk/react";
import { Link } from "wouter";
import { ArrowLeft, Compass, RotateCcw } from "lucide-react";
import {
  getGetViewingHistoryQueryKey,
  getGetWatchlistQueryKey,
  getListMyRatingsQueryKey,
  useGetViewingHistory,
  useGetWatchlist,
  useListMyRatings,
} from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { PersonalCinemaGraph } from "@/components/personal-cinema-graph";
import { useActiveProfile } from "@/lib/profile-context";

export default function CinemaGraph() {
  const { isLoaded, isSignedIn } = useUser();
  const { activeProfile, profiles, isReady, setActiveProfileId } = useActiveProfile();
  const profileParams = activeProfile ? { profileId: activeProfile.id } : undefined;
  const historyQuery = useGetViewingHistory(profileParams, {
    query: { queryKey: getGetViewingHistoryQueryKey(profileParams), enabled: isReady && !!activeProfile },
  });
  const ratingQuery = useListMyRatings(profileParams, {
    query: { queryKey: getListMyRatingsQueryKey(profileParams), enabled: isReady && !!activeProfile },
  });
  const watchlistQuery = useGetWatchlist(profileParams, {
    query: { queryKey: getGetWatchlistQueryKey(profileParams), enabled: isReady && !!activeProfile },
  });
  const hasError = historyQuery.error || ratingQuery.error || watchlistQuery.error;
  const retry = () => {
    void historyQuery.refetch();
    void ratingQuery.refetch();
    void watchlistQuery.refetch();
  };

  if (!isLoaded || (isSignedIn && !isReady)) return <div className="min-h-screen bg-background"><Navbar /></div>;
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background"><Navbar /><main className="container mx-auto max-w-lg px-4 pt-32 text-center"><Compass className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold uppercase">Your cinema universe awaits</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sign in to build a private map from your own viewing room.</p><Link href="/sign-in?redirect=/profiles/graph" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-xs font-bold uppercase tracking-wider text-primary-foreground">Sign in to continue</Link></main></div>
    );
  }

  return (
    <div className="film-grain min-h-screen bg-background pb-20">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 pt-28">
        <Link href="/profiles" className="mb-8 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Viewing rooms</Link>
        <header className="cinema-graph-header">
          <div>
            <p className="editorial-kicker"><Compass className="h-3.5 w-3.5" aria-hidden="true" /> Personal cinema graph</p>
            <h1 className="editorial-heading mt-4">My cinema <em>universe</em></h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">A living map of the films, people, places, and patterns that gather around your taste. Switch viewing rooms to change the lens.</p>
          </div>
          {activeProfile && (
            <label className="cinema-graph-profile-select">Viewing room
              <select value={activeProfile.id} onChange={(event) => setActiveProfileId(Number(event.target.value))}>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </label>
          )}
        </header>
        {activeProfile && (
          <div className="mt-8">
            {hasError ? (
              <div className="cinema-graph-error" role="alert"><p className="font-bold uppercase tracking-wider">Your cinema data could not be connected.</p><p className="mt-2 text-sm text-muted-foreground">Nothing was changed. Try again when your viewing room is available.</p><Button variant="outline" className="mt-5" onClick={retry}><RotateCcw className="mr-2 h-4 w-4" /> Retry</Button></div>
            ) : historyQuery.isLoading || ratingQuery.isLoading || watchlistQuery.isLoading ? (
              <div className="cinema-graph-loading" aria-label="Loading your cinema universe"><div /><div /><div /></div>
            ) : (
              <PersonalCinemaGraph history={historyQuery.data} ratings={ratingQuery.data} watchlist={watchlistQuery.data} profileName={activeProfile.name} preferences={activeProfile} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}