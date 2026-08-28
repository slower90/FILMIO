import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { tmdbPosterUrl } from "@/lib/utils";
import {
  getGetPostsFeedQueryKey,
  getListPostCommentsQueryKey,
  getSearchMoviesQueryKey,
  type MovieSummary,
  type Post,
  type PostComment,
  type PostFeedResponse,
  type Story,
  useCreatePost,
  useCreatePostComment,
  useCreateStory,
  useDeleteStory,
  useGetStories,
  useLikePost,
  useListPostComments,
  useRequestPostUpload,
  useRequestStoryUpload,
  useSearchMovies,
  useUnlikePost,
  getPostsFeed,
  getGetStoriesQueryKey,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROFESSIONAL_PROFILE_FLASH, type ProfessionalProfileFlash } from "@/lib/flash-messages";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  Clapperboard,
  ChevronDown,
  Clock3,
  Film,
  Globe2,
  Heart,
  Home,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Menu,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Paperclip,
  Play,
  Radio,
  Search,
  Send,
  Share2,
  Store,
  UserPlus,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

const PAGE_SIZE = 15;
const FEED_QUERY_KEY = getGetPostsFeedQueryKey({ limit: PAGE_SIZE });
const MAX_FILE_SIZE = 100 * 1024 * 1024;

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

function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-14 w-14 text-sm" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return src ? (
    <img src={src} alt="" className={`${sizeClass} shrink-0 rounded-full border border-border/80 object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/10 font-display font-bold tracking-wide text-primary`}>
      {initials(name)}
    </span>
  );
}

function VerifiedMark() {
  return <BadgeCheck aria-label="Verified film professional" className="h-4 w-4 shrink-0 fill-primary text-background" />;
}

function RelativeTime({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);
  const label = Number.isNaN(date.getTime()) ? "recently" : formatDistanceToNow(date, { addSuffix: true });
  return <time dateTime={createdAt} className="whitespace-nowrap text-xs text-muted-foreground">{label}</time>;
}

