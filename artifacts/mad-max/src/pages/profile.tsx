import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyProfileQueryKey,
  getGetUserProfileQueryKey,
  getGetUserStatsQueryKey,
  getGetViewingHistoryQueryKey,
  getListProfilesQueryKey,
  getGetWatchlistQueryKey,
  getListMyRatingsQueryKey,
  getListReviewsQueryKey,
  useCreateConversation,
  useFollowUser,
  useGetMyProfile,
  useGetUserProfile,
  useGetUserStats,
  useGetViewingHistory,
  useGetWatchlist,
  useListMyRatings,
  useListReviews,
  useUpdateMyProfile,
  useUpdateProfile,
  useUnfollowUser,
} from "@workspace/api-client-react";
import type { FavoritePerson, ViewingProfile } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  Briefcase,
  CalendarDays,
  Clapperboard,
  Compass,
  Eye,
  Film,
  LogOut,
  MessageSquare,
  Network,
  Pencil,
  Play,
  Save,
  ShieldCheck,
  Star,
  UserMinus,
  UserPlus,
  Users,
  X,
  Search,
  Loader2,
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
import { resolveProfileId } from "@/lib/profile-route";
import { tmdbPosterUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LazyBlurImage } from "@/components/lazy-blur-image";
import { apiFetch } from "@/lib/api-url";

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
        <LazyBlurImage
          src={tmdbPosterUrl(movie.posterPath, "w342")}
          placeholderSrc={tmdbPosterUrl(movie.posterPath, "w92")}
          alt={`${title} poster`}
          width={342}
          height={513}
          wrapperClassName="absolute inset-0 h-full w-full"
        />
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

function ProfileSignInState() {
  return (
    <div className="min-h-[100dvh] bg-background film-grain">
      <Navbar />
      <main className="container mx-auto max-w-xl px-4 pt-40 text-center">
        <Clapperboard className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <p className="mt-6 cinema-kicker">Your cinematic identity</p>
        <h1 className="mt-4 text-3xl font-display font-bold uppercase tracking-wide">Sign in to open your profile</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Keep your public identity, cinema universe, and activity in one place.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="min-h-12"><Link href="/sign-in?redirect=%2Fprofile">Sign in</Link></Button>
          <Button asChild variant="outline" className="min-h-12"><Link href="/sign-up?redirect=%2Fprofile">Create account</Link></Button>
        </div>
      </main>
    </div>
  );
}

function ProfileUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-background film-grain">
      <Navbar />
      <main className="profile-error container mx-auto max-w-2xl px-4 pt-40 text-center">
        <Clapperboard className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-6 text-3xl">This screening is unavailable</h1>
        <p className="mt-3 text-muted-foreground">We could not load this cinema room right now.</p>
        <Button type="button" className="mt-8 min-h-12" onClick={onRetry} data-testid="button-retry-profile">Try again</Button>
      </main>
    </div>
  );
}

type PublicProfileDraft = {
  displayName: string;
  bio: string;
  avatarUrl: string;
  favoriteGenres: string;
  favoriteActors: FavoritePerson[];
  favoriteDirectors: FavoritePerson[];
};

function profileDraftFrom(
  profile: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
  favoriteGenres?: string | null,
  favoriteActors: FavoritePerson[] = [],
  favoriteDirectors: FavoritePerson[] = [],
): PublicProfileDraft {
  return {
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    favoriteGenres: favoriteGenres ?? "",
    favoriteActors,
    favoriteDirectors,
  };
}

function getMutationError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  const responseError = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return responseError || "We could not save your profile. Please try again.";
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
          <PeopleList titleId="favorite-directors-title" value={preferences?.favoriteDirector} people={preferences?.favoriteDirectors} />
        </section>
        <section className="profile-surface" aria-labelledby="favorite-actors-title">
          <SectionHeading eyebrow="04 / Your choice" title="FAVORITE ACTORS" icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />} />
          <PeopleList titleId="favorite-actors-title" value={preferences?.favoriteActor} people={preferences?.favoriteActors} />
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

