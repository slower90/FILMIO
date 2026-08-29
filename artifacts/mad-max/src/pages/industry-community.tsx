import { useGetMyProfessionalProfile, getGetMyProfessionalProfileQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { apiFetch } from "@/lib/api-url";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Clapperboard,
  FileImage,
  Film,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";

type CommunityAuthor = {
  id: string | number;
  displayName?: string | null;
  headshotUrl?: string | null;
  roles?: string[] | null;
  verified?: boolean | null;
};

type CommunityComment = {
  id: string | number;
  content: string;
  createdAt?: string | null;
  author?: CommunityAuthor | null;
};

type CommunityPost = {
  id: string | number;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewerLiked?: boolean;
  author: CommunityAuthor;
  comments?: CommunityComment[];
};

type FeedResponse = {
  posts: CommunityPost[];
  page: number;
  limit: number;
  hasMore: boolean;
};

type UploadTicket = {
  uploadURL: string;
  objectPath: string;
};

type ProfileLike = {
  id?: string | number;
  displayName?: string | null;
  headshotUrl?: string | null;
  roles?: string[] | null;
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ACCEPTED_MEDIA = "image/*,video/*";

function getInitials(name?: string | null) {
  const safeName = name?.trim() || "FILMIO";
  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return body?.error || body?.message || fallback;
}

function Avatar({
  author,
  size = "md",
  testId,
}: {
  author?: CommunityAuthor | ProfileLike | null;
  size?: "sm" | "md" | "lg";
  testId: string;
}) {
  const classes = size === "lg" ? "h-16 w-16 text-base" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-11 w-11 text-xs";
  return author?.headshotUrl ? (
    <img
      src={author.headshotUrl}
      alt={author.displayName || "Professional headshot"}
      className={`${classes} shrink-0 rounded-sm border border-border/80 object-cover`}
      data-testid={testId}
    />
  ) : (
    <div
      className={`${classes} flex shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 font-display font-bold tracking-wider text-primary`}
      aria-label={author?.displayName || "FILMIO professional"}
      data-testid={testId}
    >
      {getInitials(author?.displayName)}
    </div>
  );
}

function MediaPreview({ post }: { post: CommunityPost }) {
  if (!post.mediaUrl) return null;
  const type = post.mediaType?.toLowerCase() || "";
  if (type.startsWith("video")) {
    return (
      <div className="relative overflow-hidden border-y border-border bg-black" data-testid={`media-preview-${post.id}`}>
        <video className="max-h-[38rem] w-full object-contain" controls preload="metadata" src={post.mediaUrl}>
          Your browser does not support video playback.
        </video>
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-sm border border-white/15 bg-black/60 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
          <Play className="h-3 w-3 fill-current text-primary" /> Screening clip
        </div>
      </div>
    );
  }
  if (type.startsWith("audio")) {
    return (
      <div className="border-y border-border bg-[hsl(var(--surface-deep))] p-5" data-testid={`media-preview-${post.id}`}>
        <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Film className="h-4 w-4 text-primary" /> Sound file
        </div>
        <audio className="w-full" controls preload="metadata" src={post.mediaUrl}>
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }
  if (type.includes("pdf")) {
    return (
      <a
        href={post.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 border-y border-border bg-[hsl(var(--surface-deep))] p-5 transition-colors hover:bg-muted/60"
        data-testid={`link-media-pdf-${post.id}`}
      >
        <FileImage className="h-8 w-8 text-primary" />
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-primary">Open document</span>
          <span className="mt-1 block text-sm text-muted-foreground">View the shared PDF in a new tab</span>
        </span>
      </a>
    );
  }
  return (
    <img
      src={post.mediaUrl}
      alt={post.caption || "Shared work"}
      className="max-h-[38rem] w-full object-contain"
      data-testid={`media-preview-${post.id}`}
    />
  );
}

function SkeletonPost({ index }: { index: number }) {
  return (
    <div className="overflow-hidden border border-border bg-card/70" data-testid={`skeleton-post-${index}`}>
      <div className="flex items-center gap-3 p-5">
        <div className="h-11 w-11 animate-pulse rounded-sm bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse bg-muted" />
          <div className="h-2 w-20 animate-pulse bg-muted" />
        </div>
      </div>
      <div className="h-36 animate-pulse bg-muted/60" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-full animate-pulse bg-muted" />
        <div className="h-3 w-4/5 animate-pulse bg-muted" />
      </div>
    </div>
  );
}

function CommentItem({ comment, postId }: { comment: CommunityComment; postId: string | number }) {
  const author = comment.author || { displayName: "FILMIO member" };
  return (
    <div className="flex gap-3" data-testid={`comment-${postId}-${comment.id}`}>
      <Avatar author={author} size="sm" testId={`img-comment-avatar-${postId}-${comment.id}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-bold text-foreground" data-testid={`text-comment-author-${postId}-${comment.id}`}>
            {author.displayName || "FILMIO member"}
          </span>
          {comment.createdAt && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatDate(comment.createdAt)}</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-foreground/75" data-testid={`text-comment-content-${postId}-${comment.id}`}>
          {comment.content}
        </p>
      </div>
    </div>
  );
}

function PostCard({
  post,
  isOwnPost,
  onLike,
  onDelete,
  onLoadComments,
  onAddComment,
  commentState,
}: {
  post: CommunityPost;
  isOwnPost: boolean;
  onLike: (post: CommunityPost) => void;
  onDelete: (post: CommunityPost) => void;
  onLoadComments: (post: CommunityPost) => void;
  onAddComment: (post: CommunityPost, content: string) => Promise<void>;
  commentState: { open: boolean; loading: boolean; error: string | null; comments: CommunityComment[] };
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const author = post.author;
  const roles = author.roles?.filter(Boolean).slice(0, 3) || [];

  const submitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentDraft.trim();
    if (!content || submittingComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(post, content);
      setCommentDraft("");
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <article className="group overflow-hidden border border-border bg-card shadow-[0_18px_50px_-35px_hsl(var(--ink))]" data-testid={`card-community-post-${post.id}`}>
      <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/professionals/${author.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-sm"
            data-testid={`link-post-author-${post.id}`}
          >
            <Avatar author={author} testId={`img-post-author-${post.id}`} />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/professionals/${author.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-display text-sm font-bold uppercase tracking-wide transition-colors hover:text-primary"
                data-testid={`link-post-author-name-${post.id}`}
              >
                {author.displayName || "FILMIO professional"}
              </Link>
              {author.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified professional" data-testid={`icon-verified-author-${post.id}`} />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {roles.length > 0 && <span data-testid={`text-post-author-roles-${post.id}`}>{roles.join(" / ")}</span>}
              <span className="text-primary/70">•</span>
              <time dateTime={post.createdAt} data-testid={`text-post-date-${post.id}`}>{formatDate(post.createdAt)}</time>
            </div>
          </div>
        </div>
        {isOwnPost && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(post)}
            aria-label="Delete your post"
            data-testid={`button-delete-post-${post.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {!isOwnPost && <MoreHorizontal className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />}
      </div>

      {post.caption && (
        <p className="whitespace-pre-wrap px-5 pb-5 text-[0.95rem] leading-7 text-foreground/85 sm:px-6" data-testid={`text-post-caption-${post.id}`}>
          {post.caption}
        </p>
      )}
      <MediaPreview post={post} />

      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`gap-2 px-2 ${post.viewerLiked ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => onLike(post)}
            aria-label={post.viewerLiked ? "Unlike post" : "Like post"}
            data-testid={`button-like-post-${post.id}`}
          >
            <Heart className={`h-4 w-4 ${post.viewerLiked ? "fill-current" : ""}`} />
            <span data-testid={`text-like-count-${post.id}`}>{post.likeCount}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`gap-2 px-2 ${commentState.open ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => onLoadComments(post)}
            aria-expanded={commentState.open}
            data-testid={`button-comments-post-${post.id}`}
          >
            <MessageCircle className="h-4 w-4" />
            <span data-testid={`text-comment-count-${post.id}`}>{post.commentCount}</span>
          </Button>
        </div>
        <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 sm:block">Industry room / {String(post.id).padStart(4, "0")}</span>
      </div>

      {commentState.open && (
        <div className="border-t border-border bg-[hsl(var(--surface-deep))] px-5 py-5 sm:px-6" data-testid={`comments-panel-${post.id}`}>
          <div className="mb-4 flex items-center justify-between">
            <p className="cinema-kicker">Notes from the room</p>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
              onClick={() => onLoadComments(post)}
              aria-label="Close comments"
              data-testid={`button-close-comments-${post.id}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {commentState.loading ? (
            <div className="space-y-4" data-testid={`comments-loading-${post.id}`}>
              {[1, 2].map((item) => <div key={item} className="h-10 animate-pulse bg-muted/60" />)}
            </div>
          ) : commentState.error ? (
            <div className="flex items-center gap-2 text-sm text-destructive" role="alert" data-testid={`comments-error-${post.id}`}>
              <CircleAlert className="h-4 w-4 shrink-0" /> {commentState.error}
            </div>
          ) : (
            <div className="space-y-4">
              {commentState.comments.length > 0 ? commentState.comments.map((comment) => <CommentItem key={comment.id} comment={comment} postId={post.id} />) : (
                <p className="text-sm text-muted-foreground" data-testid={`comments-empty-${post.id}`}>No notes yet. Start the conversation.</p>
              )}
            </div>
          )}
          <form onSubmit={submitComment} className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              maxLength={1000}
              placeholder="Add a considered note..."
              className="h-10 min-w-0 flex-1 rounded-sm border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              aria-label="Comment on this post"
              data-testid={`input-comment-${post.id}`}
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!commentDraft.trim() || submittingComment} aria-label="Post comment" data-testid={`button-submit-comment-${post.id}`}>
              {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </article>
  );
}

export default function IndustryCommunity() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { data: myProfile, isLoading: profileLoading } = useGetMyProfessionalProfile({
    query: {
      queryKey: getGetMyProfessionalProfileQueryKey(),
      enabled: isLoaded && !!isSignedIn,
      retry: false,
    },
  });
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [likingId, setLikingId] = useState<string | number | null>(null);
  const [commentPanels, setCommentPanels] = useState<Record<string, { open: boolean; loading: boolean; error: string | null; comments: CommunityComment[] }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fallbackAuthor = useMemo<ProfileLike>(() => ({
    displayName: user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Your name",
    headshotUrl: user?.imageUrl,
  }), [user]);

  const loadFeed = async (silent = false) => {
    if (!silent) setLoadingFeed(true);
    setFeedError(null);
    try {
      const response = await apiFetch("/api/professionals/community/feed?page=1&limit=20", { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "The industry room is unavailable right now."));
      const result = await response.json() as FeedResponse;
      setPosts(Array.isArray(result.posts) ? result.posts : []);
      setHasMore(Boolean(result.hasMore));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "The industry room is unavailable right now.");
    } finally {
      setLoadingFeed(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    void loadFeed();
  }, [isLoaded]);

  const ownProfileId = myProfile?.id;
  const isOwnPost = (post: CommunityPost) => ownProfileId != null && String(post.author.id) === String(ownProfileId);

  const chooseFile = (file?: File) => {
    setComposerError(null);
    setComposerNotice(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setComposerError("That file is larger than 500 MB. Choose a smaller piece of work.");
      return;
    }
    setSelectedFile(file);
  };

  const uploadFileWithProgress = (url: string, file: File) => new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The file upload could not be completed."));
    request.onerror = () => reject(new Error("The file upload could not be completed."));
    request.send(file);
  });

  const submitPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setComposerError(null);
    setComposerNotice(null);
    if (!myProfile) {
      setComposerError("Create your professional profile before sharing work.");
      return;
    }
    if (!caption.trim() && !selectedFile) {
      setComposerError("Add a caption or choose a piece of work to share.");
      return;
    }
    if (caption.trim().length > 2000) {
      setComposerError("Keep your caption under 2,000 characters.");
      return;
    }
    setUploading(Boolean(selectedFile));
    setUploadProgress(selectedFile ? 1 : 0);
    let uploadedObjectPath: string | undefined;
    try {
      let objectPath: string | undefined;
      if (selectedFile) {
        const ticketResponse = await apiFetch("/api/professionals/community/posts/request-upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: selectedFile.name, size: selectedFile.size, contentType: selectedFile.type || "application/octet-stream" }),
        });
        if (!ticketResponse.ok) throw new Error(await readError(ticketResponse, "We could not prepare that upload."));
        const ticket = await ticketResponse.json() as UploadTicket;
        await uploadFileWithProgress(ticket.uploadURL, selectedFile);
        objectPath = ticket.objectPath;
        uploadedObjectPath = objectPath;
      }
        const saveResponse = await apiFetch("/api/professionals/community/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: caption.trim(),
          ...(objectPath ? { objectPath, fileName: selectedFile?.name, contentType: selectedFile?.type, fileSize: selectedFile?.size } : {}),
        }),
      });
      if (!saveResponse.ok) throw new Error(await readError(saveResponse, "We could not publish this post."));
      setCaption("");
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setComposerNotice("Your work is now in the room.");
      setRefreshing(true);
      await loadFeed(true);
    } catch (error) {
      if (uploadedObjectPath) {
        await apiFetch("/api/professionals/community/uploads", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath: uploadedObjectPath }),
        }).catch(() => undefined);
      }
      setComposerError(error instanceof Error ? error.message : "We could not publish this post.");
    } finally {
      setUploading(false);
    }
  };

  const likePost = async (post: CommunityPost) => {
    if (likingId === post.id) return;
    setLikingId(post.id);
    try {
      const response = await apiFetch(`/api/professionals/community/posts/${post.id}/like`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Could not update your like."));
      const result = await response.json() as { liked: boolean; likeCount: number };
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, viewerLiked: result.liked, likeCount: result.likeCount } : item));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Could not update your like.");
    } finally {
      setLikingId(null);
    }
  };

  const deletePost = async (post: CommunityPost) => {
    if (!window.confirm("Delete this post from the industry room?")) return;
    setDeletingId(post.id);
    try {
      const response = await apiFetch(`/api/professionals/community/posts/${post.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Could not delete this post."));
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Could not delete this post.");
    } finally {
      setDeletingId(null);
    }
  };

  const loadComments = async (post: CommunityPost) => {
    const current = commentPanels[post.id];
    if (current?.open) {
      setCommentPanels((panels) => ({ ...panels, [post.id]: { ...current, open: false } }));
      return;
    }
    setCommentPanels((panels) => ({ ...panels, [post.id]: { open: true, loading: true, error: null, comments: current?.comments || [] } }));
    try {
      const response = await apiFetch(`/api/professionals/community/posts/${post.id}/comments`, { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Could not load notes."));
      const result = await response.json() as { comments: CommunityComment[] };
      setCommentPanels((panels) => ({ ...panels, [post.id]: { open: true, loading: false, error: null, comments: result.comments || [] } }));
    } catch (error) {
      setCommentPanels((panels) => ({ ...panels, [post.id]: { open: true, loading: false, error: error instanceof Error ? error.message : "Could not load notes.", comments: [] } }));
    }
  };

  const addComment = async (post: CommunityPost, content: string) => {
    const response = await apiFetch(`/api/professionals/community/posts/${post.id}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error(await readError(response, "Could not add your note."));
    const comment = await response.json() as CommunityComment;
    setCommentPanels((panels) => {
      const current = panels[post.id] || { open: true, loading: false, error: null, comments: [] };
      return { ...panels, [post.id]: { ...current, open: true, comments: [...current.comments, comment] } };
    });
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, commentCount: item.commentCount + 1 } : item));
  };

  const profileReady = isSignedIn && !!myProfile;

  return (
    <div className="film-grain min-h-[100dvh] bg-background pb-24">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-[hsl(var(--surface-deep))] pt-32">
          <div className="pointer-events-none absolute -right-24 top-16 h-80 w-80 rounded-full border border-primary/10 opacity-70" />
          <div className="pointer-events-none absolute -right-8 top-28 h-64 w-64 rounded-full border border-primary/10 opacity-50" />
          <div className="container relative mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-end">
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <Clapperboard className="h-5 w-5 text-primary" />
                  <span className="cinema-kicker">Private screening room / 001</span>
                </div>
                <h1 className="max-w-4xl font-display text-5xl font-semibold uppercase leading-[0.92] tracking-[-0.06em] text-foreground sm:text-7xl lg:text-[6.7rem]" data-testid="heading-industry-community">
                  The industry<br /><span className="text-primary">room.</span>
                </h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg" data-testid="text-community-intro">
                  A working feed for the people who make the frame. Share a cut, find your next collaborator, and keep the conversation close to the work.
                </p>
              </div>
              <div className="border-l border-primary/40 pl-5 text-sm leading-6 text-muted-foreground lg:mb-1" data-testid="text-community-context">
                <p className="cinema-kicker mb-3">For the call sheet</p>
                <p>Actors, directors, writers, cinematographers, editors, and crew — this is your room to make an entrance.</p>
              </div>
            </div>
            <div className="mt-12 cinema-rule" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <span data-testid="status-community-feed">Live industry feed</span>
              <span data-testid="text-community-guidance">Share work. Credit people. Keep it moving.</span>
            </div>
          </div>
        </section>

        <div className="container mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14 lg:px-8">
          <div className="min-w-0">
            {!isSignedIn ? (
              <div className="mb-8 border border-primary/30 bg-card p-6 sm:p-8" data-testid="panel-sign-in-community">
                <p className="cinema-kicker">Members only</p>
                <h2 className="mt-3 font-display text-2xl uppercase tracking-tight">Take a seat in the room.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Sign in to share your work, respond to collaborators, and see the full industry conversation.</p>
                <Button asChild className="mt-6 gap-2" data-testid="button-sign-in-community">
                  <Link href="/sign-in?redirect=/professionals/community">Sign in to FILMIO <ChevronDown className="h-4 w-4 -rotate-90" /></Link>
                </Button>
              </div>
            ) : profileLoading ? (
              <div className="mb-8 h-28 animate-pulse border border-border bg-card" data-testid="skeleton-profile-access" />
            ) : profileReady ? (
              <form onSubmit={submitPost} className="mb-8 border border-primary/35 bg-card shadow-[0_20px_50px_-40px_hsl(var(--primary))]" data-testid="form-community-composer">
                <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
                  <Avatar author={myProfile || fallbackAuthor} size="sm" testId="img-composer-avatar" />
                  <div>
                    <p className="cinema-kicker">Open the room</p>
                    <p className="mt-1 text-xs text-muted-foreground" data-testid="text-composer-identity">{myProfile?.displayName || fallbackAuthor.displayName}</p>
                  </div>
                  <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-primary/70">New dispatch</span>
                </div>
                <div className="p-5 sm:p-6">
                  <textarea
                    value={caption}
                    onChange={(event) => { setCaption(event.target.value); setComposerError(null); }}
                    maxLength={2000}
                    rows={4}
                    placeholder="What are you working on?"
                    className="w-full resize-y border-0 bg-transparent p-0 text-base leading-7 text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                    aria-label="Post caption"
                    data-testid="textarea-community-caption"
                  />
                  {selectedFile && (
                    <div className="mt-4 flex items-center gap-3 border border-border bg-[hsl(var(--surface-deep))] p-3" data-testid="status-selected-file">
                      {selectedFile.type.startsWith("video") ? <Video className="h-5 w-5 text-primary" /> : <FileImage className="h-5 w-5 text-primary" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                      </div>
                      <button type="button" onClick={() => chooseFile()} className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-primary" aria-label="Remove selected file" data-testid="button-remove-selected-file">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {uploading && selectedFile && (
                    <div className="mt-4" data-testid="status-upload-progress">
                      <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"><span>Sending to the room</span><span className="text-primary">{uploadProgress}%</span></div>
                      <div className="h-1 overflow-hidden bg-muted"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                    </div>
                  )}
                  {composerError && <p className="mt-4 flex items-center gap-2 text-sm text-destructive" role="alert" data-testid="error-community-composer"><CircleAlert className="h-4 w-4 shrink-0" /> {composerError}</p>}
                  {composerNotice && <p className="mt-4 text-sm text-primary" role="status" data-testid="status-community-composer">{composerNotice}</p>}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-border px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                        <UploadCloud className="h-4 w-4" /> Attach work
                        <input ref={fileInputRef} type="file" accept={ACCEPTED_MEDIA} onChange={(event) => chooseFile(event.target.files?.[0])} disabled={uploading} className="sr-only" data-testid="input-community-file" />
                      </label>
                       <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">Images or video / 100 MB max</span>
                    </div>
                    <Button type="submit" disabled={uploading || (!caption.trim() && !selectedFile)} className="gap-2" data-testid="button-publish-community-post">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish dispatch
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mb-8 border border-primary/30 bg-card p-6 sm:p-8" data-testid="panel-create-professional-profile">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Plus className="h-5 w-5" /></div>
                  <div>
                    <p className="cinema-kicker">Your credentials are missing</p>
                    <h2 className="mt-3 font-display text-2xl uppercase tracking-tight">Create your professional profile first.</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">The room is for working professionals. Add your roles and profile details, then come back to share your work with the right people.</p>
                    <Button asChild className="mt-6 gap-2" data-testid="button-create-professional-profile">
                      <Link href="/professionals/dashboard">Build your profile <ChevronDown className="h-4 w-4 -rotate-90" /></Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="cinema-kicker">Now screening</p>
                <h2 className="mt-3 font-display text-3xl uppercase tracking-tight" data-testid="heading-community-feed">Recent work</h2>
              </div>
              <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => { setRefreshing(true); void loadFeed(true); }} disabled={refreshing} data-testid="button-refresh-community-feed">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>

            {loadingFeed ? (
              <div className="space-y-6">{[1, 2, 3].map((item) => <SkeletonPost key={item} index={item} />)}</div>
            ) : feedError ? (
              <div className="border border-destructive/40 bg-card p-8" role="alert" data-testid="error-community-feed">
                <CircleAlert className="h-6 w-6 text-destructive" />
                <h3 className="mt-4 font-display text-xl uppercase">The room is dark.</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feedError}</p>
                <Button type="button" variant="outline" className="mt-6 gap-2" onClick={() => { setRefreshing(true); void loadFeed(true); }} data-testid="button-retry-community-feed">
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : posts.length === 0 ? (
              <div className="border border-dashed border-primary/30 bg-card/60 px-6 py-16 text-center" data-testid="empty-community-feed">
                <Film className="mx-auto h-9 w-9 text-primary/70" />
                <h3 className="mt-5 font-display text-2xl uppercase tracking-tight">First frame is yours.</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">There is quiet in the room right now. Share a scene, a lookbook, or the question your next project is asking.</p>
              </div>
            ) : (
              <div className="space-y-6" data-testid="list-community-posts">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isOwnPost={isOwnPost(post)}
                    onLike={(item) => void likePost(item)}
                    onDelete={(item) => void deletePost(item)}
                    onLoadComments={(item) => void loadComments(item)}
                    onAddComment={addComment}
                    commentState={commentPanels[post.id] || { open: false, loading: false, error: null, comments: [] }}
                  />
                ))}
                {hasMore && <p className="border-t border-border pt-6 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground" data-testid="status-community-more">More dispatches are waiting in the archive.</p>}
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:pt-1">
            <div className="border-t border-primary pt-5" data-testid="panel-room-principles">
              <p className="cinema-kicker">Room notes</p>
              <h2 className="mt-3 font-display text-2xl uppercase tracking-tight">The work comes first.</h2>
              <ul className="mt-5 divide-y divide-border text-sm text-muted-foreground">
                <li className="py-3 leading-6"><span className="mr-2 font-mono text-xs text-primary">01</span> Credit the people behind the frame.</li>
                <li className="py-3 leading-6"><span className="mr-2 font-mono text-xs text-primary">02</span> Share the process, not just the premiere.</li>
                <li className="py-3 leading-6"><span className="mr-2 font-mono text-xs text-primary">03</span> Keep the room useful for the next call.</li>
              </ul>
            </div>
            <div className="border border-border bg-card p-5" data-testid="panel-community-access">
              <CalendarDays className="h-5 w-5 text-primary" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Your access</p>
              <p className="mt-2 text-sm leading-6 text-foreground/80">{profileReady ? "Your professional profile is cleared to publish and connect." : "A professional profile unlocks publishing and the collaborator directory."}</p>
              {!profileReady && isSignedIn && <Link href="/professionals/dashboard" className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary hover:text-primary/80" data-testid="link-community-profile-access">Set up profile <ChevronDown className="h-3 w-3 -rotate-90" /></Link>}
            </div>
            <p className="text-[10px] uppercase leading-5 tracking-[0.16em] text-muted-foreground/60" data-testid="text-community-footer-note">FILMIO INDUSTRY / A PRIVATE NETWORK FOR PUBLIC WORK</p>
          </aside>
        </div>
      </main>
      {deletingId != null && <div className="sr-only" aria-live="polite" data-testid="status-deleting-post">Deleting post</div>}
      {likingId != null && <div className="sr-only" aria-live="polite" data-testid="status-liking-post">Updating like</div>}
    </div>
  );
}