import { useUser } from "@clerk/react";
import {
  getGetFriendsOverviewQueryKey,
  type FriendRequest,
  type FriendUser,
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useGetFriendsOverview,
  useCreateConversation,
  useSendFriendRequest,
  useUnfriendUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Inbox,
  Loader2,
  Search,
  Send,
  UserCheck,
  UserMinus,
  UserPlus,
  MessageSquare,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";

type FriendsTab = "discover" | "requests" | "friends";

function errorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "F";
}

function personName(person: FriendUser) {
  return person.displayName?.trim() || person.username?.trim() || "FILMIO member";
}

function personHandle(person: FriendUser) {
  return person.username?.trim() ? `@${person.username.trim()}` : "FILMIO member";
}

function Avatar({ person, large = false }: { person: FriendUser; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = personName(person);
  const size = large ? "h-16 w-16 text-base" : "h-12 w-12 text-sm";

  if (person.avatarUrl && !imageFailed) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        onError={() => setImageFailed(true)}
        className={`${size} shrink-0 rounded-full border border-border/80 object-cover`}
      />
    );
  }

  return (
    <span aria-hidden="true" className={`friends-avatar-ring ${large ? "h-16 w-16 text-base" : ""}`}>
      {initials(name)}
    </span>
  );
}

function RelativeDate({ date }: { date: string }) {
  const parsed = new Date(date);
  const label = Number.isNaN(parsed.getTime())
    ? "Recently"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed);
  return <time dateTime={date}>{label}</time>;
}

function PersonCard({
  person,
  busy,
  onSend,
  onCancel,
  onUnfriend,
  onMessage,
  onAccept,
  onDecline,
}: {
  person: FriendUser;
  busy: string | null;
  onSend: (id: number) => void;
  onCancel: (id: number) => void;
  onUnfriend: (id: number) => void;
  onMessage: (id: number) => void;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
}) {
  const name = personName(person);
  const actionBusy =
    busy === `send-${person.id}` ||
    busy === `cancel-${person.id}` ||
    busy === `unfriend-${person.id}` ||
    (person.requestId !== null &&
      (busy === `accept-${person.requestId}` || busy === `decline-${person.requestId}`));

  return (
    <article className="friends-person-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${person.id}`} className="shrink-0 rounded-full" aria-label={`View ${name}'s profile`}>
          <Avatar person={person} />
        </Link>
        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${person.id}`} className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary">
              {name}
            </Link>
            {person.isProfessional && <BadgeCheck aria-label="Film professional" className="h-4 w-4 shrink-0 text-primary" />}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{personHandle(person)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {person.relationship === "friends" && (
          <>
            <Button type="button" variant="outline" size="sm" disabled className="gap-1.5 border-primary/35 bg-primary/5 text-primary">
              <UserCheck className="h-3.5 w-3.5" /> Friends
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onUnfriend(person.id)}
              disabled={actionBusy}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              aria-label={`Unfriend ${name}`}
            >
              {busy === `unfriend-${person.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
              Unfriend
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMessage(person.id)}
              className="gap-1.5 text-muted-foreground hover:text-primary"
              aria-label={`Message ${name}`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Message
            </Button>
          </>
        )}
        {person.relationship === "outgoing" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCancel(person.id)}
            disabled={actionBusy}
            title="Cancel friend request"
            className="gap-1.5 border-primary/30 text-primary"
          >
            {busy === `cancel-${person.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock3 className="h-3.5 w-3.5" />}
            Request Sent
          </Button>
        )}
        {person.relationship === "incoming" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--friends-coral)/0.35)] bg-[hsl(var(--friends-coral)/0.08)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--friends-coral))]">
              <Inbox className="h-3.5 w-3.5" /> Incoming request
            </span>
            {person.requestId !== null && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAccept(person.requestId as number)}
                  disabled={actionBusy}
                  className="gap-1.5"
                >
                  {busy === `accept-${person.requestId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDecline(person.requestId as number)}
                  disabled={actionBusy}
                  className="gap-1.5"
                >
                  {busy === `decline-${person.requestId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Decline
                </Button>
              </>
            )}
          </div>
        )}
        {person.relationship === "none" && (
          <Button type="button" size="sm" onClick={() => onSend(person.id)} disabled={actionBusy} className="gap-1.5">
            {busy === `send-${person.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Add Friend
          </Button>
        )}
      </div>
    </article>
  );
}

