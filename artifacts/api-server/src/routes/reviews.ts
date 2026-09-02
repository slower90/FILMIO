import { Router, type IRouter } from "express";
import { db, reviewsTable, reviewLikesTable, commentsTable, usersTable, viewingHistoryTable } from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import {
  CreateReviewBody,
  UpdateReviewBody,
  CreateCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const REVIEW_CONTENT_MAX_LENGTH = 10_000;

const validReviewContent = (content: string) => {
  const normalized = content.trim();
  return normalized.length >= 10 && normalized.length <= REVIEW_CONTENT_MAX_LENGTH
    ? normalized
    : null;
};

const enrichReviews = async (reviews: any[], currentUserId: string | null) => {
  if (!reviews.length) return [];

  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users = await db
    .select({ clerkId: usersTable.clerkId, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(inArray(usersTable.clerkId, userIds));

  const userMap = Object.fromEntries(users.map((u) => [u.clerkId, u]));

  let likedIds = new Set<number>();
  if (currentUserId) {
    const likes = await db
      .select({ reviewId: reviewLikesTable.reviewId })
      .from(reviewLikesTable)
      .where(eq(reviewLikesTable.userId, currentUserId));
    likedIds = new Set(likes.map((l) => l.reviewId));
  }

  return reviews.map((r) => ({
    ...r,
    authorName: userMap[r.userId]?.displayName ?? null,
    authorAvatarUrl: userMap[r.userId]?.avatarUrl ?? null,
    isLikedByMe: likedIds.has(r.id),
  }));
};

// GET /reviews
router.get("/reviews", optionalAuth as any, async (req: any, res): Promise<void> => {
  const movieId = req.query.movieId ? Number(req.query.movieId) : undefined;
  const userId = req.query.userId as string | undefined;
  const type = (req.query.type as string) ?? "all";
  const page = Number(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = db.select().from(reviewsTable).$dynamic();
  const conditions = [];
  if (movieId) conditions.push(eq(reviewsTable.movieId, movieId));
  if (userId) conditions.push(eq(reviewsTable.userId, userId));
  if (type === "critic") conditions.push(eq(reviewsTable.isCriticReview, true));
  if (type === "audience") conditions.push(eq(reviewsTable.isCriticReview, false));

  if (conditions.length) {
    query = query.where(and(...conditions));
  }

  const reviews = await query
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const enriched = await enrichReviews(reviews, req.userId ?? null);
  res.json(enriched);
});

// POST /reviews
router.post("/reviews", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const content = validReviewContent(parsed.data.content);
  if (content === null) {
    res.status(400).json({ error: "Review content must be between 10 and 10000 characters." });
    return;
  }
  const [review] = await db
    .insert(reviewsTable)
    .values({
      userId: req.userId,
      movieId: parsed.data.movieId,
      content,
      rating: parsed.data.rating ?? null,
      isCriticReview: parsed.data.isCriticReview ?? false,
      containsSpoilers: parsed.data.containsSpoilers ?? false,
      verifiedWatch: Boolean((await db
        .select({ id: viewingHistoryTable.id })
        .from(viewingHistoryTable)
        .where(and(
          eq(viewingHistoryTable.userId, req.userId),
          eq(viewingHistoryTable.movieId, parsed.data.movieId),
        ))
        .limit(1))[0]),
    })
    .returning();
  const [enriched] = await enrichReviews([review], req.userId);
  res.status(201).json(enriched);
});

// GET /reviews/trending — must be before /:id
router.get("/reviews/trending", optionalAuth as any, async (req: any, res): Promise<void> => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const reviews = await db
    .select()
    .from(reviewsTable)
    .orderBy(desc(reviewsTable.likesCount), desc(reviewsTable.createdAt))
    .limit(limit);
  const enriched = await enrichReviews(reviews, req.userId ?? null);
  res.json(enriched);
});

// GET /reviews/:id
router.get("/reviews/:id", optionalAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  const [enriched] = await enrichReviews([review], req.userId ?? null);
  res.json(enriched);
});

// PATCH /reviews/:id
router.patch("/reviews/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData = { ...parsed.data } as Record<string, unknown>;
  if (parsed.data.content !== undefined) {
    const content = validReviewContent(parsed.data.content);
    if (content === null) {
      res.status(400).json({ error: "Review content must be between 10 and 10000 characters." });
      return;
    }
    updateData.content = content;
  }
  const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [updated] = await db
    .update(reviewsTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(reviewsTable.id, id))
    .returning();
  const [enriched] = await enrichReviews([updated], req.userId);
  res.json(enriched);
});

// DELETE /reviews/:id
router.delete("/reviews/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  if (existing.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
  res.sendStatus(204);
});

// POST /reviews/:id/like
router.post("/reviews/:id/like", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db
    .select()
    .from(reviewLikesTable)
    .where(and(eq(reviewLikesTable.userId, req.userId), eq(reviewLikesTable.reviewId, id)));

  if (existing) {
    await db.delete(reviewLikesTable).where(eq(reviewLikesTable.id, existing.id));
    await db
      .update(reviewsTable)
      .set({ likesCount: sql`GREATEST(${reviewsTable.likesCount} - 1, 0)` })
      .where(eq(reviewsTable.id, id));
    const [r] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    res.json({ liked: false, likesCount: r?.likesCount ?? 0 });
  } else {
    await db.insert(reviewLikesTable).values({ userId: req.userId, reviewId: id });
    await db
      .update(reviewsTable)
      .set({ likesCount: sql`${reviewsTable.likesCount} + 1` })
      .where(eq(reviewsTable.id, id));
    const [r] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    res.json({ liked: true, likesCount: r?.likesCount ?? 0 });
  }
});

// GET /reviews/:id/comments
router.get("/reviews/:id/comments", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.reviewId, id))
    .orderBy(commentsTable.createdAt);

  const userIds = [...new Set(comments.map((c) => c.userId))];
  const users = userIds.length
    ? await db
        .select({ clerkId: usersTable.clerkId, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.clerkId, userIds))
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.clerkId, u]));

  res.json(
    comments.map((c) => ({
      ...c,
      authorName: userMap[c.userId]?.displayName ?? null,
      authorAvatarUrl: userMap[c.userId]?.avatarUrl ?? null,
    })),
  );
});

// POST /reviews/:id/comments
router.post("/reviews/:id/comments", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [review] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(eq(reviewsTable.id, id));
  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  const [comment] = await db
    .insert(commentsTable)
    .values({ userId: req.userId, reviewId: id, content: parsed.data.content })
    .returning();
  await db
    .update(reviewsTable)
    .set({ commentsCount: sql`${reviewsTable.commentsCount} + 1` })
    .where(eq(reviewsTable.id, id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.userId));
  res.status(201).json({
    ...comment,
    authorName: user?.displayName ?? null,
    authorAvatarUrl: user?.avatarUrl ?? null,
  });
});

export default router;
