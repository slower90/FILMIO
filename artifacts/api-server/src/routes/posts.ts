import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  postCommentsTable,
  postLikesTable,
  postsTable,
  professionalsTable,
  storiesTable,
  usersTable,
} from "@workspace/db";
import {
  CreatePostBody,
  CreatePostCommentBody,
  CreatePostCommentParams,
  GetPostsFeedQueryParams,
  LikePostParams,
  ListPostCommentsParams,
  RequestPostUploadBody,
  CreateStoryBody,
  CreateStoryResponse,
  DeleteStoryParams,
  GetStoriesResponse,
  GetStoryMediaParams,
  RequestStoryUploadBody,
  RequestStoryUploadResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { deletePrivateObject } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const SIDECAR = "http://127.0.0.1:1106";
const MAX_IMAGE_SIZE = 100 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = /^(image|video)\//;
export const STORY_MAX_UPLOAD = 100 * 1024 * 1024;
export const STORY_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
export const STORY_CLEANUP_BATCH_SIZE = 100;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

type FeedCursor = { createdAt: Date; id: number };

function encodeCursor(createdAt: Date, id: number): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(value: unknown): FeedCursor | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const [dateValue, idValue] = Buffer.from(value, "base64url").toString("utf8").split("|");
    const createdAt = new Date(dateValue);
    const id = Number(idValue);
    if (Number.isNaN(createdAt.getTime()) || !Number.isSafeInteger(id) || id < 1) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function isOwnedPostObjectPath(objectPath: unknown, userId: string): objectPath is string {
  return typeof objectPath === "string" &&
    objectPath.startsWith(`/objects/social-feed/${userId}/`) &&
    !objectPath.includes("..");
}

export function isStoryMediaType(contentType: unknown): contentType is string {
  return typeof contentType === "string" && ALLOWED_IMAGE_TYPES.test(contentType);
}

export function isOwnedStoryObjectPath(objectPath: unknown, userId: string): objectPath is string {
  return typeof objectPath === "string" &&
    objectPath.startsWith(`/objects/stories/${userId}/`) &&
    !objectPath.includes("..");
}

function authorFor(
  user: { clerkId: string; displayName: string | null; username: string | null; avatarUrl: string | null },
  professional?: { displayName: string | null; headshotUrl: string | null; verified: boolean } | null,
) {
  const verified = professional?.verified === true;
  return {
    id: user.clerkId,
    displayName: professional?.displayName ?? user.displayName ?? user.username ?? "FILMIO member",
    avatarUrl: professional?.headshotUrl ?? user.avatarUrl ?? null,
    authorType: verified ? "actor" as const : "user" as const,
    verified,
  };
}

async function signedObjectUrl(objectName: string, method: "PUT" | "GET") {
  const bucket = (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "").replace(/^\/+/, "");
  const privateDir = (process.env.PRIVATE_OBJECT_DIR || "").replace(/^\/+|\/+$/g, "");
  const fullName = privateDir ? `${privateDir}/${objectName}` : objectName;
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: fullName,
      method,
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Unable to sign object URL (${response.status})`);
  const body = await response.json() as { signed_url: string };
  return { url: body.signed_url, objectPath: `/objects/${objectName}` };
}

export type StoryRow = {
  story: typeof storiesTable.$inferSelect;
  user: { clerkId: string; displayName: string | null; username: string | null; avatarUrl: string | null };
  professional: { displayName: string | null; headshotUrl: string | null; verified: boolean } | null;
};

export type ExpiredStoryCleanupCandidate = {
  id: number;
  authorId: string;
  mediaUrl: string | null;
  expiresAt: Date;
};

type StoryCleanupDependencies = {
  deleteMedia: (mediaUrl: string) => Promise<void>;
  deleteStory: (storyId: number, expiresBefore: Date) => Promise<boolean>;
  onFailure: (error: unknown, candidate: ExpiredStoryCleanupCandidate) => void;
};

export async function cleanupExpiredStoryCandidate(
  candidate: ExpiredStoryCleanupCandidate,
  dependencies: StoryCleanupDependencies,
): Promise<boolean> {
  try {
    if (candidate.mediaUrl) {
      if (!isOwnedStoryObjectPath(candidate.mediaUrl, candidate.authorId)) {
        throw new Error("Expired story media path is not scoped to its author");
      }
      await dependencies.deleteMedia(candidate.mediaUrl);
    }
    return await dependencies.deleteStory(candidate.id, candidate.expiresAt);
  } catch (error) {
    dependencies.onFailure(error, candidate);
    return false;
  }
}

export async function cleanupExpiredStories(now = new Date()): Promise<{
  scanned: number;
  removed: number;
  failed: number;
}> {
  const candidates = await db.select({
    id: storiesTable.id,
    authorId: storiesTable.authorId,
    mediaUrl: storiesTable.mediaUrl,
    expiresAt: storiesTable.expiresAt,
  })
    .from(storiesTable)
    .where(lte(storiesTable.expiresAt, now))
    .orderBy(storiesTable.expiresAt, storiesTable.id)
    .limit(STORY_CLEANUP_BATCH_SIZE);

  let removed = 0;
  let failed = 0;
  const dependencies: StoryCleanupDependencies = {
    deleteMedia: (mediaUrl) => deletePrivateObject(mediaUrl, { ignoreNotFound: true }),
    deleteStory: async (storyId, expiresBefore) => {
      const deleted = await db.delete(storiesTable)
        .where(and(
          eq(storiesTable.id, storyId),
          lte(storiesTable.expiresAt, expiresBefore),
        ))
        .returning({ id: storiesTable.id });
      return deleted.length > 0;
    },
    onFailure: (error, candidate) => {
      failed++;
      logger.warn({ error, storyId: candidate.id }, "expired story cleanup failed");
    },
  };

  for (const candidate of candidates) {
    if (await cleanupExpiredStoryCandidate(candidate, dependencies)) {
      removed++;
    }
  }

  return { scanned: candidates.length, removed, failed };
}

let storyCleanupInFlight: Promise<void> | null = null;

export function startStoryCleanup(): () => void {
  const runCleanup = () => {
    if (storyCleanupInFlight) return;
    storyCleanupInFlight = cleanupExpiredStories()
      .then((summary) => {
        if (summary.scanned > 0) {
          logger.info(summary, "expired story cleanup completed");
        }
      })
      .catch((error) => {
        logger.error({ error }, "expired story cleanup run failed");
      })
      .finally(() => {
        storyCleanupInFlight = null;
      });
  };

  runCleanup();
  const timer = setInterval(runCleanup, STORY_CLEANUP_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

function enrichStory({ story, user, professional }: StoryRow, viewerId: string) {
  return {
    id: story.id,
    author: authorFor(user, professional),
    content: story.content,
    mediaUrl: story.mediaUrl ? `/api/stories/${story.id}/media` : null,
    mediaType: story.mediaType,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    isOwner: story.authorId === viewerId,
  };
}

async function storyRow(id: number) {
  const [row] = await db.select({
    story: storiesTable,
    user: {
      clerkId: usersTable.clerkId,
      displayName: usersTable.displayName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    },
    professional: {
      displayName: professionalsTable.displayName,
      headshotUrl: professionalsTable.headshotUrl,
      verified: professionalsTable.verified,
    },
  })
    .from(storiesTable)
    .innerJoin(usersTable, eq(storiesTable.authorId, usersTable.clerkId))
    .leftJoin(professionalsTable, eq(storiesTable.authorId, professionalsTable.userId))
    .where(eq(storiesTable.id, id));
  return row;
}

export type StoryCreateInput = {
  authorId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  expiresAt: Date;
};

export type StoryRouteDependencies = {
  listActive: () => Promise<StoryRow[]>;
  create: (input: StoryCreateInput) => Promise<StoryRow>;
  findActiveMedia: (id: number, now: Date) => Promise<{ mediaUrl: string | null } | undefined>;
  deleteOwned: (id: number, authorId: string) => Promise<{ id: number; mediaUrl: string | null } | undefined>;
  signObject: typeof signedObjectUrl;
  deleteMedia: typeof deletePrivateObject;
};

function productionStoryRouteDependencies(): StoryRouteDependencies {
  return {
    listActive: async () => db.select({
      story: storiesTable,
      user: {
        clerkId: usersTable.clerkId,
        displayName: usersTable.displayName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      },
      professional: {
        displayName: professionalsTable.displayName,
        headshotUrl: professionalsTable.headshotUrl,
        verified: professionalsTable.verified,
      },
    })
      .from(storiesTable)
      .innerJoin(usersTable, eq(storiesTable.authorId, usersTable.clerkId))
      .leftJoin(professionalsTable, eq(storiesTable.authorId, professionalsTable.userId))
      .where(gt(storiesTable.expiresAt, new Date()))
      .orderBy(desc(storiesTable.createdAt))
      .limit(50),
    create: async (input) => {
      const [story] = await db.insert(storiesTable).values(input).returning();
      const row = await storyRow(story.id);
      if (!row) throw new Error("Could not load the published story.");
      return row;
    },
    findActiveMedia: async (id, now) => db.select({
      mediaUrl: storiesTable.mediaUrl,
    })
      .from(storiesTable)
      .where(and(eq(storiesTable.id, id), gt(storiesTable.expiresAt, now)))
      .then((rows) => rows[0]),
    deleteOwned: async (id, authorId) => {
      const [story] = await db.delete(storiesTable)
        .where(and(eq(storiesTable.id, id), eq(storiesTable.authorId, authorId)))
        .returning({ id: storiesTable.id, mediaUrl: storiesTable.mediaUrl });
      return story;
    },
    signObject: signedObjectUrl,
    deleteMedia: deletePrivateObject,
  };
}

async function enrichPosts(rows: Array<{
  post: typeof postsTable.$inferSelect;
  user: { clerkId: string; displayName: string | null; username: string | null; avatarUrl: string | null };
  professional: { displayName: string | null; headshotUrl: string | null; verified: boolean } | null;
}>, viewerId: string) {
  const postIds = rows.map(({ post }) => post.id);
  if (!postIds.length) return [];

  const [likeCounts, commentCounts, viewerLikes] = await Promise.all([
    db.select({ postId: postLikesTable.postId, count: sql<number>`count(*)` })
      .from(postLikesTable)
      .where(inArray(postLikesTable.postId, postIds))
      .groupBy(postLikesTable.postId),
    db.select({ postId: postCommentsTable.postId, count: sql<number>`count(*)` })
      .from(postCommentsTable)
      .where(inArray(postCommentsTable.postId, postIds))
      .groupBy(postCommentsTable.postId),
    db.select({ postId: postLikesTable.postId })
      .from(postLikesTable)
      .where(and(eq(postLikesTable.userId, viewerId), inArray(postLikesTable.postId, postIds))),
  ]);

  const likeMap = new Map(likeCounts.map((row) => [row.postId, Number(row.count)]));
  const commentMap = new Map(commentCounts.map((row) => [row.postId, Number(row.count)]));
  const viewerLikeSet = new Set(viewerLikes.map((row) => row.postId));

  return rows.map(({ post, user, professional }) => ({
    id: post.id,
    author: authorFor(user, professional),
    content: post.content,
    imageUrl: post.imageUrl ? `/api/posts/${post.id}/image` : null,
    imageType: post.imageType,
    linkedMovieId: post.linkedMovieId,
    linkedMovieTitle: post.linkedMovieTitle,
    linkedMoviePosterPath: post.linkedMoviePosterPath,
    postType: post.postType === "announcement" ? "announcement" as const : "standard" as const,
    likesCount: likeMap.get(post.id) ?? 0,
    commentsCount: commentMap.get(post.id) ?? 0,
    viewerLiked: viewerLikeSet.has(post.id),
    createdAt: post.createdAt,
  }));
}

router.get("/posts/feed", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = GetPostsFeedQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cursor = decodeCursor(parsed.data.cursor);
  if (parsed.data.cursor && !cursor) {
    res.status(400).json({ error: "Invalid feed cursor." });
    return;
  }

  const cursorFilter = cursor
    ? or(
      lt(postsTable.createdAt, cursor.createdAt),
      and(eq(postsTable.createdAt, cursor.createdAt), lt(postsTable.id, cursor.id)),
    )
    : undefined;

  const rows = await db
    .select({
      post: postsTable,
      user: {
        clerkId: usersTable.clerkId,
        displayName: usersTable.displayName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      },
      professional: {
        displayName: professionalsTable.displayName,
        headshotUrl: professionalsTable.headshotUrl,
        verified: professionalsTable.verified,
      },
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.clerkId))
    .leftJoin(professionalsTable, eq(postsTable.authorId, professionalsTable.userId))
    .where(cursorFilter)
    .orderBy(desc(postsTable.createdAt), desc(postsTable.id))
    .limit(parsed.data.limit + 1);

  const hasMore = rows.length > parsed.data.limit;
  const visibleRows = rows.slice(0, parsed.data.limit);
  const items = await enrichPosts(visibleRows, req.userId);
  const last = visibleRows.at(-1)?.post;

  res.json({
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    hasMore,
  });
});

router.post("/posts/upload-url", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = RequestPostUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, size, contentType } = parsed.data;
  if (!name.trim() || name.length > 240 || size > STORY_MAX_UPLOAD || !isStoryMediaType(contentType)) {
    res.status(400).json({ error: "Upload an image or video up to 100MB." });
    return;
  }

  try {
    const signed = await signedObjectUrl(`social-feed/${req.userId}/${randomUUID()}`, "PUT");
    res.json({ uploadURL: signed.url, imageUrl: signed.objectPath, name: name.trim(), size, contentType });
  } catch (error) {
    req.log.error({ error }, "social feed upload signing failed");
    res.status(500).json({ error: "Could not prepare the upload." });
  }
});

router.post("/posts", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  const content = body.content.trim();
  if (!content && !body.imageUrl) {
    res.status(400).json({ error: "Add some text or an image to publish a post." });
    return;
  }
  if (body.imageUrl && (
    !isOwnedPostObjectPath(body.imageUrl, req.userId) ||
    !body.imageType ||
    !ALLOWED_IMAGE_TYPES.test(body.imageType) ||
    !body.imageName?.trim() ||
    !body.imageSize ||
    body.imageSize > MAX_IMAGE_SIZE
  )) {
    res.status(400).json({ error: "Complete image upload details are required." });
    return;
  }
  if (body.postType === "announcement") {
    const [professional] = await db.select({ verified: professionalsTable.verified })
      .from(professionalsTable)
      .where(eq(professionalsTable.userId, req.userId));
    if (!professional?.verified) {
      res.status(403).json({ error: "Only verified professionals can publish announcements." });
      return;
    }
  }

  try {
    const [post] = await db.insert(postsTable).values({
      authorId: req.userId,
      authorType: body.postType === "announcement" ? "actor" : "user",
      content,
      imageUrl: body.imageUrl ?? null,
      imageType: body.imageType ?? null,
      imageName: body.imageName?.trim() ?? null,
      imageSize: body.imageSize ?? null,
      linkedMovieId: body.linkedMovieId ?? null,
      linkedMovieTitle: body.linkedMovieTitle?.trim() ?? null,
      linkedMoviePosterPath: body.linkedMoviePosterPath ?? null,
      postType: body.postType ?? "standard",
    }).returning();

    const [row] = await db.select({
      post: postsTable,
      user: {
        clerkId: usersTable.clerkId,
        displayName: usersTable.displayName,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      },
      professional: {
        displayName: professionalsTable.displayName,
        headshotUrl: professionalsTable.headshotUrl,
        verified: professionalsTable.verified,
      },
    })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.authorId, usersTable.clerkId))
      .leftJoin(professionalsTable, eq(postsTable.authorId, professionalsTable.userId))
      .where(eq(postsTable.id, post.id));
    const [result] = await enrichPosts(row ? [row] : [], req.userId);
    res.status(201).json(result);
  } catch (error) {
    if (body.imageUrl) {
      await deletePrivateObject(body.imageUrl).catch((cleanupError) => {
        req.log.warn({ cleanupError }, "failed to clean up unpublished social feed image");
      });
    }
    req.log.error({ error }, "social feed post creation failed");
    res.status(500).json({ error: "Could not publish this post." });
  }
});

export function createStoriesRouter(
  authMiddleware: any = requireAuth,
  dependencies: StoryRouteDependencies = productionStoryRouteDependencies(),
): IRouter {
  const storiesRouter: IRouter = Router();

  storiesRouter.get("/stories", authMiddleware, async (req: any, res): Promise<void> => {
    const rows = await dependencies.listActive();
    res.json(GetStoriesResponse.parse(rows.map((row) => enrichStory(row, req.userId))));
  });

  storiesRouter.post("/stories/upload-url", authMiddleware, async (req: any, res): Promise<void> => {
    const parsed = RequestStoryUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { name, size, contentType } = parsed.data;
    if (!name.trim() || name.length > 240 || size > MAX_IMAGE_SIZE || !ALLOWED_IMAGE_TYPES.test(contentType)) {
      res.status(400).json({ error: "Upload an image or video up to 100MB." });
      return;
    }

    try {
      const signed = await dependencies.signObject(`stories/${req.userId}/${randomUUID()}`, "PUT");
      res.json(RequestStoryUploadResponse.parse({
        uploadURL: signed.url,
        mediaUrl: signed.objectPath,
        name: name.trim(),
        size,
        contentType,
      }));
    } catch (error) {
      req.log.error({ error }, "story upload signing failed");
      res.status(500).json({ error: "Could not prepare the story upload." });
    }
  });

  storiesRouter.post("/stories", authMiddleware, async (req: any, res): Promise<void> => {
    const parsed = CreateStoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const body = parsed.data;
    const content = body.content?.trim() ?? "";
    if (!content && !body.mediaUrl) {
      res.status(400).json({ error: "Add some text or media before publishing your story." });
      return;
    }
    if (body.mediaUrl && (
      !isOwnedStoryObjectPath(body.mediaUrl, req.userId) ||
      !body.mediaType ||
      !isStoryMediaType(body.mediaType) ||
      !body.mediaName?.trim() ||
      !body.mediaSize ||
      body.mediaSize > STORY_MAX_UPLOAD
    )) {
      res.status(400).json({ error: "Complete story media details are required." });
      return;
    }

    try {
      const row = await dependencies.create({
        authorId: req.userId,
        content,
        mediaUrl: body.mediaUrl ?? null,
        mediaType: body.mediaType ?? null,
        mediaName: body.mediaName?.trim() ?? null,
        mediaSize: body.mediaSize ?? null,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      });
      res.status(201).json(CreateStoryResponse.parse(enrichStory(row, req.userId)));
    } catch (error) {
      if (body.mediaUrl) {
        await dependencies.deleteMedia(body.mediaUrl).catch((cleanupError) => {
          req.log.warn({ cleanupError }, "failed to clean up unpublished story media");
        });
      }
      req.log.error({ error }, "story creation failed");
      res.status(500).json({ error: "Could not publish this story." });
    }
  });

  storiesRouter.get("/stories/:id/media", authMiddleware, async (req: any, res): Promise<void> => {
    const parsed = GetStoryMediaParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const story = await dependencies.findActiveMedia(parsed.data.id, new Date());
    if (!story?.mediaUrl) {
      res.status(404).json({ error: "Story media not found or expired." });
      return;
    }
    try {
      const signed = await dependencies.signObject(story.mediaUrl.replace("/objects/", ""), "GET");
      res.redirect(signed.url);
    } catch (error) {
      req.log.warn({ error, storyId: parsed.data.id }, "story media unavailable");
      res.status(404).json({ error: "Story media unavailable." });
    }
  });

  storiesRouter.delete("/stories/:id", authMiddleware, async (req: any, res): Promise<void> => {
    const parsed = DeleteStoryParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const story = await dependencies.deleteOwned(parsed.data.id, req.userId);
    if (!story) {
      res.status(404).json({ error: "Story not found." });
      return;
    }

    if (story.mediaUrl) {
      await dependencies.deleteMedia(story.mediaUrl).catch((error) => {
        req.log.warn({ error, storyId: story.id }, "story media cleanup failed");
      });
    }
    res.sendStatus(204);
  });

  return storiesRouter;
}

router.use(createStoriesRouter());

router.get("/posts/:id/image", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid post id." });
    return;
  }
  const [post] = await db.select({ imageUrl: postsTable.imageUrl })
    .from(postsTable)
    .where(eq(postsTable.id, id));
  if (!post?.imageUrl) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  try {
    const signed = await signedObjectUrl(post.imageUrl.replace("/objects/", ""), "GET");
    res.redirect(signed.url);
  } catch (error) {
    req.log.warn({ error, postId: id }, "social feed image unavailable");
    res.status(404).json({ error: "Image unavailable." });
  }
});

async function parsePostId(req: any, res: any): Promise<number | null> {
  const parsed = LikePostParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return null;
  }
  return parsed.data.id;
}

async function postExists(id: number): Promise<boolean> {
  const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, id));
  return Boolean(post);
}

async function likeState(id: number, userId: string) {
  const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, id));
  if (!post) return null;
  const [viewerLike] = await db.select({ id: postLikesTable.id })
    .from(postLikesTable)
    .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, userId)));
  const [count] = await db.select({ count: sql<number>`count(*)` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, id));
  return { liked: Boolean(viewerLike), likesCount: Number(count.count) };
}

router.post("/posts/:id/like", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = await parsePostId(req, res);
  if (id == null) return;
  if (!(await postExists(id))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  await db.insert(postLikesTable).values({ postId: id, userId: req.userId }).onConflictDoNothing();
  res.json(await likeState(id, req.userId));
});

router.delete("/posts/:id/like", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = await parsePostId(req, res);
  if (id == null) return;
  if (!(await postExists(id))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  await db.delete(postLikesTable)
    .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, req.userId)));
  res.json(await likeState(id, req.userId));
});

router.get("/posts/:id/comments", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = ListPostCommentsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = parsed.data.id;
  if (!(await postExists(id))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  const rows = await db.select({
    comment: postCommentsTable,
    user: {
      clerkId: usersTable.clerkId,
      displayName: usersTable.displayName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    },
    professional: {
      displayName: professionalsTable.displayName,
      headshotUrl: professionalsTable.headshotUrl,
      verified: professionalsTable.verified,
    },
  })
    .from(postCommentsTable)
    .innerJoin(usersTable, eq(postCommentsTable.userId, usersTable.clerkId))
    .leftJoin(professionalsTable, eq(postCommentsTable.userId, professionalsTable.userId))
    .where(eq(postCommentsTable.postId, id))
    .orderBy(desc(postCommentsTable.createdAt));
  res.json(rows.map(({ comment, user, professional }) => ({
    id: comment.id,
    postId: comment.postId,
    userId: comment.userId,
    author: authorFor(user, professional),
    content: comment.content,
    createdAt: comment.createdAt,
  })));
});

router.post("/posts/:id/comments", requireAuth as any, async (req: any, res): Promise<void> => {
  const params = CreatePostCommentParams.safeParse(req.params);
  const body = CreatePostCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const errorMessage = !params.success
      ? params.error.message
      : !body.success
        ? body.error.message
        : "Invalid comment.";
    res.status(400).json({ error: errorMessage });
    return;
  }
  if (!(await postExists(params.data.id))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }

  const [comment] = await db.insert(postCommentsTable).values({
    postId: params.data.id,
    userId: req.userId,
    content: body.data.content.trim(),
  }).returning();
  const [row] = await db.select({
    comment: postCommentsTable,
    user: {
      clerkId: usersTable.clerkId,
      displayName: usersTable.displayName,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    },
    professional: {
      displayName: professionalsTable.displayName,
      headshotUrl: professionalsTable.headshotUrl,
      verified: professionalsTable.verified,
    },
  })
    .from(postCommentsTable)
    .innerJoin(usersTable, eq(postCommentsTable.userId, usersTable.clerkId))
    .leftJoin(professionalsTable, eq(postCommentsTable.userId, professionalsTable.userId))
    .where(eq(postCommentsTable.id, comment.id));

  const result = row ? {
    id: row.comment.id,
    postId: row.comment.postId,
    userId: row.comment.userId,
    author: authorFor(row.user, row.professional),
    content: row.comment.content,
    createdAt: row.comment.createdAt,
  } : null;
  res.status(201).json(result);
});

export default router;