function MovieSearch({ onSelect, selected }: { onSelect: (movie: MovieSummary | null) => void; selected: MovieSummary | null }) {
  const [query, setQuery] = useState("");
  const params = useMemo(() => ({ q: query.trim(), page: 1 }), [query]);
  const search = useSearchMovies(params, {
    query: {
      enabled: query.trim().length >= 2,
      queryKey: getSearchMoviesQueryKey(params),
    },
  });
  const results = search.data?.results ?? [];

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/35 bg-primary/10 p-2.5">
        <img src={tmdbPosterUrl(selected.posterPath, "w92")} alt="" className="h-12 w-8 rounded object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{selected.title}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-primary">Movie tagged</p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground" aria-label="Remove tagged movie">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Tag a movie or series"
        aria-label="Search for a movie to tag"
        className="h-11 w-full rounded-lg border border-border bg-background/45 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
      />
      {query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-2xl">
          {search.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Searching the FILMIO catalogue</div>
          ) : search.isError ? (
            <p role="alert" className="px-4 py-4 text-xs text-destructive">{errorText(search.error, "Movie search is unavailable right now.")}</p>
          ) : results.length ? (
            results.slice(0, 5).map((movie) => (
              <button
                type="button"
                key={movie.id}
                onClick={() => { onSelect(movie); setQuery(""); }}
                className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-accent/30"
              >
                <img src={tmdbPosterUrl(movie.posterPath, "w92")} alt="" className="h-12 w-8 rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{movie.title}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">{movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "Film"} · {movie.voteAverage ? `${movie.voteAverage.toFixed(1)} rating` : "Catalogue title"}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          ) : (
            <p className="px-4 py-4 text-xs text-muted-foreground">No matching titles found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SocialTopBar() {
  const { user } = useUser();
  const [location] = useLocation();
  const displayName = user?.fullName || user?.firstName || "FILMIO member";
  const profileHref = user ? `/profile/${user.id}` : "/sign-in?redirect=%2Ffeed";
  const navItems = [
    { href: "/feed", label: "Home", icon: Home },
    { href: "/discover", label: "Discover", icon: LayoutGrid },
    { href: user ? "/friends" : "/sign-in?redirect=%2Ffriends", label: "Friends", icon: UsersRound, requiresSignIn: true },
    { href: "/news", label: "Film News", icon: Radio },
    { href: user ? "/chat" : "/sign-in?redirect=%2Fchat", label: "Messaging", icon: MessagesSquare },
  ];

  return (
    <header className="feed-topbar sticky top-0 z-50 border-b bg-card">
      <div className="mx-auto flex h-[68px] max-w-[1500px] items-center gap-3 px-3 sm:px-5">
        <Link href="/discover" className="flex shrink-0 items-center gap-2" aria-label="FILMIO home">
          <span className="feed-logo flex h-11 w-11 items-center justify-center rounded-full text-xl font-black text-white shadow-sm">F</span>
          <span className="hidden font-display text-lg font-bold tracking-[-0.04em] text-foreground sm:block">FILMIO</span>
        </Link>
        <label className="feed-search relative flex h-11 min-w-0 max-w-[280px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            aria-label="Search FILMIO"
            placeholder="Search FILMIO"
            className="h-full w-full rounded-full border-0 bg-muted pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <nav className="mx-auto hidden h-full items-center gap-1 md:flex" aria-label="Social navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || (href === "/professionals" && location.startsWith("/professionals"));
            return (
              <Link
                key={label}
                href={href}
                className={`feed-topnav-link ${isActive ? "feed-topnav-link-active" : ""}`}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                title={label}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="feed-icon-button md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          {user ? (
            <Link href={profileHref} className="feed-profile-chip" aria-label={`Open ${displayName}'s profile`}>
              <Avatar name={displayName} src={user.imageUrl} size="sm" />
            </Link>
          ) : (
            <Link href={profileHref} className="rounded-full px-3 text-sm font-semibold text-primary hover:underline">Sign in</Link>
          )}
          <button type="button" className="feed-icon-button hidden sm:flex" aria-label="Open account menu"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
    </header>
  );
}

function FeedSidebar() {
  const { user } = useUser();
  const displayName = user?.fullName || user?.firstName || "FILMIO member";
  const links = [
    ...(user ? [{ href: `/profile/${user.id}`, label: displayName, icon: "profile" as const }] : []),
    { href: user ? "/friends" : "/sign-in?redirect=%2Ffriends", label: "Friends", icon: UserPlus },
    { href: user ? "/chat" : "/sign-in?redirect=%2Fchat", label: "Messaging", icon: MessagesSquare },
    { href: "/professionals", label: "Industry Network", icon: UsersRound },
    { href: "/discover", label: "Discover films", icon: Film },
    { href: "/watchlist", label: "Watchlist", icon: Bookmark },
    { href: "/news", label: "Film news", icon: Radio },
    { href: "/professionals#auditions", label: "Auditions", icon: Clapperboard },
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/genres", label: "Browse genres", icon: Store },
  ];

  return (
    <aside className="feed-sidebar hidden lg:block" aria-label="Feed shortcuts">
      <div className="space-y-1">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="feed-sidebar-link">
            {item.icon === "profile" ? <Avatar name={displayName} src={user?.imageUrl} size="sm" /> : <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />}
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
      <div className="feed-sidebar-divider" />
      <div className="px-3">
        <p className="text-sm font-semibold text-muted-foreground">Your shortcuts</p>
          <Link href="/professionals/community" className="feed-sidebar-link mt-2 px-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Video className="h-4 w-4" /></span>
          <span>Film community</span>
        </Link>
      </div>
      <p className="px-3 pt-6 text-[11px] leading-5 text-muted-foreground">FILMIO · Your social cut for movies, makers, and moments.</p>
    </aside>
  );
}

function StoryComposer({ open, onOpenChange, onPublished }: { open: boolean; onOpenChange: (open: boolean) => void; onPublished: (story: Story) => void }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createStory = useCreateStory();
  const requestUpload = useRequestStoryUpload();

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setContent("");
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/") && !candidate.type.startsWith("video/")) {
      setError("Choose an image or video file.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Media must be smaller than 100 MB.");
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = content.trim();
    if (!trimmed && !file) {
      setError("Add a thought or attach media before publishing your story.");
      return;
    }
    if (trimmed.length > 280) {
      setError("Keep your story under 280 characters.");
      return;
    }

    try {
      let uploaded: { mediaUrl: string; contentType: string; name: string; size: number } | null = null;
      if (file) {
        const ticket = await requestUpload.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" },
        });
        const upload = await fetch(ticket.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!upload.ok) throw new Error("The story media upload could not be completed.");
        uploaded = { mediaUrl: ticket.mediaUrl, contentType: ticket.contentType, name: ticket.name, size: ticket.size };
      }

      const created = await createStory.mutateAsync({
        data: {
          ...(trimmed ? { content: trimmed } : {}),
          ...(uploaded ? {
            mediaUrl: uploaded.mediaUrl,
            mediaType: uploaded.contentType,
            mediaName: uploaded.name,
            mediaSize: uploaded.size,
          } : {}),
        },
      });
      onPublished(created);
      reset();
      onOpenChange(false);
      toast.success("Story is live for 24 hours.");
    } catch (submitError) {
      setError(errorText(submitError, "We could not publish your story. Please try again."));
    }
  };

  const publishing = createStory.isPending || requestUpload.isPending;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) reset(); onOpenChange(nextOpen); }}>
      <DialogContent className="border-primary/25 bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">Create a story</DialogTitle>
          <DialogDescription>Share a moment with the FILMIO community. It disappears after 24 hours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="story-content" className="sr-only">Write a story</label>
          <textarea
            id="story-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={280}
            rows={4}
            placeholder="A frame from today, a thought, a discovery..."
            autoFocus
            className="min-h-[112px] w-full resize-y rounded-xl border border-border/70 bg-background/35 px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary/55"
          />
          {preview && (
            <div className="relative overflow-hidden rounded-xl border border-border bg-background">
              {file?.type.startsWith("video/") ? <video src={preview} controls className="max-h-72 w-full object-contain" /> : <img src={preview} alt="Selected story media preview" className="max-h-72 w-full object-contain" />}
              <button type="button" onClick={() => setFile(null)} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur hover:text-primary" aria-label="Remove selected story media"><X className="h-4 w-4" /></button>
            </div>
          )}
          {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border/70 pt-3 sm:justify-between">
            <div className="flex items-center gap-2">
              <input ref={inputRef} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <button type="button" onClick={() => inputRef.current?.click()} disabled={publishing} className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/25 hover:text-primary disabled:opacity-50" aria-label="Attach an image or video"><ImagePlus className="h-4 w-4" /> Media</button>
              <span className={`text-[10px] tabular-nums ${content.length > 250 ? "text-primary" : "text-muted-foreground"}`}>{content.length}/280</span>
            </div>
            <Button type="submit" disabled={publishing} className="h-10 gap-2 rounded-md px-4 text-xs uppercase tracking-wider">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {publishing ? "Publishing" : "Publish story"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoryViewer({ story, onClose, onDeleted }: { story: Story | null; onClose: () => void; onDeleted: (storyId: number) => void }) {
  const deleteStory = useDeleteStory();
  if (!story) return null;
  const isVideo = story.mediaType?.startsWith("video/");
  const deleting = deleteStory.isPending;

  const handleDelete = async () => {
    try {
      await deleteStory.mutateAsync({ id: story.id });
      onDeleted(story.id);
      onClose();
      toast.success("Story deleted.");
    } catch (deleteError) {
      toast.error(errorText(deleteError, "We could not delete this story."));
    }
  };

  return (
    <Dialog open={!!story} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="overflow-hidden border-primary/25 bg-card p-0 sm:max-w-md">
        <div className="relative min-h-[420px] overflow-hidden bg-[linear-gradient(145deg,hsl(var(--navy)),hsl(var(--copper)))]">
          {story.mediaUrl && (isVideo ? <video src={story.mediaUrl} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" /> : <img src={story.mediaUrl} alt={`Story by ${story.author.displayName}`} className="absolute inset-0 h-full w-full object-contain" />)}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/45" />
          <div className="absolute inset-x-0 top-0 flex items-center gap-3 p-5">
            <Avatar name={story.author.displayName} src={story.author.avatarUrl} size="sm" />
            <div className="min-w-0 text-white">
              <p className="truncate text-sm font-semibold">{story.author.displayName}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">{formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })} · 24h story</p>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            {story.content && <p className="whitespace-pre-wrap text-lg leading-relaxed">{story.content}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/65">Expires {formatDistanceToNow(new Date(story.expiresAt), { addSuffix: true })}</span>
              {story.isOwner && <button type="button" onClick={() => void handleDelete()} disabled={deleting} className="flex h-9 items-center gap-2 rounded-md border border-white/20 bg-black/25 px-3 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-destructive/70 disabled:opacity-60"><X className="h-3.5 w-3.5" /> {deleting ? "Deleting" : "Delete"}</button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedStories({ signedIn }: { signedIn: boolean }) {
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const storiesQuery = useGetStories({
    query: {
      enabled: signedIn,
      queryKey: getGetStoriesQueryKey(),
      refetchInterval: signedIn ? 60_000 : false,
      staleTime: 30_000,
    },
  });
  const stories = storiesQuery.data ?? [];

  const handlePublished = (story: Story) => {
    queryClient.setQueryData<Story[]>(getGetStoriesQueryKey(), (current) => [story, ...(current ?? []).filter((item) => item.id !== story.id)]);
  };

  const handleDeleted = (storyId: number) => {
    setSelectedStory(null);
    queryClient.setQueryData<Story[]>(getGetStoriesQueryKey(), (current) => (current ?? []).filter((story) => story.id !== storyId));
  };

  return (
    <>
      <section aria-label="Stories" className="feed-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <div>
            <h2 className="text-base font-bold normal-case tracking-normal">Stories</h2>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live for 24 hours</p>
          </div>
          <Link href="/feed" className="text-xs font-semibold text-primary hover:underline">See all</Link>
        </div>
        <div className="feed-stories-scroll flex gap-3 overflow-x-auto px-4 pb-4 pt-3">
          {signedIn ? (
            <button type="button" onClick={() => setComposerOpen(true)} className="feed-story-card feed-story-create">
              <span className="feed-story-gradient flex h-full w-full items-center justify-center"><ImagePlus className="h-7 w-7 text-white" /></span>
              <span className="feed-story-label">Create story</span>
            </button>
          ) : (
            <Link href="/sign-in?redirect=%2Ffeed" className="feed-story-card feed-story-create">
              <span className="feed-story-gradient flex h-full w-full items-center justify-center"><ImagePlus className="h-7 w-7 text-white" /></span>
              <span className="feed-story-label">Sign in to share</span>
            </Link>
          )}
          {signedIn && storiesQuery.isLoading && [1, 2].map((item) => <div key={item} className="feed-story-card animate-pulse bg-muted" aria-label="Loading story" />)}
          {signedIn && stories.map((story, index) => {
            const isVideo = story.mediaType?.startsWith("video/");
            return (
              <button type="button" key={story.id} onClick={() => setSelectedStory(story)} className={`feed-story-card ${story.isOwner ? "border-primary/70" : ""}`} aria-label={`Open story by ${story.author.displayName}`}>
                {story.mediaUrl ? (isVideo ? <video src={story.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={story.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />) : <span className={`feed-story-gradient h-full w-full ${["feed-story-gradient-one", "feed-story-gradient-two", "feed-story-gradient-three"][index % 3]}`} />}
                <span className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent" />
                <span className="absolute left-2 top-2"><Avatar name={story.author.displayName} src={story.author.avatarUrl} size="sm" /></span>
                <span className="feed-story-label">{story.content || story.author.displayName}</span>
              </button>
            );
          })}
          {signedIn && !storiesQuery.isLoading && !storiesQuery.isError && !stories.length && <div className="flex min-h-[178px] min-w-[220px] items-center rounded-lg border border-dashed border-primary/25 px-4 text-xs leading-5 text-muted-foreground">No live stories yet. Share the first frame from your day.</div>}
        </div>
        {signedIn && storiesQuery.isError && <p role="alert" className="px-4 pb-4 text-xs text-destructive">{errorText(storiesQuery.error, "Stories are unavailable right now.")}</p>}
        {!signedIn && <p className="px-4 pb-4 text-xs text-muted-foreground">Sign in to see stories from the FILMIO community.</p>}
      </section>
      <StoryComposer open={composerOpen} onOpenChange={setComposerOpen} onPublished={handlePublished} />
      <StoryViewer story={selectedStory} onClose={() => setSelectedStory(null)} onDeleted={handleDeleted} />
    </>
  );
}

function FeedRightRail() {
  return (
    <aside className="feed-right-rail hidden lg:block" aria-label="Feed sidebar">
      <section className="feed-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold normal-case tracking-normal">Group chats</h2>
          <button type="button" className="feed-round-action" aria-label="More group chat options"><MoreHorizontal className="h-5 w-5" /></button>
        </div>
        <button type="button" onClick={() => toast.info("Group chats are coming soon")} className="mt-4 flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"><UserPlus className="h-4 w-4" /></span>
          <span>
            <span className="block text-sm font-semibold">Create group chat</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Talk about your next watch</span>
          </span>
        </button>
      </section>
      <section className="feed-card mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold normal-case tracking-normal">Film community</h2>
          <Link href="/professionals" className="text-xs font-semibold text-primary hover:underline">See all</Link>
        </div>
        <div className="mt-4 space-y-3">
          {[
            ["Film professionals", "Find your next collaborator", UsersRound],
            ["Latest screenings", "Discover what is playing", Clock3],
          ].map(([title, description, Icon]) => (
            <Link key={title as string} href="/professionals" className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{title as string}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description as string}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Composer({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"standard" | "announcement">("standard");
  const [movie, setMovie] = useState<MovieSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showMobileMovieSearch, setShowMobileMovieSearch] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createPost = useCreatePost();
  const requestUpload = useRequestPostUpload();

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = (candidate?: File) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/") && !candidate.type.startsWith("video/")) {
      setError("Choose an image or video file.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("Media must be smaller than 100 MB.");
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = content.trim();
    if (!trimmed && !file) { setError("Add a thought or attach a piece of media before publishing."); return; }
    if (trimmed.length > 500) { setError("Keep your post under 500 characters."); return; }

    try {
      let uploaded: { imageUrl: string; contentType: string; name: string; size: number } | null = null;
      if (file) {
        const ticket = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" } });
        const upload = await fetch(ticket.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!upload.ok) throw new Error("The media upload could not be completed.");
        uploaded = { imageUrl: ticket.imageUrl, contentType: ticket.contentType, name: ticket.name, size: ticket.size };
      }
      const created = await createPost.mutateAsync({
        data: {
          content: trimmed,
          postType,
          ...(movie ? { linkedMovieId: movie.id, linkedMovieTitle: movie.title, linkedMoviePosterPath: movie.posterPath ?? null } : {}),
          ...(uploaded ? { imageUrl: uploaded.imageUrl, imageType: uploaded.contentType, imageName: uploaded.name, imageSize: uploaded.size } : {}),
        },
      });
      setContent("");
      setMovie(null);
      setFile(null);
      setPostType("standard");
      setShowMobileMovieSearch(false);
      setExpanded(false);
      if (inputRef.current) inputRef.current.value = "";
      onCreated(created);
    } catch (submitError) {
      setError(errorText(submitError, "We could not publish your post. Please try again."));
    }
  };

  const publishing = createPost.isPending || requestUpload.isPending;
  const authorName = user?.fullName || user?.firstName || "Your name";
  const authorAvatar = user?.imageUrl ?? null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        id="feed-composer"
        className="group flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-border/80 bg-card/80 p-3.5 text-left shadow-[0_20px_70px_-42px_hsl(var(--primary)/0.55)] transition-all hover:border-primary/45 hover:bg-card sm:p-4"
        aria-label="Open post composer"
      >
        <Avatar name={authorName} src={authorAvatar} size="md" />
        <span className="min-w-0 flex-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground sm:text-[0.95rem]">
          What's on your mind, {user?.firstName || "film friend"}?
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>
    );
  }

  return (
    <form id="feed-composer" onSubmit={submit} className="relative overflow-visible rounded-2xl border border-primary/30 bg-card/90 p-4 shadow-[0_20px_70px_-42px_hsl(var(--primary)/0.55)] sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={authorName} src={authorAvatar} size="md" />
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-primary">Create a post</p>
          <p className="text-xs text-muted-foreground">Share what is moving you through cinema.</p>
        </div>
        <button type="button" onClick={() => setExpanded(false)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground" aria-label="Close post composer"><X className="h-4 w-4" /></button>
      </div>
      <label htmlFor="post-content" className="sr-only">Write a post</label>
      <textarea
        id="post-content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={500}
        rows={4}
        placeholder="A thought, a discovery, a note from set..."
        autoFocus
        className="min-h-[112px] w-full resize-y rounded-xl border border-border/70 bg-background/35 px-3.5 py-3 text-[1.04rem] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-primary/55"
      />
      {preview && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border bg-background">
          {file?.type.startsWith("video/") ? <video src={preview} controls className="max-h-72 w-full object-contain" /> : <img src={preview} alt="Selected upload preview" className="max-h-72 w-full object-contain" />}
          <button type="button" onClick={() => setFile(null)} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur hover:text-primary" aria-label="Remove selected media"><X className="h-4 w-4" /></button>
        </div>
      )}
      {movie && <div className="mt-3"><MovieSearch selected={movie} onSelect={setMovie} /></div>}
      {showMobileMovieSearch && !movie && <div className="mt-3 sm:hidden"><MovieSearch selected={null} onSelect={(selectedMovie) => { setMovie(selectedMovie); setShowMobileMovieSearch(false); }} /></div>}
      {error && <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <input ref={inputRef} type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/25 hover:text-primary" aria-label="Attach an image or video"><ImagePlus className="h-4 w-4" /> <span className="hidden sm:inline">Media</span></button>
          <button type="button" onClick={() => { if (movie) setMovie(null); else setShowMobileMovieSearch((open) => !open); }} className="flex h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/25 hover:text-primary" aria-label={movie ? "Remove tagged movie" : "Tag a movie"}>
            <Clapperboard className="h-4 w-4" /><span className="hidden sm:inline">{movie ? "Change film" : "Tag film"}</span>
          </button>
          {!movie && <div className="hidden min-w-[190px] sm:block"><MovieSearch selected={null} onSelect={setMovie} /></div>}
          <select value={postType} onChange={(event) => setPostType(event.target.value as "standard" | "announcement")} className="h-11 rounded-lg border-0 bg-transparent px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground outline-none hover:text-primary" aria-label="Post type">
            <option value="standard">Thought</option>
            <option value="announcement">Announcement</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className={`text-[10px] tabular-nums ${content.length > 450 ? "text-primary" : "text-muted-foreground"}`}>{content.length}/500</span>
          <Button type="submit" disabled={publishing} className="h-10 gap-2 rounded-md px-4 text-xs uppercase tracking-wider">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {publishing ? "Publishing" : "Publish"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Comments({ postId, onCountChange }: { postId: number; onCountChange: (count: number) => void }) {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const comments = useListPostComments(postId, { query: { queryKey: getListPostCommentsQueryKey(postId), enabled: true } });
  const createComment = useCreatePostComment();
  const [error, setError] = useState<string | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  useEffect(() => {
    if (comments.data) onCountChangeRef.current(comments.data.length);
  }, [comments.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = content.trim();
    if (!text) return;
    setError(null);
    try {
      await createComment.mutateAsync({ id: postId, data: { content: text } });
      setContent("");
      await comments.refetch();
    } catch (submitError) {
      setError(errorText(submitError, "Your comment could not be added."));
    }
  };

  return (
    <div className="mt-4 border-t border-border/70 pt-4">
      {comments.isLoading ? <div className="space-y-3" aria-label="Loading comments"><div className="h-10 animate-pulse rounded bg-muted/60" /><div className="h-10 w-4/5 animate-pulse rounded bg-muted/60" /></div> : comments.isError ? <p role="alert" className="text-xs text-destructive">{errorText(comments.error, "Comments could not be loaded.")}</p> : comments.data?.length ? <div className="space-y-4">{comments.data.map((comment) => <CommentRow key={comment.id} comment={comment} />)}</div> : <p className="text-xs text-muted-foreground">Be the first to add a note to this scene.</p>}
      <form onSubmit={submit} className="sticky bottom-2 z-10 mt-4 flex items-center gap-2 rounded-xl border border-border/80 bg-card/95 p-2 backdrop-blur">
        <Avatar name={user?.fullName || user?.firstName || "You"} src={user?.imageUrl} size="sm" />
        <label htmlFor={`comment-${postId}`} className="sr-only">Add a comment</label>
        <input id={`comment-${postId}`} value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} placeholder="Write a comment..." className="h-10 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/50 px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60" />
        <button type="submit" disabled={!content.trim() || createComment.isPending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Post comment">{createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CommentRow({ comment }: { comment: PostComment }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={comment.author.displayName} src={comment.author.avatarUrl} size="sm" />
      <div className="min-w-0 max-w-[calc(100%-2.75rem)] rounded-2xl bg-muted/65 px-3.5 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xs font-bold">{comment.author.displayName}</span>
          {comment.author.verified && <VerifiedMark />}
          <RelativeTime createdAt={comment.createdAt} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-foreground/85">{comment.content}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-muted/75" />
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted/80" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/65" />
      </div>
      <div className="mt-5 h-28 animate-pulse rounded-xl bg-muted/55" />
      <div className="mt-5 flex gap-3 border-t border-border/60 pt-4">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-8 w-16 animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}

function PostCard({ post, onLike, onCommentCount }: { post: Post; onLike: (post: Post) => void; onCommentCount: (postId: number, count: number) => void }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const isVideo = post.imageType?.startsWith("video/") || post.imageType === "video";

  const handleLike = () => {
    setLikePulse(true);
    window.setTimeout(() => setLikePulse(false), 360);
    onLike(post);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/feed#post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Post by ${post.author.displayName}`, text: post.content || "A post from the FILMIO community.", url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Post link copied", { description: "Share it with someone who loves film." });
      } else {
        toast.info("Share this post from your browser", { description: shareUrl });
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      toast.error("Could not share this post");
    }
  };

  return (
    <article id={`post-${post.id}`} className={`feed-post-card overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md ${post.postType === "announcement" ? "border-primary/45" : "border-border/80"}`}>
      {post.postType === "announcement" && <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary"><Bell className="h-3.5 w-3.5" /> Announcement</div>}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${post.author.id}`} className="shrink-0 rounded-full" aria-label={`Open ${post.author.displayName}'s profile`}><Avatar name={post.author.displayName} src={post.author.avatarUrl} /></Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`/profile/${post.author.id}`} className="text-sm font-bold tracking-tight hover:text-primary">{post.author.displayName}</Link>
              {post.author.verified && <VerifiedMark />}
              {post.author.authorType === "actor" && <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary">Actor</span>}
            </div>
            <div className="mt-1 flex items-center gap-2"><RelativeTime createdAt={post.createdAt} /><span className="text-border">/</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{post.author.authorType === "actor" ? "On set" : "Film fan"}</span></div>
          </div>
        </div>
        {post.linkedMovieId && post.linkedMovieTitle && <Link href={`/movies/${post.linkedMovieId}`} className="mt-4 inline-flex max-w-full items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/8 p-2 pr-3 transition-colors hover:border-primary/55 hover:bg-primary/12">
          <img src={tmdbPosterUrl(post.linkedMoviePosterPath, "w92")} alt="" className="h-10 w-7 shrink-0 rounded object-cover" loading="lazy" />
          <span className="min-w-0">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-primary">Reviewing / watching</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">{post.linkedMovieTitle}</span>
          </span>
          <ArrowUpRight className="ml-1 h-3.5 w-3.5 shrink-0 text-primary/70" />
        </Link>}
        {post.content && <p className="mt-4 whitespace-pre-wrap text-[0.98rem] leading-[1.65] text-foreground/90">{post.content}</p>}
        {post.imageUrl && <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-background/60">{isVideo ? <video src={post.imageUrl} controls preload="metadata" className="max-h-[34rem] w-full object-contain" /> : <img src={post.imageUrl} alt="Media shared in this post" loading="lazy" className="max-h-[34rem] w-full object-contain" />}</div>}
        <div className="mt-4 flex items-center gap-1 border-t border-border/70 pt-3">
          <button type="button" onClick={handleLike} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors hover:bg-accent/20 ${post.viewerLiked ? "text-primary" : "text-muted-foreground hover:text-primary"}`} aria-pressed={post.viewerLiked} aria-label={post.viewerLiked ? `Unlike post, ${post.likesCount} likes` : `Like post, ${post.likesCount} likes`}>
            <Heart className={`h-4 w-4 ${post.viewerLiked ? "fill-current" : ""} ${likePulse ? "like-pop" : ""}`} />
            <span>{post.likesCount}</span><span className="hidden sm:inline">Like</span>
          </button>
          <button type="button" onClick={() => setCommentsOpen((open) => !open)} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors hover:bg-accent/20 ${commentsOpen ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-expanded={commentsOpen} aria-controls={`comments-${post.id}`}>
            <MessageCircle className="h-4 w-4" /><span>{post.commentsCount}</span><span className="hidden sm:inline">Comment</span>
          </button>
          <button type="button" onClick={() => void handleShare()} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground" aria-label="Share post">
            <Share2 className="h-4 w-4" /><span className="hidden sm:inline">Share</span>
          </button>
          <span className="ml-auto hidden text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:block">{post.postType === "announcement" ? "Broadcast" : "Community post"}</span>
        </div>
        {commentsOpen && <div id={`comments-${post.id}`}><Comments postId={post.id} onCountChange={(count) => onCommentCount(post.id, count)} /></div>}
      </div>
    </article>
  );
}

function FeedIntro() {
  return (
    <div className="relative overflow-hidden border-b border-border/70 pb-8 pt-28 sm:pt-32">
      <div className="pointer-events-none absolute -right-8 top-20 h-56 w-56 rounded-full border border-primary/10 sm:right-10"><div className="absolute inset-8 rounded-full border border-primary/10" /></div>
      <div className="relative">
        <p className="editorial-kicker">The social cut · 01</p>
        <h1 className="mt-4 max-w-2xl font-display text-[clamp(2.8rem,8vw,6.4rem)] font-medium uppercase leading-[0.88] tracking-[-0.06em]">Where film<br /><span className="text-primary">keeps moving.</span></h1>
        <div className="mt-6 flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-start sm:gap-10">
          <p className="max-w-md text-sm leading-7 text-muted-foreground">Short thoughts, work-in-progress frames, and discoveries from the people who make movie culture worth talking about.</p>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"><span className="h-px w-8 bg-primary" /> Live from the community</div>
        </div>
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="feed-facebook film-grain min-h-[100dvh] bg-background pb-10">
      <SocialTopBar />
      <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-3 pt-6 sm:px-5 lg:grid-cols-[220px_minmax(0,1fr)_250px]">
        <FeedSidebar />
        <section className="min-w-0">
          <Link href="/sign-in?redirect=%2Ffeed" className="feed-card flex min-h-[72px] items-center gap-3 p-3.5 text-left transition-shadow hover:shadow-md sm:p-4">
            <Avatar name="Film friend" size="md" />
            <span className="min-w-0 flex-1 text-sm text-muted-foreground sm:text-[0.95rem]">What's on your mind, film friend?</span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary"><ImagePlus className="h-4 w-4" /></span>
          </Link>
          <div className="mt-4"><FeedStories signedIn={false} /></div>
          <div className="feed-card mt-4 p-7 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"><Clapperboard className="h-7 w-7" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">Your seat is waiting</p>
            <h1 className="mt-3 text-2xl font-bold normal-case tracking-normal sm:text-3xl">Join the conversation</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Sign in to read the latest from film fans, verified actors, and the people behind the scenes.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/sign-in?redirect=%2Ffeed">Sign in to enter</Link></Button><Button variant="outline" asChild><Link href="/sign-up?redirect=%2Ffeed">Create an account</Link></Button></div>
          </div>
        </section>
        <FeedRightRail />
      </main>
    </div>
  );
}

export default function Feed() {
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const profileFlash = sessionStorage.getItem(PROFESSIONAL_PROFILE_FLASH);
    if (profileFlash !== "created" && profileFlash !== "updated") return;
    sessionStorage.removeItem(PROFESSIONAL_PROFILE_FLASH);

    const messages: Record<ProfessionalProfileFlash, { title: string; description: string }> = {
      created: {
        title: "Aapki professional profile ban gayi hai!",
        description: "Ab aap apni pehli announcement ya update post kar sakte hain.",
      },
      updated: {
        title: "Aapki profile update ho gayi hai!",
        description: "Apne followers ke saath naya update share karein.",
      },
    };
    const message = messages[profileFlash];
    toast.success(message.title, { description: message.description });
  }, [isLoaded, isSignedIn]);

  const feed = useInfiniteQuery<PostFeedResponse, Error, InfiniteData<PostFeedResponse>, typeof FEED_QUERY_KEY, string | null>({
    queryKey: FEED_QUERY_KEY,
    initialPageParam: null,
    enabled: isLoaded && !!isSignedIn,
    queryFn: ({ pageParam }) => getPostsFeed(pageParam ? { cursor: pageParam, limit: PAGE_SIZE } : { limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !feed.hasNextPage || feed.isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void feed.fetchNextPage();
    }, { rootMargin: "500px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage]);

  const patchPost = (id: number, patch: Partial<Post>) => {
    queryClient.setQueryData<InfiniteData<PostFeedResponse>>(FEED_QUERY_KEY, (current) => {
      if (!current) return current;
      return { ...current, pages: current.pages.map((page) => ({ ...page, items: page.items.map((item) => item.id === id ? { ...item, ...patch } : item) })) };
    });
  };

  const handleLike = async (post: Post) => {
    setActionError(null);
    patchPost(post.id, { viewerLiked: !post.viewerLiked, likesCount: Math.max(0, post.likesCount + (post.viewerLiked ? -1 : 1)) });
    try {
      const result = post.viewerLiked ? await unlikePost.mutateAsync({ id: post.id }) : await likePost.mutateAsync({ id: post.id });
      patchPost(post.id, { viewerLiked: result.liked, likesCount: result.likesCount });
    } catch (likeError) {
      patchPost(post.id, { viewerLiked: post.viewerLiked, likesCount: post.likesCount });
      setActionError(errorText(likeError, "That reaction could not be saved."));
    }
  };

  const handleCreated = (post: Post) => {
    queryClient.setQueryData<InfiniteData<PostFeedResponse>>(FEED_QUERY_KEY, (current) => {
      if (!current) return { pages: [{ items: [post], nextCursor: null, hasMore: false }], pageParams: [null] };
      const first = current.pages[0];
      return { ...current, pages: [{ ...first, items: [post, ...first.items] }, ...current.pages.slice(1)] };
    });
  };

  const updateCommentCount = (postId: number, count: number) => patchPost(postId, { commentsCount: count });

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <main className="container mx-auto max-w-6xl px-4 pt-28">
          <div className="h-3 w-28 animate-pulse rounded bg-muted/80" />
          <div className="mt-4 h-12 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-10 max-w-[680px] space-y-5">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }
  if (!isSignedIn) return <SignedOut />;

  return (
    <div className="feed-facebook film-grain min-h-[100dvh] bg-background pb-10">
      <SocialTopBar />
      <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-3 pt-6 sm:px-5 lg:grid-cols-[220px_minmax(0,1fr)_250px]">
        <FeedSidebar />
        <section aria-label="Community feed" className="min-w-0">
          <div className="space-y-4">
            <Composer onCreated={handleCreated} />
            <FeedStories signedIn />
          </div>
          {actionError && <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"><AlertCircle className="h-4 w-4" />{actionError}<button type="button" onClick={() => setActionError(null)} className="ml-auto p-1" aria-label="Dismiss error"><X className="h-3.5 w-3.5" /></button></div>}
          <div className="mb-4 mt-6 flex items-center justify-between gap-4">
            <h2 className="text-base font-bold normal-case tracking-normal">Your feed</h2>
            <button type="button" onClick={() => void feed.refetch()} className="flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"><Clock3 className="h-4 w-4" /> Most recent</button>
          </div>
            {feed.isLoading ? (
              <div className="space-y-5" aria-label="Loading feed">
                {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
              </div>
            ) : feed.isError ? (
              <div role="alert" className="rounded-2xl border border-destructive/35 bg-destructive/10 p-7">
                <div className="flex items-start gap-3 text-destructive">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h2 className="font-display text-lg font-semibold uppercase tracking-wide">The reel is offline</h2>
                    <p className="mt-2 text-sm text-destructive/85">{errorText(feed.error, "We could not load the community feed.")}</p>
                    <Button type="button" variant="outline" onClick={() => void feed.refetch()} className="mt-5 border-destructive/40 text-destructive hover:bg-destructive/10">Try again</Button>
                  </div>
                </div>
              </div>
            ) : posts.length ? (
              <div className="space-y-5">
                {posts.map((post) => <PostCard key={post.id} post={post} onLike={handleLike} onCommentCount={updateCommentCount} />)}
                <div ref={loadMoreRef} className="flex min-h-20 items-center justify-center">
                  {feed.isFetchingNextPage && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading more from the reel</div>}
                  {!feed.hasNextPage && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">You are caught up</span>}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-primary/30 bg-card/50 p-8 text-center sm:p-10">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                  <Film className="h-8 w-8" />
                </div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The reel is quiet</p>
                <h2 className="mt-2 font-display text-2xl font-medium uppercase">First frame, yours</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">There are no posts here yet. Share a thought, tag a film, and set the scene for everyone.</p>
                <Button asChild className="mt-6 h-11 rounded-lg px-5 text-xs uppercase tracking-wider"><a href="#feed-composer">Start a post</a></Button>
              </div>
            )}
        </section>
        <FeedRightRail />
      </main>
    </div>
  );
}