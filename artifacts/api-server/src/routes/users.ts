import { Router, type IRouter } from "express";
import { db, usersTable, followsTable, reviewsTable, ratingsTable, watchlistTable } from "@workspace/db";
import { and, count, eq, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { UpdateMyProfileBody } from "@workspace/api-zod";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

const buildUserProfile = async (user: any, currentUserId: string | null) => {
  const [followerCount] = await db
    .select({ count: count() })
    .from(followsTable)
    .where(eq(followsTable.followingId, user.clerkId));

  const [followingCount] = await db
    .select({ count: count() })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.clerkId));

  const [reviewCount] = await db
    .select({ count: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.userId, user.clerkId));

  let isFollowedByMe = false;
  if (currentUserId && currentUserId !== user.clerkId) {
    const [follow] = await db
      .select()
      .from(followsTable)
      .where(
        and(
          eq(followsTable.followerId, currentUserId),
          eq(followsTable.followingId, user.clerkId),
        ),
      );
    isFollowedByMe = !!follow;
  }

  return {
    id: String(user.id),
    clerkId: user.clerkId,
    username: user.username ?? null,
    displayName: user.displayName ?? null,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isProfessional: user.isProfessional,
    credibilityScore: parseFloat(String(user.credibilityScore ?? "1.0")),
    followersCount: Number(followerCount.count),
    followingCount: Number(followingCount.count),
    reviewsCount: Number(reviewCount.count),
    isFollowedByMe,
    createdAt: user.createdAt.toISOString(),
  };
};

// GET /users/me
router.get("/users/me", requireAuth as any, async (req: any, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const profile = await buildUserProfile(user, req.userId);
  res.json(profile);
});

// PATCH /users/me
router.patch("/users/me", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.clerkId, req.userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const profile = await buildUserProfile(user, req.userId);
  res.json(profile);
});

// GET /users/:id
router.get("/users/:id", optionalAuth as any, async (req: any, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const profile = await buildUserProfile(user, req.userId ?? null);
  res.json(profile);
});

// POST /users/:id/follow
router.post("/users/:id/follow", requireAuth as any, async (req: any, res): Promise<void> => {
  const followingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (followingId === req.userId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }
  const [existing] = await db
    .select()
    .from(followsTable)
    .where(
      and(
        eq(followsTable.followerId, req.userId),
        eq(followsTable.followingId, followingId),
      ),
    );
  if (!existing) {
    await db.insert(followsTable).values({ followerId: req.userId, followingId });
  }
  const [{ followersCount }] = await db
    .select({ followersCount: count() })
    .from(followsTable)
    .where(eq(followsTable.followingId, followingId));
  res.json({ following: true, followersCount: Number(followersCount) });
});

// DELETE /users/:id/follow
router.delete("/users/:id/follow", requireAuth as any, async (req: any, res): Promise<void> => {
  const followingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db
    .delete(followsTable)
    .where(
      and(
        eq(followsTable.followerId, req.userId),
        eq(followsTable.followingId, followingId),
      ),
    );
  res.sendStatus(204);
});

// GET /users/:id/stats
router.get("/users/:id/stats", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [reviewCount] = await db
    .select({ count: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.userId, id));

  const [ratingCount] = await db
    .select({ count: count() })
    .from(ratingsTable)
    .where(eq(ratingsTable.userId, id));

  const [followerCount] = await db
    .select({ count: count() })
    .from(followsTable)
    .where(eq(followsTable.followingId, id));

  const [followingCount] = await db
    .select({ count: count() })
    .from(followsTable)
    .where(eq(followsTable.followerId, id));

  const [watchlistCount] = await db
    .select({ count: count() })
    .from(watchlistTable)
    .where(eq(watchlistTable.userId, id));

  const [user] = await db
    .select({ credibilityScore: usersTable.credibilityScore })
    .from(usersTable)
    .where(eq(usersTable.clerkId, id));

  res.json({
    reviewsCount: Number(reviewCount.count),
    ratingsCount: Number(ratingCount.count),
    followersCount: Number(followerCount.count),
    followingCount: Number(followingCount.count),
    watchlistCount: Number(watchlistCount.count),
    credibilityScore: parseFloat(String(user?.credibilityScore ?? "1.0")),
  });
});

// GET /feed
router.get("/feed", requireAuth as any, async (req: any, res): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  // Get users that req.userId follows
  const following = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, req.userId));

  if (!following.length) {
    res.json([]);
    return;
  }

  const followingIds = following.map((f) => f.followingId);

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(sql`${reviewsTable.userId} = ANY(${followingIds})`)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Enrich with author info
  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users = userIds.length
    ? await db
        .select({ clerkId: usersTable.clerkId, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(sql`${usersTable.clerkId} = ANY(${userIds})`)
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.clerkId, u]));

  res.json(
    reviews.map((r) => ({
      ...r,
      authorName: userMap[r.userId]?.displayName ?? null,
      authorAvatarUrl: userMap[r.userId]?.avatarUrl ?? null,
      isLikedByMe: false,
    })),
  );
});

// GET /recommendations
router.get("/recommendations", optionalAuth as any, async (req: any, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const TMDB_BASE = "https://api.themoviedb.org/3";
  const key = process.env.TMDB_API_KEY;

  const tmdbGet = async (path: string, params: Record<string, string | number> = {}) => {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set("api_key", key!);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const r = await fetch(url.toString());
    return r.ok ? (r.json() as Promise<any>) : null;
  };

  const mapTmdb = (m: any) => ({
    id: m.id, title: m.title ?? "", posterPath: m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null, overview: m.overview ?? "",
    releaseDate: m.release_date ?? "", voteAverage: m.vote_average ?? 0, genreIds: m.genre_ids ?? [],
  });

  if (!req.userId) {
    // Not signed in: return trending
    const data = await tmdbGet("/trending/movie/week");
    res.json(((data?.results ?? []) as any[]).slice(0, limit).map(mapTmdb));
    return;
  }

  // Get user's watched movies with ratings
  const watched = await db
    .select()
    .from(watchlistTable)
    .where(and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "watched")))
    .limit(5);

  if (!watched.length) {
    const data = await tmdbGet("/trending/movie/week");
    res.json(((data?.results ?? []) as any[]).slice(0, limit).map(mapTmdb));
    return;
  }

  // Get recommendations based on watched movies
  const seen = new Set(watched.map((w) => w.movieId));
  const recs: any[] = [];

  for (const w of watched.slice(0, 3)) {
    const data = await tmdbGet(`/movie/${w.movieId}/recommendations`);
    if (!data) continue;
    for (const m of (data.results ?? []).slice(0, 10)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        recs.push(mapTmdb(m));
      }
    }
  }

  res.json(recs.slice(0, limit));
});

export default router;