function RequestCard({
  request,
  direction,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  request: FriendRequest;
  direction: "incoming" | "outgoing";
  busy: string | null;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  const name = personName(request.user);
  const actionBusy = busy === `accept-${request.id}` || busy === `decline-${request.id}` || busy === `cancel-request-${request.id}`;

  return (
    <article className="flex flex-col gap-4 border-b border-border/70 py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={`/profile/${request.user.id}`} className="shrink-0 rounded-full" aria-label={`View ${name}'s profile`}>
          <Avatar person={request.user} />
        </Link>
        <div className="min-w-0">
          <Link href={`/profile/${request.user.id}`} className="block truncate text-sm font-semibold transition-colors hover:text-primary">{name}</Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {direction === "incoming" ? "Wants to join your screening circle" : "Waiting for a reply"} · <RelativeDate date={request.createdAt} />
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {direction === "incoming" ? (
          <>
            <Button type="button" size="sm" onClick={() => onAccept(request.id)} disabled={actionBusy} className="gap-1.5">
              {busy === `accept-${request.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Accept
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onDecline(request.id)} disabled={actionBusy} className="gap-1.5">
              {busy === `decline-${request.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Decline
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => onCancel(request.id)} disabled={actionBusy} className="gap-1.5 text-muted-foreground">
            {busy === `cancel-request-${request.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Cancel
          </Button>
        )}
      </div>
    </article>
  );
}

function LobbySkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="friends-person-card friends-skeleton p-5" aria-label="Loading people">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-full bg-background/30" />
            <span className="h-4 w-32 rounded bg-background/30" />
          </div>
          <span className="h-8 w-28 rounded bg-background/30" />
        </div>
      ))}
    </div>
  );
}

export default function Friends() {
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FriendsTab>("discover");
  const [busy, setBusy] = useState<string | null>(null);

  const params = useMemo(() => {
    const trimmed = query.trim();
    return trimmed ? { q: trimmed, limit: 60 } : { limit: 60 };
  }, [query]);

  const overviewQuery = useGetFriendsOverview(params, {
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey: getGetFriendsOverviewQueryKey(params),
      staleTime: 30_000,
    },
  });
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const unfriendUser = useUnfriendUser();
  const createConversation = useCreateConversation();

  const overview = overviewQuery.data;
  const people = overview?.users ?? [];
  const friends = overview?.friends ?? [];
  const incomingRequests = overview?.incomingRequests ?? [];
  const outgoingRequests = overview?.outgoingRequests ?? [];

  const refreshOverview = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetFriendsOverviewQueryKey() });
  };

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      await refreshOverview();
      toast.success(success);
    } catch (error) {
      toast.error(errorText(error, "That connection could not be updated. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const send = (id: number) => void runAction(`send-${id}`, () => sendRequest.mutateAsync({ id }), "Friend request sent.");
  const accept = (id: number) => void runAction(`accept-${id}`, () => acceptRequest.mutateAsync({ id }), "You are friends now.");
  const decline = (id: number) => void runAction(`decline-${id}`, () => declineRequest.mutateAsync({ id }), "Request declined.");
  const cancel = (id: number) => void runAction(`cancel-request-${id}`, () => cancelRequest.mutateAsync({ id }), "Friend request cancelled.");
  const cancelFromPerson = (id: number) => {
    const request = outgoingRequests.find((item) => item.user.id === id);
    if (request) void runAction(`cancel-${id}`, () => cancelRequest.mutateAsync({ id: request.id }), "Friend request cancelled.");
  };
  const unfriend = (id: number) => {
    const name = personName(friends.find((person) => person.id === id) ?? { id, displayName: "FILMIO member", username: null, avatarUrl: null, isProfessional: false, relationship: "friends", requestId: null });
    void runAction(`unfriend-${id}`, () => unfriendUser.mutateAsync({ id }), `${name} was removed from your friends.`);
  };
  const message = (id: number) => {
    createConversation.mutate(
      { data: { participantId: String(id) } },
      {
        onSuccess: (conversation) => {
          window.location.href = `/chat?conv=${conversation.id}`;
        },
        onError: (error) => {
          toast.error(errorText(error, "That conversation could not be opened."));
        },
      },
    );
  };

  if (!isLoaded) {
    return (
      <div className="friends-lobby min-h-[100dvh]">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6">
          <div className="friends-hero h-64 animate-pulse" aria-label="Loading friends lobby" />
        </main>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="friends-lobby min-h-[100dvh]">
        <Navbar />
        <main className="mx-auto flex min-h-[100dvh] max-w-6xl items-center px-4 pb-20 pt-28 sm:px-6">
          <section className="friends-surface mx-auto w-full max-w-2xl px-6 py-12 text-center sm:px-12">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--friends-coral)/0.38)] bg-[hsl(var(--friends-coral)/0.08)] text-[hsl(var(--friends-coral))]">
              <UsersRound className="h-7 w-7" />
            </span>
            <p className="cinema-kicker mt-7">The screening lobby</p>
            <h1 className="mt-4 text-3xl sm:text-5xl">Your people are in the next room.</h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Sign in to find movie lovers, send friend requests, and keep your watch-circle close between screenings.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/sign-in?redirect=%2Ffriends">Sign In</Link></Button>
              <Button asChild variant="outline" size="lg"><Link href="/sign-up?redirect=%2Ffriends">Create an account</Link></Button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="friends-lobby min-h-[100dvh] pb-20">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-6 lg:pt-32">
        <section className="friends-hero px-5 py-7 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div className="friends-hero-copy max-w-3xl">
            <p className="cinema-kicker">FILMIO / Friends</p>
            <h1 className="friends-hero-title mt-5">Find your <em>people.</em></h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              A good film gets better in company. Build a circle of fellow movie lovers and make the next recommendation personal.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-flex items-center gap-2 text-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--friends-coral))]" /> Real people, real watches</span>
              <span>Professionals have their own network</span>
            </div>
          </div>
          <div className="friends-hero-stats mt-9 grid max-w-md grid-cols-3 gap-4 lg:absolute lg:right-12 lg:top-12 lg:mt-0">
            <div className="friends-stat"><strong>{overview?.counts?.friends ?? 0}</strong><span>Friends</span></div>
            <div className="friends-stat"><strong>{overview?.counts?.incoming ?? 0}</strong><span>To review</span></div>
            <div className="friends-stat"><strong>{overview?.counts?.outgoing ?? 0}</strong><span>Sent</span></div>
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 border-b border-border/75 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex gap-6 overflow-x-auto" role="tablist" aria-label="Friends views">
            {([
              ["discover", "Find people", people.length],
              ["requests", "Requests", incomingRequests.length + outgoingRequests.length],
              ["friends", "My friends", friends.length],
            ] as const).map(([tab, label, count]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className="friends-tab whitespace-nowrap"
              >
                {label} <span className="ml-1 text-[hsl(var(--friends-coral))]">{count}</span>
              </button>
            ))}
          </div>
          {activeTab === "discover" && (
            <label className="friends-search relative mb-3 flex h-11 w-full items-center rounded-sm sm:mb-3 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                maxLength={80}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or username"
                aria-label="Search friends by name or username"
                className="h-full w-full bg-transparent pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}
        </div>

        {overviewQuery.isError ? (
          <section className="friends-surface mt-7 px-6 py-12 text-center" role="alert">
            <X className="mx-auto h-8 w-8 text-destructive" />
            <h2 className="mt-4 text-xl">The lobby lights are down.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{errorText(overviewQuery.error, "Friends are unavailable right now.")}</p>
            <Button type="button" variant="outline" onClick={() => void overviewQuery.refetch()} className="mt-6">Try again</Button>
          </section>
        ) : overviewQuery.isLoading ? (
          <section className="mt-7" aria-busy="true"><LobbySkeleton /></section>
        ) : activeTab === "discover" ? (
          <section className="friends-surface mt-7 p-4 sm:p-6" aria-labelledby="directory-heading">
            <div className="flex flex-col gap-2 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cinema-kicker">Open seats</p>
                <h2 id="directory-heading" className="mt-2 text-2xl normal-case tracking-[-0.04em]">People who love a good watch</h2>
              </div>
              <p className="text-xs text-muted-foreground">{people.length ? `${people.length} people in your frame` : "No one in this frame yet"}</p>
            </div>
            {people.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map((person) => (
                   <PersonCard key={person.id} person={person} busy={busy} onSend={send} onCancel={cancelFromPerson} onUnfriend={unfriend} onMessage={message} onAccept={accept} onDecline={decline} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-[hsl(var(--friends-coral))]" />
                <h3 className="mt-4 text-lg">{query.trim() ? "No matching movie lovers." : "Your next movie friend is not here yet."}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {query.trim() ? "Try a different name or username." : "Try a broader search, then send the first invitation."}
                </p>
              </div>
            )}
          </section>
        ) : activeTab === "friends" ? (
          <section className="friends-surface mt-7 p-4 sm:p-6" aria-labelledby="friends-heading">
            <div className="border-b border-border/70 pb-5">
              <p className="cinema-kicker">Your screening circle</p>
              <h2 id="friends-heading" className="mt-2 text-2xl normal-case tracking-[-0.04em]">Friends</h2>
            </div>
            {friends.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {friends.map((person) => (
                   <PersonCard key={person.id} person={person} busy={busy} onSend={send} onCancel={cancelFromPerson} onUnfriend={unfriend} onMessage={message} onAccept={accept} onDecline={decline} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <UserCheck className="mx-auto h-8 w-8 text-[hsl(var(--friends-coral))]" />
                <h3 className="mt-4 text-lg">No friends in your circle yet.</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Find someone whose movie taste makes you curious, then invite them in.</p>
                <Button type="button" onClick={() => setActiveTab("discover")} className="mt-6 gap-2">Find people <ArrowRight className="h-4 w-4" /></Button>
              </div>
            )}
          </section>
        ) : (
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <section className="friends-surface p-5 sm:p-6" aria-labelledby="incoming-heading">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-5">
                <div>
                  <p className="cinema-kicker">Your turn</p>
                  <h2 id="incoming-heading" className="mt-2 text-xl normal-case tracking-[-0.03em]">Friend requests</h2>
                </div>
                <span className="rounded-full border border-[hsl(var(--friends-coral)/0.35)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--friends-coral))]">{incomingRequests.length}</span>
              </div>
              <div className="mt-5">
                {incomingRequests.length ? incomingRequests.map((request) => (
                  <RequestCard key={request.id} request={request} direction="incoming" busy={busy} onAccept={accept} onDecline={decline} onCancel={cancel} />
                )) : (
                  <div className="py-8 text-center">
                    <Inbox className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold">All caught up.</p>
                    <p className="mt-1 text-xs text-muted-foreground">New invitations will land here.</p>
                  </div>
                )}
              </div>
            </section>
            <section className="friends-surface p-5 sm:p-6" aria-labelledby="outgoing-heading">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-5">
                <div>
                  <p className="cinema-kicker">In the wings</p>
                  <h2 id="outgoing-heading" className="mt-2 text-xl normal-case tracking-[-0.03em]">Sent requests</h2>
                </div>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted-foreground">{outgoingRequests.length}</span>
              </div>
              <div className="mt-5">
                {outgoingRequests.length ? outgoingRequests.map((request) => (
                  <RequestCard key={request.id} request={request} direction="outgoing" busy={busy} onAccept={accept} onDecline={decline} onCancel={cancel} />
                )) : (
                  <div className="py-8 text-center">
                    <Send className="mx-auto h-7 w-7 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold">No invitations out.</p>
                    <p className="mt-1 text-xs text-muted-foreground">The next great connection can start with you.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        <section className="mt-6 flex flex-col gap-4 rounded-lg border border-border/70 bg-card/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="cinema-kicker">For the working set</p>
            <h2 className="mt-2 text-lg normal-case tracking-[-0.02em]">Looking for collaborators?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Keep professional introductions, roles, and opportunities in the Industry Network.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0 gap-2"><Link href="/professionals">Open Industry Network <ArrowRight className="h-4 w-4" /></Link></Button>
        </section>
      </main>
    </div>
  );
}