function PeopleList({ titleId, value, people = [] }: { titleId: string; value?: string | null; people?: FavoritePerson[] }) {
  const displayPeople = people.length ? people : value ? [{ id: 0, name: value, profilePath: null }] : [];
  return displayPeople.length ? (
    <ol className="profile-people-list" aria-labelledby={titleId}>
      {displayPeople.map((person, index) => (
        <li key={`${person.id}-${person.name}`}>
          <span className="profile-person-number">{String(index + 1).padStart(2, "0")}</span>
          {person.profilePath && <img src={tmdbPosterUrl(person.profilePath, "w185")} alt="" className="h-10 w-7 rounded-sm object-cover" />}
          <span className="profile-person-name">{person.name}</span>
          <span className="profile-person-count">Chosen by you</span>
        </li>
      ))}
    </ol>
  ) : <EmptyShelf>Not selected yet. Choose one in room settings.</EmptyShelf>;
}

function FavoritePeoplePicker({
  kind,
  selected,
  onChange,
}: {
  kind: "actor" | "director";
  selected: FavoritePerson[];
  onChange: (people: FavoritePerson[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FavoritePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const label = kind === "actor" ? "actors" : "directors";

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await apiFetch(`/api/movies/people?q=${encodeURIComponent(trimmed)}&department=${kind === "actor" ? "Acting" : "Directing"}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json() as { results?: FavoritePerson[] };
        setResults((data.results ?? []).filter((person) => !selected.some((chosen) => chosen.id === person.id)));
      } catch (searchError) {
        if (!(searchError instanceof DOMException && searchError.name === "AbortError")) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, selected]);

  const addPerson = (person: FavoritePerson) => {
    if (selected.length >= 12 || selected.some((chosen) => chosen.id === person.id)) return;
    onChange([...selected, person]);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="md:col-span-2">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor={`favorite-${kind}-search`}>
        Favorite {label}
      </label>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id={`favorite-${kind}-search`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-12 w-full rounded-sm border border-border bg-background pl-10 pr-10 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={`Search ${label} by name`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={query.trim().length >= 2}
          aria-controls={`favorite-${kind}-results`}
          data-testid={`input-favorite-${kind}`}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-label={`Searching ${label}`} />}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label={`Selected favorite ${label}`}>
          {selected.map((person) => (
            <span key={person.id} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 text-xs text-foreground">
              {person.name}
              <button type="button" onClick={() => onChange(selected.filter((chosen) => chosen.id !== person.id))} className="rounded-full p-1 text-muted-foreground hover:bg-primary/15 hover:text-primary" aria-label={`Remove ${person.name} from favorite ${label}`} data-testid={`button-remove-favorite-${kind}-${person.id}`}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && (
        <div id={`favorite-${kind}-results`} role="listbox" className="mt-2 overflow-hidden rounded-sm border border-border bg-card shadow-lg">
          {error ? <p className="px-3 py-3 text-xs text-destructive">Could not search right now. Try again.</p> : results.length ? results.map((person) => (
            <button key={person.id} type="button" role="option" onClick={() => addPerson(person)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm hover:bg-primary/10 focus:bg-primary/10 focus:outline-none">
              {person.profilePath ? <img src={tmdbPosterUrl(person.profilePath, "w185")} alt="" className="h-9 w-7 rounded-sm object-cover" /> : <span className="grid h-9 w-7 place-items-center rounded-sm bg-muted text-[10px] text-muted-foreground">?</span>}
              <span>{person.name}</span>
            </button>
          )) : !loading && (
            <div className="px-3 py-3">
              <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.12em]">THE CAMERA FOUND NOTHING HERE.</p>
              <p className="mt-1 text-xs text-muted-foreground">Nothing matches exactly. Try a different spelling.</p>
            </div>
          )}
        </div>
      )}
      <span className="mt-2 block text-[11px] normal-case tracking-normal text-muted-foreground">{selected.length}/12 selected. These choices shape your recommendations.</span>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user: currentUser, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { activeProfile } = useActiveProfile();
  const { toast } = useToast();
  const profileId = resolveProfileId(id, currentUser?.id);
  const isMe = !!currentUser && currentUser.id === profileId;
  const profileParams = activeProfile ? { profileId: activeProfile.id } : undefined;

  const profileQuery = useGetUserProfile(profileId, { query: { queryKey: getGetUserProfileQueryKey(profileId), enabled: userLoaded && !!profileId } });
  const statsQuery = useGetUserStats(profileId, { query: { queryKey: getGetUserStatsQueryKey(profileId), enabled: !!profileId } });
  const reviewsQuery = useListReviews({ userId: profileId }, { query: { queryKey: getListReviewsQueryKey({ userId: profileId }), enabled: !!profileId } });
  const ratingsQuery = useListMyRatings(profileParams, { query: { queryKey: getListMyRatingsQueryKey(profileParams), enabled: isMe && !!activeProfile } });
  const historyQuery = useGetViewingHistory(profileParams, { query: { queryKey: getGetViewingHistoryQueryKey(profileParams), enabled: isMe && !!activeProfile } });
  const watchlistQuery = useGetWatchlist(profileParams, { query: { queryKey: getGetWatchlistQueryKey(profileParams), enabled: isMe && !!activeProfile } });
  const myProfileQuery = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: isMe } });
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();
  const createConversation = useCreateConversation();
  const updateMyProfile = useUpdateMyProfile();
  const updateViewingProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PublicProfileDraft | null>(null);
  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const reviews = reviewsQuery.data || [];
  const identityProfile = myProfileQuery.data || profile;

  useEffect(() => {
    if (!editing && isMe && identityProfile) {
       setDraft(profileDraftFrom(identityProfile, activeProfile?.favoriteGenre, activeProfile?.favoriteActors, activeProfile?.favoriteDirectors));
    }
  }, [activeProfile?.favoriteGenre, editing, identityProfile, isMe]);

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
  if (!id && !currentUser) return <ProfileSignInState />;
  if (profileQuery.isError) {
    return <ProfileUnavailable onRetry={() => void profileQuery.refetch()} />;
  }
  if (!profile) return <ProfileUnavailable onRetry={() => void profileQuery.refetch()} />;

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
  const openEditor = () => {
    setDraft(profileDraftFrom(identityProfile || profile, activeProfile?.favoriteGenre, activeProfile?.favoriteActors, activeProfile?.favoriteDirectors));
    setEditing(true);
  };
  const saveProfile = async () => {
    if (!draft) return;
    const nextDisplayName = draft.displayName.trim();
    const nextAvatarUrl = draft.avatarUrl.trim();
    if (!nextDisplayName) {
      toast({ variant: "destructive", title: "Name required", description: "Add a display name before saving." });
      return;
    }
    if (nextAvatarUrl) {
      try {
        const parsed = new URL(nextAvatarUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid");
      } catch {
        toast({ variant: "destructive", title: "Picture URL is invalid", description: "Use a complete http:// or https:// image URL." });
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile.mutateAsync({
        data: {
          displayName: nextDisplayName,
          bio: draft.bio.trim(),
          avatarUrl: nextAvatarUrl,
        },
      });
       if (activeProfile && (
         draft.favoriteGenres.trim() !== (activeProfile.favoriteGenre || "") ||
         JSON.stringify(draft.favoriteActors) !== JSON.stringify(activeProfile.favoriteActors ?? []) ||
         JSON.stringify(draft.favoriteDirectors) !== JSON.stringify(activeProfile.favoriteDirectors ?? [])
       )) {
        await updateViewingProfile.mutateAsync({
          profileId: activeProfile.id,
           data: {
             favoriteGenre: draft.favoriteGenres.trim() || null,
             favoriteActors: draft.favoriteActors,
             favoriteDirectors: draft.favoriteDirectors,
           },
        });
      }
      queryClient.setQueryData(getGetMyProfileQueryKey(), updated);
      queryClient.setQueryData(getGetUserProfileQueryKey(profileId), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(profileId) }),
        queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() }),
      ]);
      const profiles = queryClient.getQueryData<ViewingProfile[]>(getListProfilesQueryKey());
      if (profiles && activeProfile) {
        queryClient.setQueryData(
          getListProfilesQueryKey(),
          profiles.map((room) => room.id === activeProfile.id
            ? { ...room, favoriteGenre: draft.favoriteGenres.trim() || null, favoriteActors: draft.favoriteActors, favoriteDirectors: draft.favoriteDirectors }
            : room),
        );
      }
      setEditing(false);
      toast({ title: "Profile saved", description: "Your public identity and cinema preferences are up to date." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save profile", description: getMutationError(error) });
    } finally {
      setSaving(false);
    }
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
                 {!isMe ? <><Button type="button" variant={profile.isFollowedByMe ? "outline" : "default"} onClick={handleFollowToggle} disabled={followUser.isPending || unfollowUser.isPending} className="profile-action-primary" data-testid="button-profile-follow">{profile.isFollowedByMe ? <><UserMinus aria-hidden="true" /> Unfollow</> : <><UserPlus aria-hidden="true" /> Follow</>}</Button><Button type="button" variant="outline" onClick={handleMessage} disabled={createConversation.isPending} data-testid="button-profile-message"><MessageSquare aria-hidden="true" /> {createConversation.isPending ? "Opening" : "Message"}</Button></> : <><Button type="button" variant="default" onClick={openEditor} className="profile-action-primary" data-testid="button-edit-profile"><Pencil aria-hidden="true" /> Edit profile</Button><Button type="button" variant="outline" onClick={() => void signOut()} data-testid="button-profile-sign-out"><LogOut aria-hidden="true" /> Sign out</Button></>}
                {profile.isProfessional && <Link href={`/professionals/${profile.id}`} className="profile-professional-link" data-testid="link-professional-profile"><Network aria-hidden="true" /> View professional profile</Link>}
                 {isMe && <Link href="/professionals/dashboard" className="profile-professional-link" data-testid="link-edit-professional-profile"><Briefcase aria-hidden="true" /> {profile.isProfessional ? "Edit professional profile" : "Build professional profile"}</Link>}
              </div>
            </div>
            <div className="profile-stats-rail" aria-label="Profile statistics">
              <Stat label="Followers" value={stats?.followersCount ?? profile.followersCount} accent />
              <Stat label="Following" value={stats?.followingCount ?? profile.followingCount} />
              <Stat label="Films watched" value={filmsWatched} privateValue={!isMe} icon={<Eye aria-hidden="true" />} />
              <Stat label="Films rated" value={filmsRated} privateValue={!isMe} icon={<Star aria-hidden="true" />} />
              <Stat label="Reviews" value={stats?.reviewsCount ?? profile.reviewsCount} />
               <Stat label="Watchlist" value={stats?.watchlistCount ?? null} privateValue={!isMe} icon={<Bookmark aria-hidden="true" />} />
              <Stat label="Likes received" value={likesReceived} />
            </div>
          </div>
        </div>
      </header>

       {isMe && editing && draft && (
         <section className="container mx-auto max-w-6xl px-4 pt-8" aria-labelledby="edit-profile-title">
           <div className="rounded-md border border-primary/30 bg-card/70 p-5 shadow-[0_18px_50px_hsl(var(--ink)/0.16)] sm:p-7">
             <div className="flex items-start justify-between gap-4">
               <div>
                 <p className="cinema-kicker">Public identity</p>
                 <h2 id="edit-profile-title" className="mt-2 text-2xl font-display font-bold uppercase">Edit your profile</h2>
                 <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">These details are visible on your public FILMIO profile. Your viewing history, ratings, and watchlist remain private.</p>
               </div>
               <button type="button" onClick={() => setEditing(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label="Close profile editor">
                 <X className="h-5 w-5" aria-hidden="true" />
               </button>
             </div>
             <div className="mt-7 grid gap-5 md:grid-cols-2">
               <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                 Display name
                 <input value={draft.displayName} maxLength={80} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="mt-2 min-h-12 w-full rounded-sm border border-border bg-background px-3 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" autoComplete="name" />
               </label>
               <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                 Profile picture URL
                 <input value={draft.avatarUrl} maxLength={500} onChange={(event) => setDraft({ ...draft, avatarUrl: event.target.value })} className="mt-2 min-h-12 w-full rounded-sm border border-border bg-background px-3 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="https://…" inputMode="url" />
                 <span className="mt-2 block text-[11px] normal-case tracking-normal text-muted-foreground">Use a public JPG, PNG, or WebP image URL. Clear it to use initials.</span>
               </label>
               <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground md:col-span-2">
                 Bio
                 <textarea value={draft.bio} maxLength={500} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} className="mt-2 min-h-28 w-full resize-y rounded-sm border border-border bg-background px-3 py-3 text-base leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Tell other film lovers what you look for in a story." />
                 <span className="mt-2 block text-right text-[11px] normal-case tracking-normal text-muted-foreground">{draft.bio.length}/500</span>
               </label>
               <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground md:col-span-2">
                 Favorite genres
                 <input value={draft.favoriteGenres} maxLength={160} onChange={(event) => setDraft({ ...draft, favoriteGenres: event.target.value })} className="mt-2 min-h-12 w-full rounded-sm border border-border bg-background px-3 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Drama, thriller, romance" />
                 <span className="mt-2 block text-[11px] normal-case tracking-normal text-muted-foreground">Separate genres with commas. This updates the active viewing room.</span>
               </label>
                <FavoritePeoplePicker kind="actor" selected={draft.favoriteActors} onChange={(favoriteActors) => setDraft({ ...draft, favoriteActors })} />
                <FavoritePeoplePicker kind="director" selected={draft.favoriteDirectors} onChange={(favoriteDirectors) => setDraft({ ...draft, favoriteDirectors })} />
             </div>
             <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
               <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving} className="min-h-12 sm:min-w-32">Cancel</Button>
               <Button type="button" onClick={() => void saveProfile()} disabled={saving} className="min-h-12 sm:min-w-40" data-testid="button-save-profile">
                 <Save className="mr-2 h-4 w-4" aria-hidden="true" /> {saving ? "Saving…" : "Save changes"}
               </Button>
               <Link href="/profiles" className="inline-flex min-h-12 items-center justify-center px-3 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 sm:ml-auto">Full viewing-room settings <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
             </div>
           </div>
         </section>
       )}

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
            {isMe && watchlist.length ? <div className="profile-watchlist-list">{watchlist.slice(0, 5).map((entry) => <Link href={withMovieTitle(`/movies/${entry.movieId}`, entry.movieTitle || `Film ${entry.movieId}`)} key={entry.id} className="profile-watchlist-row" data-testid={`link-profile-watchlist-${entry.id}`}><LazyBlurImage src={tmdbPosterUrl(entry.moviePosterPath, "w154")} placeholderSrc={tmdbPosterUrl(entry.moviePosterPath, "w92")} alt="" width={154} height={231} className="h-full w-full object-cover" wrapperClassName="h-16 w-[2.7rem]" /><span><strong>{entry.movieTitle || `Film ${entry.movieId}`}</strong><small>{entry.status === "watched" ? "Watched" : "Want to watch"}</small></span><ArrowUpRight aria-hidden="true" /></Link>)}</div> : <EmptyShelf privateShelf={!isMe}>{isMe ? "Your watchlist is empty." : "This watchlist is private."}</EmptyShelf>}
          </section>
        </div>

        <section className="profile-journey" aria-labelledby="film-journey-title">
          <SectionHeading eyebrow="08 / The logbook" title="FILM JOURNEY" note={isMe ? "The films that have passed through this viewing room." : "A viewing history is private to its owner."} icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />} />
            {isMe && watchedMovies.length ? <div className="profile-journey-strip">{watchedMovies.slice(0, 8).map((movie, index) => <Link href={withMovieTitle(`/movies/${movie.id}`, movie.title)} className="profile-journey-card" key={`${movie.id}-${index}`} data-testid={`link-profile-journey-${movie.id}`}><span className="profile-journey-date">FRAME {String(index + 1).padStart(2, "0")}</span><LazyBlurImage src={tmdbPosterUrl(movie.posterPath, "w342")} placeholderSrc={tmdbPosterUrl(movie.posterPath, "w92")} alt={`${movie.title} poster`} width={342} height={513} wrapperClassName="w-full" /><strong>{movie.title}</strong><small>{yearOf(movie.releaseDate) || "Catalog year unavailable"}</small></Link>)}</div> : <EmptyShelf privateShelf={!isMe}>{isMe ? "Your journey begins with the first watched film." : "No public journey shared."}</EmptyShelf>}
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