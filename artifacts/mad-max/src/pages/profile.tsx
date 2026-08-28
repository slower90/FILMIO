import { useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetUserProfileQueryKey,
  getGetUserStatsQueryKey,
  getGetViewingHistoryQueryKey,
  getGetWatchlistQueryKey,
  getListMyRatingsQueryKey,
  getListReviewsQueryKey,
  useCreateConversation,
  useFollowUser,
  useGetUserProfile,
  useGetUserStats,
  useGetViewingHistory,
  useGetWatchlist,
  useListMyRatings,
  useListReviews,
  useUnfollowUser,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Clapperboard,
  Compass,
  Eye,
  Film,
  LogOut,
  MessageSquare,
  Network,
  Play,
  ShieldCheck,
  Star,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { ReviewCard } from "@/components/review-card";
import { Button } from "@/components/ui/button";
import { PersonalCinemaGraph } from "@/components/personal-cinema-graph";
import { createFollowPayload } from "@/lib/authenticated-flow-contracts";
import { useActiveProfile } from "@/lib/profile-context";
import { withMovieTitle } from "@/lib/movie-links";
import { buildProfileCinemaData, type ProfileMovie } from "@/lib/profile-identity";
import type { CinemaPreferences } from "@/lib/cinema-preferences";
import { tmdbPosterUrl } from "@/lib/utils";

const EMPTY = "Not enough public signal yet";

function initials(name?: string | null) {
  return (name || "F").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

function yearOf(date?: string | null) {
  return date?.slice(0, 4) || null;
}

function SectionHeading({ eyebrow, title, note, icon }: { eyebrow: string; title: string; note?: string; icon?: React.ReactNode }) {
  return (
    <div className="profile-section-heading">
      <div className="flex items-center gap-3">
        <span className="profile-heading-rule" />
        <span className="cinema-kicker">{icon}{eyebrow}</span>
      </div>
      <h2 className="profile-section-title">{title}</h2>
      {note && <p className="profile-section-note">{note}</p>}
    </div>
  );
}

function EmptyShelf({ children, privateShelf = false }: { children: React.ReactNode; privateShelf?: boolean }) {
  return (
    <div className="profile-empty-shelf">
      <span className="profile-empty-mark">{privateShelf ? <ShieldCheck aria-hidden="true" /> : <Clapperboard aria-hidden="true" />}</span>
      <p>{children}</p>
    </div>
  );
}

function PosterCard({ movie, rank, label }: { movie: ProfileMovie; rank?: number; label?: string }) {
  const title = movie.title || `Film ${movie.id}`;
  return (
    <Link
      href={withMovieTitle(`/movies/${movie.id}`, title)}
      className="profile-poster-card poster-lift"
      data-testid={`link-profile-film-${movie.id}`}
    >
      <div className="profile-poster-frame">
        {rank !== undefined && <span className="profile-rank">{String(rank).padStart(2, "0")}</span>}
        <img src={tmdbPosterUrl(movie.posterPath, "w342")} alt={`${title} poster`} loading="lazy" />
        <span className="profile-poster-shade" />
        {movie.score !== undefined && <span className="profile-poster-score"><Star aria-hidden="true" /> {movie.score}/10</span>}
      </div>
      <strong>{title}</strong>
      <span>{label || yearOf(movie.releaseDate) || "FILMIO CATALOG"}</span>
    </Link>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background film-grain">
      <Navbar />
      <main className="profile-skeleton container mx-auto max-w-6xl px-4 pt-32">
        <div className="profile-skeleton-orb" />
        <div className="profile-skeleton-line w-20" />
        <div className="profile-skeleton-line w-2/3 h-14 mt-8" />
        <div className="profile-skeleton-line w-1/2 mt-4" />
        <div className="profile-skeleton-grid mt-16"><span /><span /><span /><span /></div>
      </main>
    </div>
  );
}

function MovieOverviewShelves({ preferences }: { preferences?: CinemaPreferences }) {
  return (
    <>
      <section className="profile-dna-panel" aria-labelledby="film-dna-title">
        <SectionHeading eyebrow="02 / Chosen by you" title="FILM DNA" note="These are your explicit cinema preferences — FILMIO never infers them from activity." icon={<Compass className="h-3.5 w-3.5" aria-hidden="true" />} />
        <div className="profile-dna-grid">
          <DnaColumn label="Genre" value={preferences?.favoriteGenre} />
          <DnaColumn label="Country" value={preferences?.favoriteCountry} />
          <DnaColumn label="Language" value={preferences?.favoriteLanguage} />
        </div>
      </section>
      <div className="profile-two-column">
        <section className="profile-surface" aria-labelledby="favorite-directors-title">
          <SectionHeading eyebrow="03 / Your choice" title="FAVORITE DIRECTORS" icon={<Film className="h-3.5 w-3.5" aria-hidden="true" />} />
          <PeopleList titleId="favorite-directors-title" value={preferences?.favoriteDirector} />
        </section>
        <section className="profile-surface" aria-labelledby="favorite-actors-title">
          <SectionHeading eyebrow="04 / Your choice" title="FAVORITE ACTORS" icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />} />
          <PeopleList titleId="favorite-actors-title" value={preferences?.favoriteActor} />
        </section>
      </div>
    </>
  );
}

function DnaColumn({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="profile-dna-column">
      <p className="profile-micro-label">{label}</p>
      {value ? <div className="profile-dna-row"><span>{value}</span><span>Chosen by you</span></div> : <p className="profile-muted-copy">Not selected yet</p>}
    </div>
  );
}

function PeopleList({ titleId, value }: { titleId: string; value?: string | null }) {
  return value ? (
    <ol className="profile-people-list" aria-labelledby={titleId}>
      <li><span className="profile-person-number">01</span><span className="profile-person-name">{value}</span><span className="profile-person-count">Chosen by you</span></li>
    </ol>
  ) : <EmptyShelf>Not selected yet. Choose one in room settings.</EmptyShelf>;
}

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { activeProfile } = useActiveProfile();
  const isMe = !!id && currentUser?.id === id;
  const profileId = id || "";
  const profileParams = activeProfile ? { profileId: activeProfile.id } : undefined;

  const profileQuery = useGetUserProfile(profileId, { query: { queryKey: getGetUserProfileQueryKey(profileId), enabled: !!profileId } });
  const statsQuery = useGetUserStats(profileId, { query: { queryKey: getGetUserStatsQueryKey(profileId), enabled: !!profileId } });
  const reviewsQuery = useListReviews({ userId: profileId }, { query: { queryKey: getListReviewsQueryKey({ userId: profileId }), enabled: !!profileId } });
  const ratingsQuery = useListMyRatings(profileParams, { query: { queryKey: getListMyRatingsQueryKey(profileParams), enabled: isMe && !!activeProfile } });
  const historyQuery = useGetViewingHistory(profileParams, { query: { queryKey: getGetViewingHistoryQueryKey(profileParams), enabled: isMe && !!activeProfile } });
  const watchlistQuery = useGetWatchlist(profileParams, { query: { queryKey: getGetWatchlistQueryKey(profileParams), enabled: isMe && !!activeProfile } });
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();
  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const reviews = reviewsQuery.data || [];
  const cinemaData = useMemo(() => buildProfileCinemaData({
    isOwner: isMe,
    history: historyQuery.data || [],
    ratings: ratingsQuery.data || [],
    watchlist: watchlistQuery.data || [],
    reviews,
  }), [historyQuery.data, isMe, ratingsQuery.data, reviews, watchlistQuery.data]);
  const { history, ratings, watchlist, watchedIds, ratedMovies, watchedMovies, discoveries, topTen } = cinemaData;
  const likesReceived = reviews.reduce((total, review) => total + (review.likesCount || 0), 0);

  if (!userLoaded || profileQuery.isLoading) return <ProfileSkeleton />;
  if (profileQuery.isError) {
    return <div className="min-h-[100dvh] bg-background film-grain"><Navbar /><main className="profile-error container mx-auto max-w-2xl px-4 pt-40 text-center"><Clapperboard className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-6 text-3xl">This screening is unavailable</h1><p className="mt-3 text-muted-foreground">We could not load this cinema room right now.</p><Button type="button" className="mt-8" onClick={() => void profileQuery.refetch()} data-testid="button-retry-profile">Try again</Button></main></div>;
  }
  if (!profile) return null;

  const displayName = profile.displayName || profile.username || "FILMIO member";
  const filmsWatched = isMe ? watchedIds.size : null;
  const filmsRated = isMe ? ratings.length : (stats?.ratingsCount ?? null);
  const handleFollowToggle = () => {
    if (!profile) return;
    const mutation = profile.isFollowedByMe ? unfollowUser : followUser;
    mutation.mutate(createFollowPayload(profile.clerkId), { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profileId) }); void queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(profileId) }); } });
  };
  const handleMessage = () => {
    if (!currentUser) { setLocation(`/sign-in?redirect=${encodeURIComponent(`/profile/${profileId}`)}`); return; }
    createConversation.mutate({ data: { participantId: profile.clerkId } }, { onSuccess: (conversation) => setLocation(`/chat?conv=${conversation.id}`) });
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 film-grain profile-page">
      <Navbar />
      <header className="profile-hero">
        <div className="profile-hero-glow" />
        <div className="container relative z-10 mx-auto max-w-6xl px-4">
          <Link href={currentUser ? "/discover" : "/"} className="profile-back-link" data-testid="link-profile-back"><ArrowLeft aria-hidden="true" /> Return to the lobby</Link>
          <div className="profile-identity">
            <div className="profile-portrait-wrap">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={`${displayName} profile photo`} className="profile-portrait" data-testid="img-profile-avatar" /> : <div className="profile-portrait profile-portrait-fallback" data-testid="img-profile-avatar" aria-label={`${displayName} initials`}>{initials(displayName)}</div>}
              <span className="profile-portrait-index">FILMIO / {new Date(profile.createdAt).getFullYear()}</span>
            </div>
            <div className="profile-identity-copy">
              <div className="profile-identity-topline"><span className="cinema-kicker">Personal cinema room</span>{profile.isProfessional && <span className="profile-pro-badge"><BadgeCheck aria-hidden="true" /> Professional</span>}</div>
              <h1 data-testid="text-profile-name">{displayName}</h1>
              <p className="profile-handle" data-testid="text-profile-username">@{profile.username || "member"}</p>
              <p className="profile-archetype"><span>Archetype</span><strong>Not yet authored</strong><small>FILMIO will never guess a taste identity.</small></p>
              {profile.bio && <p className="profile-bio" data-testid="text-profile-bio">{profile.bio}</p>}
              <div className="profile-actions">
                {!isMe ? <><Button type="button" variant={profile.isFollowedByMe ? "outline" : "default"} onClick={handleFollowToggle} disabled={followUser.isPending || unfollowUser.isPending} className="profile-action-primary" data-testid="button-profile-follow">{profile.isFollowedByMe ? <><UserMinus aria-hidden="true" /> Unfollow</> : <><UserPlus aria-hidden="true" /> Follow</>}</Button><Button type="button" variant="outline" onClick={handleMessage} disabled={createConversation.isPending} data-testid="button-profile-message"><MessageSquare aria-hidden="true" /> {createConversation.isPending ? "Opening" : "Message"}</Button></> : <Button type="button" variant="outline" onClick={() => void signOut()} data-testid="button-profile-sign-out"><LogOut aria-hidden="true" /> Sign out</Button>}
                {profile.isProfessional && <Link href={`/professionals/${profile.id}`} className="profile-professional-link" data-testid="link-professional-profile"><Network aria-hidden="true" /> View professional profile</Link>}
              </div>
            </div>
            <div className="profile-stats-rail" aria-label="Profile statistics">
              <Stat label="Followers" value={stats?.followersCount ?? profile.followersCount} accent />
              <Stat label="Following" value={stats?.followingCount ?? profile.followingCount} />
              <Stat label="Films watched" value={filmsWatched} privateValue={!isMe} icon={<Eye aria-hidden="true" />} />
              <Stat label="Films rated" value={filmsRated} privateValue={!isMe} icon={<Star aria-hidden="true" />} />
              <Stat label="Reviews" value={stats?.reviewsCount ?? profile.reviewsCount} />
              <Stat label="Likes received" value={likesReceived} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4">
        <div className="profile-section-intro"><span className="cinema-kicker">A profile, in chapters</span><p>Some rooms are public. Some belong only to the person holding the ticket.</p></div>
        <section className="profile-universe-section" aria-labelledby="my-cinema-universe-title">
          <SectionHeading eyebrow="01 / The room itself" title="MY CINEMA UNIVERSE" note={isMe ? "A living constellation built from this viewing profile's real activity." : "This private shelf belongs to its owner."} icon={<Compass className="h-3.5 w-3.5" aria-hidden="true" />} />
           {isMe ? <PersonalCinemaGraph history={history} ratings={ratings} watchlist={watchlist} profileName={activeProfile?.name || displayName} preferences={activeProfile || undefined} /> : <EmptyShelf privateShelf><strong>Private viewing room.</strong> Watch history, ratings, and watchlist are visible only to their owner.</EmptyShelf>}
        </section>

         <MovieOverviewShelves preferences={isMe ? activeProfile || undefined : undefined} />
        {!isMe && <section className="profile-private-note"><ShieldCheck aria-hidden="true" /><div><p className="profile-micro-label">PRIVATE BY DESIGN</p><p>Personal ratings, watch history, watchlist, and taste connections stay with the viewing profile that created them.</p></div></section>}

        <section className="profile-surface profile-top-ten" aria-labelledby="top-ten-title">
          <SectionHeading eyebrow="05 / The shortlist" title="TOP 10" note={isMe ? "Highest personal ratings in this viewing profile." : "A ranking appears when this member chooses to make one public."} icon={<Star className="h-3.5 w-3.5" aria-hidden="true" />} />
          {isMe && topTen.length ? <div className="profile-poster-grid profile-poster-grid-top">{topTen.map((movie, index) => <PosterCard movie={movie} rank={index + 1} key={movie.id} label={`Rated ${movie.score}/10`} />)}</div> : <EmptyShelf privateShelf={!isMe}> {isMe ? "Rate films to start your shortlist." : "No public ranking shared."}</EmptyShelf>}
        </section>

        <div className="profile-shelf-pair">
          <section className="profile-surface" aria-labelledby="discoveries-title">
            <SectionHeading eyebrow="06 / Next screenings" title="DISCOVERIES" icon={<Play className="h-3.5 w-3.5" aria-hidden="true" />} />
            {isMe && discoveries.length ? <div className="profile-mini-poster-grid">{discoveries.map((movie) => <PosterCard movie={movie} key={movie.id} />)}</div> : <EmptyShelf privateShelf={!isMe}>{isMe ? "Save a film to give this shelf a first title." : "No public discoveries shared."}</EmptyShelf>}
          </section>
          <section className="profile-surface" aria-labelledby="watchlist-title">
            <SectionHeading eyebrow="07 / Held for later" title="WATCHLIST" icon={<Bookmark className="h-3.5 w-3.5" aria-hidden="true" />} />
            {isMe && watchlist.length ? <div className="profile-watchlist-list">{watchlist.slice(0, 5).map((entry) => <Link href={withMovieTitle(`/movies/${entry.movieId}`, entry.movieTitle || `Film ${entry.movieId}`)} key={entry.id} className="profile-watchlist-row" data-testid={`link-profile-watchlist-${entry.id}`}><img src={tmdbPosterUrl(entry.moviePosterPath, "w154")} alt="" loading="lazy" /><span><strong>{entry.movieTitle || `Film ${entry.movieId}`}</strong><small>{entry.status === "watched" ? "Watched" : "Want to watch"}</small></span><ArrowUpRight aria-hidden="true" /></Link>)}</div> : <EmptyShelf privateShelf={!isMe}>{isMe ? "Your watchlist is empty." : "This watchlist is private."}</EmptyShelf>}
          </section>
        </div>

        <section className="profile-journey" aria-labelledby="film-journey-title">
          <SectionHeading eyebrow="08 / The logbook" title="FILM JOURNEY" note={isMe ? "The films that have passed through this viewing room." : "A viewing history is private to its owner."} icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />} />
          {isMe && watchedMovies.length ? <div className="profile-journey-strip">{watchedMovies.slice(0, 8).map((movie, index) => <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)} className="profile-journey-card" key={`${movie.id}-${index}`} data-testid={`link-profile-journey-${movie.id}`}><span className="profile-journey-date">FRAME {String(index + 1).padStart(2, "0")}</span><img src={tmdbPosterUrl(movie.posterPath, "w342")} alt={`${movie.title} poster`} loading="lazy" /><strong>{movie.title}</strong><small>{yearOf(movie.releaseDate) || "Catalog year unavailable"}</small></Link>)}</div> : <EmptyShelf privateShelf={!isMe}>{isMe ? "Your journey begins with the first watched film." : "No public journey shared."}</EmptyShelf>}
        </section>

        <section className="profile-reviews-section" aria-labelledby="recent-reviews-title">
          <SectionHeading eyebrow="09 / In their words" title="RECENT REVIEWS" note={`${reviews.length} public review${reviews.length === 1 ? "" : "s"}`} icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />} />
          {reviews.length ? <div className="profile-reviews-grid">{reviews.slice(0, 6).map((review) => <ReviewCard key={review.id} review={review} />)}</div> : <EmptyShelf>{`${displayName} has not published a review yet.`}</EmptyShelf>}
          {reviews.length > 6 && <Link href={`/feed?user=${encodeURIComponent(profileId)}`} className="profile-more-link" data-testid="link-profile-more-reviews">Read all public reviews <ArrowUpRight aria-hidden="true" /></Link>}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, accent = false, privateValue = false, icon }: { label: string; value: number | null; accent?: boolean; privateValue?: boolean; icon?: React.ReactNode }) {
  return <div className="profile-stat" data-testid={`stat-profile-${label.toLowerCase().replace(/\s+/g, "-")}`}><span className={`profile-stat-value ${accent ? "is-accent" : ""}`}>{privateValue ? "—" : <>{icon}{value === null ? "—" : formatNumber(value)}</>}</span><span className="profile-stat-label">{label}</span></div>;
}