import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  followsTable,
  friendRequestsTable,
  reviewsTable,
  ratingsTable,
  watchlistTable,
  viewingHistoryTable,
} from "@workspace/db";
import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import {
  AcceptFriendRequestParams,
  AcceptFriendRequestResponse,
  CancelFriendRequestParams,
  DeclineFriendRequestParams,
  GetFriendsOverviewQueryParams,
  GetFriendsOverviewResponse,
  SendFriendRequestParams,
  SendFriendRequestResponse,
  UnfriendUserParams,
  UpdateMyProfileBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
type ViewingHistoryMovie = {
  id: number;
  title: string;
  posterPath?: string | null;
  releaseDate?: string | null;
  voteAverage?: number | null;
};

function parseViewingHistoryBody(body: unknown): ViewingHistoryMovie[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as any).movies)) return null;
  const movies = (body as any).movies as unknown[];
  if (movies.length > 12) return null;
  if (
    movies.some((movie) => {
      if (!movie || typeof movie !== "object") return true;
      const value = movie as any;
      return (
        !Number.isInteger(value.id) ||
        value.id <= 0 ||
        typeof value.title !== "string" ||
        value.title.length === 0 ||
        value.title.length > 500 ||
        (value.posterPath != null && typeof value.posterPath !== "string") ||
        (value.releaseDate != null && typeof value.releaseDate !== "string") ||
        (value.voteAverage != null && typeof value.voteAverage !== "number")
      );
    })
  ) {
    return null;
  }
  return movies as ViewingHistoryMovie[];
}

const mapViewingHistory = (entry: typeof viewingHistoryTable.$inferSelect) => ({
  id: entry.movieId,
  title: entry.movieTitle,
  posterPath: entry.moviePosterPath,
  releaseDate: entry.movieReleaseDate,
  voteAverage: entry.movieVoteAverage,
});

type ViewingHistoryRepository = {
  list: (userId: string) => Promise<ViewingHistoryMovie[]>;
  merge: (userId: string, movies: ViewingHistoryMovie[]) => Promise<ViewingHistoryMovie[]>;
  clear: (userId: string) => Promise<void>;
};

const databaseViewingHistoryRepository: ViewingHistoryRepository = {
  async list(userId) {
    const entries = await db
      .select()
      .from(viewingHistoryTable)
      .where(eq(viewingHistoryTable.userId, userId))
      .orderBy(desc(viewingHistoryTable.viewedAt))
      .limit(12);
    return entries.map(mapViewingHistory);
  },
  async merge(userId, movies) {
    for (const movie of movies) {
      await db
        .insert(viewingHistoryTable)
        .values({
          userId,
          movieId: movie.id,
          movieTitle: movie.title,
          moviePosterPath: movie.posterPath ?? null,
          movieReleaseDate: movie.releaseDate ?? null,
          movieVoteAverage: movie.voteAverage ?? null,
          viewedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [viewingHistoryTable.userId, viewingHistoryTable.movieId],
          set: {
            movieTitle: movie.title,
            moviePosterPath: movie.posterPath ?? null,
            movieReleaseDate: movie.releaseDate ?? null,
            movieVoteAverage: movie.voteAverage ?? null,
            viewedAt: new Date(),
          },
        });
    }
    return databaseViewingHistoryRepository.list(userId);
  },
  async clear(userId) {
    await db.delete(viewingHistoryTable).where(eq(viewingHistoryTable.userId, userId));
  },
};

// History is always scoped by the authenticated Clerk user; no user id is accepted
// from the client, which prevents one account from reading another's activity.
export function createViewingHistoryRouter(
  repository: ViewingHistoryRepository = databaseViewingHistoryRepository,
  authMiddleware: any = requireAuth,
): IRouter {
  const historyRouter: IRouter = Router();
  historyRouter.get("/users/me/viewing-history", authMiddleware, async (req: any, res): Promise<void> => {
    res.json(await repository.list(req.userId));
  });
  historyRouter.post("/users/me/viewing-history", authMiddleware, async (req: any, res): Promise<void> => {
    const movies = parseViewingHistoryBody(req.body);
    if (!movies) {
      res.status(400).json({ error: "Invalid viewing history" });
      return;
    }
    res.json(await repository.merge(req.userId, movies));
  });
  historyRouter.delete("/users/me/viewing-history", authMiddleware, async (req: any, res): Promise<void> => {
    await repository.clear(req.userId);
    res.sendStatus(204);
  });
  return historyRouter;
}

router.use(createViewingHistoryRouter());

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
router.get("/users/:id", optionalAuth as any, async (req: any, res, next): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (id === "friends") {
    next();
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(
      eq(usersTable.clerkId, id),
      sql`${usersTable.id}::text = ${id}`,
    ));
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

type FriendRelationship = "none" | "incoming" | "outgoing" | "friends";
type FriendRequestLike = {
  status: string;
  senderId: string;
  receiverId: string;
};

export function friendRequestConflict(
  currentUserId: string,
  targetUserId: string,
  existing?: FriendRequestLike,
) {
  if (currentUserId === targetUserId) return "self";
  if (!existing) return null;
  if (existing.status === "accepted") return "accepted";
  if (existing.senderId === currentUserId) return "outgoing";
  return "incoming";
}

export function canMutateFriendRequest(
  action: "accept" | "decline" | "cancel",
  currentUserId: string,
  request: FriendRequestLike,
) {
  if (request.status !== "pending") return false;
  if (action === "cancel") return request.senderId === currentUserId;
  return request.receiverId === currentUserId;
}

export function canUnfriend(
  currentUserId: string,
  targetUserId: string,
  relationship?: FriendRequestLike,
) {
  if (!relationship || relationship.status !== "accepted") return false;
  return (
    (relationship.senderId === currentUserId && relationship.receiverId === targetUserId) ||
    (relationship.senderId === targetUserId && relationship.receiverId === currentUserId)
  );
}

type FriendUserRecord = {
  id: number;
  clerkId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isProfessional: boolean;
};

function publicFriendUser(
  user: FriendUserRecord,
  relationship: FriendRelationship,
  requestId: number | null,
) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isProfessional: user.isProfessional,
    relationship,
    requestId,
  };
}

function friendRequestResponse(
  request: typeof friendRequestsTable.$inferSelect,
  user: FriendUserRecord,
  relationship: FriendRelationship,
) {
  return {
    id: request.id,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    user: publicFriendUser(user, relationship, request.id),
  };
}

async function friendUserMap(clerkIds: string[]) {
  if (!clerkIds.length) return new Map<string, FriendUserRecord>();
  const users = await db
    .select({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      isProfessional: usersTable.isProfessional,
    })
    .from(usersTable)
    .where(inArray(usersTable.clerkId, clerkIds));
  return new Map(users.map((user) => [user.clerkId, user]));
}

// GET /users/friends
router.get("/users/friends", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = GetFriendsOverviewQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const query = parsed.data.q?.trim();
  const userFilter = query
    ? or(ilike(usersTable.displayName, `%${query}%`), ilike(usersTable.username, `%${query}%`))
    : undefined;
  const directoryRows = await db
    .select({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      isProfessional: usersTable.isProfessional,
    })
    .from(usersTable)
    .where(and(ne(usersTable.clerkId, req.userId), userFilter))
    .orderBy(desc(usersTable.createdAt))
    .limit(parsed.data.limit);

  const relationships = await db
    .select()
    .from(friendRequestsTable)
    .where(or(eq(friendRequestsTable.senderId, req.userId), eq(friendRequestsTable.receiverId, req.userId)))
    .orderBy(desc(friendRequestsTable.updatedAt), desc(friendRequestsTable.createdAt));

  const otherIds = relationships.map((relationship) =>
    relationship.senderId === req.userId ? relationship.receiverId : relationship.senderId,
  );
  const usersByClerkId = await friendUserMap([...new Set(otherIds)]);
  const relationshipByOtherId = new Map<string, typeof relationships[number]>();

  for (const relationship of relationships) {
    const otherId = relationship.senderId === req.userId ? relationship.receiverId : relationship.senderId;
    const current = relationshipByOtherId.get(otherId);
    if (!current || relationship.status === "accepted" || current.status !== "accepted") {
      relationshipByOtherId.set(otherId, relationship);
    }
  }

  const relationshipFor = (user: FriendUserRecord) => {
    const relationship = relationshipByOtherId.get(user.clerkId);
    if (!relationship) return publicFriendUser(user, "none", null);
    if (relationship.status === "accepted") return publicFriendUser(user, "friends", relationship.id);
    return publicFriendUser(
      user,
      relationship.senderId === req.userId ? "outgoing" : "incoming",
      relationship.id,
    );
  };

  const incomingRequests = relationships
    .filter((relationship) => relationship.status === "pending" && relationship.receiverId === req.userId)
    .map((relationship) => {
      const user = usersByClerkId.get(relationship.senderId);
      return user ? friendRequestResponse(relationship, user, "incoming") : null;
    })
    .filter((request): request is NonNullable<typeof request> => request !== null);
  const outgoingRequests = relationships
    .filter((relationship) => relationship.status === "pending" && relationship.senderId === req.userId)
    .map((relationship) => {
      const user = usersByClerkId.get(relationship.receiverId);
      return user ? friendRequestResponse(relationship, user, "outgoing") : null;
    })
    .filter((request): request is NonNullable<typeof request> => request !== null);
  const friends = relationships
    .filter((relationship) => relationship.status === "accepted")
    .map((relationship) => {
      const otherId = relationship.senderId === req.userId ? relationship.receiverId : relationship.senderId;
      const user = usersByClerkId.get(otherId);
      return user ? publicFriendUser(user, "friends", relationship.id) : null;
    })
    .filter((user): user is NonNullable<typeof user> => user !== null);

  res.json(GetFriendsOverviewResponse.parse({
    users: directoryRows.map(relationshipFor),
    incomingRequests,
    outgoingRequests,
    friends,
    counts: {
      incoming: incomingRequests.length,
      outgoing: outgoingRequests.length,
      friends: friends.length,
    },
  }));
});

// POST /users/:id/friend-request
router.post("/users/:id/friend-request", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = SendFriendRequestParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      isProfessional: usersTable.isProfessional,
    })
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.id));
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (friendRequestConflict(req.userId, target.clerkId) === "self") {
    res.status(400).json({ error: "You cannot send a friend request to yourself." });
    return;
  }

  const [existing] = await db
    .select()
    .from(friendRequestsTable)
    .where(or(
      and(eq(friendRequestsTable.senderId, req.userId), eq(friendRequestsTable.receiverId, target.clerkId)),
      and(eq(friendRequestsTable.senderId, target.clerkId), eq(friendRequestsTable.receiverId, req.userId)),
    ))
    .orderBy(desc(friendRequestsTable.updatedAt));
  const conflict = friendRequestConflict(req.userId, target.clerkId, existing);
  if (conflict === "accepted") {
    res.status(409).json({ error: "You are already friends." });
    return;
  }
  if (conflict === "outgoing" || conflict === "incoming") {
    res.status(409).json({
      error: conflict === "outgoing"
        ? "Friend request already sent."
        : "This user has already sent you a friend request.",
    });
    return;
  }

  try {
    const [request] = await db.insert(friendRequestsTable).values({
      senderId: req.userId,
      receiverId: target.clerkId,
      status: "pending",
    }).returning();
    res.status(201).json(SendFriendRequestResponse.parse(friendRequestResponse(request, target, "outgoing")));
  } catch (error) {
    req.log.warn({ error }, "friend request creation conflict");
    res.status(409).json({ error: "Friend request could not be sent. Please refresh and try again." });
  }
});

// POST /users/friend-requests/:id/accept
router.post("/users/friend-requests/:id/accept", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = AcceptFriendRequestParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [request] = await db
    .update(friendRequestsTable)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(and(
      eq(friendRequestsTable.id, parsed.data.id),
      eq(friendRequestsTable.receiverId, req.userId),
      eq(friendRequestsTable.status, "pending"),
    ))
    .returning();
  if (!request) {
    res.status(404).json({ error: "Incoming friend request not found." });
    return;
  }
  const users = await friendUserMap([request.senderId]);
  const sender = users.get(request.senderId);
  if (!sender) {
    res.status(404).json({ error: "Request sender not found." });
    return;
  }
  res.json(AcceptFriendRequestResponse.parse(friendRequestResponse(request, sender, "friends")));
});

// POST /users/friend-requests/:id/decline
router.post("/users/friend-requests/:id/decline", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = DeclineFriendRequestParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const deleted = await db.delete(friendRequestsTable)
    .where(and(
      eq(friendRequestsTable.id, parsed.data.id),
      eq(friendRequestsTable.receiverId, req.userId),
      eq(friendRequestsTable.status, "pending"),
    ))
    .returning({ id: friendRequestsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Incoming friend request not found." });
    return;
  }
  res.sendStatus(204);
});

// DELETE /users/friend-requests/:id
router.delete("/users/friend-requests/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = CancelFriendRequestParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const deleted = await db.delete(friendRequestsTable)
    .where(and(
      eq(friendRequestsTable.id, parsed.data.id),
      eq(friendRequestsTable.senderId, req.userId),
      eq(friendRequestsTable.status, "pending"),
    ))
    .returning({ id: friendRequestsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Outgoing friend request not found." });
    return;
  }
  res.sendStatus(204);
});

// DELETE /users/:id/friend
router.delete("/users/:id/friend", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = UnfriendUserParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db.select({ clerkId: usersTable.clerkId }).from(usersTable)
    .where(eq(usersTable.id, parsed.data.id));
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const deleted = await db.delete(friendRequestsTable)
    .where(and(
      eq(friendRequestsTable.status, "accepted"),
      or(
        and(eq(friendRequestsTable.senderId, req.userId), eq(friendRequestsTable.receiverId, target.clerkId)),
        and(eq(friendRequestsTable.senderId, target.clerkId), eq(friendRequestsTable.receiverId, req.userId)),
      ),
    ))
    .returning({ id: friendRequestsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Friendship not found." });
    return;
  }
  res.sendStatus(204);
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
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 40);
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

  const [watched, ratings, history, saved] = await Promise.all([
    db.select().from(watchlistTable)
      .where(and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "watched")))
      .orderBy(desc(watchlistTable.addedAt)).limit(12),
    db.select().from(ratingsTable)
      .where(eq(ratingsTable.userId, req.userId))
      .orderBy(desc(ratingsTable.updatedAt)).limit(12),
    db.select().from(viewingHistoryTable)
      .where(eq(viewingHistoryTable.userId, req.userId))
      .orderBy(desc(viewingHistoryTable.viewedAt)).limit(12),
    db.select().from(watchlistTable)
      .where(and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "want_to_watch")))
      .limit(12),
  ]);

  const ratingByMovie = new Map(ratings.map((rating) => [rating.movieId, rating.score]));
  const seeds = [...new Map(
    [...ratings, ...history, ...watched]
      .map((item) => [item.movieId, item] as const),
  ).values()];

  if (!seeds.length) {
    const data = await tmdbGet("/trending/movie/week");
    res.json(((data?.results ?? []) as any[]).slice(0, limit).map(mapTmdb));
    return;
  }

  // Build a broad candidate pool, then rank it from explicit ratings and
  // recent viewing. This keeps recommendations useful without relying on
  // opaque engagement tricks or repeating one narrow genre forever.
  const seen = new Set([...seeds, ...saved].map((item) => item.movieId));
  const candidateMap = new Map<number, { movie: any; score: number; seedCount: number }>();
  const seedResults = await Promise.all(seeds.slice(0, 8).map(async (seed, index) => ({
    seed,
    index,
    data: await tmdbGet(`/movie/${seed.movieId}/recommendations`),
  })));

  for (const { seed, index, data } of seedResults) {
    if (!data) continue;
    const seedRating = ratingByMovie.get(seed.movieId);
    const preferenceWeight = seedRating ? (seedRating - 5.5) / 2.5 : 0.25;
    const recencyWeight = 1 - index / Math.max(seedResults.length, 1);
    for (const [position, movie] of (data.results ?? []).slice(0, 20).entries()) {
      if (seen.has(movie.id)) continue;
      const quality = Math.min(Number(movie.vote_average ?? 0) / 10, 1);
      const popularity = Math.min(Math.log10(Number(movie.popularity ?? 0) + 1) / 3, 1);
      const score = preferenceWeight * 4 + recencyWeight * 2.5
        + quality * 2 + popularity + (20 - position) / 20;
      const existing = candidateMap.get(movie.id);
      candidateMap.set(movie.id, {
        movie,
        score: (existing?.score ?? 0) + score,
        seedCount: (existing?.seedCount ?? 0) + 1,
      });
    }
  }

  const ranked = [...candidateMap.values()].sort((a, b) =>
    (b.score + b.seedCount * 0.75) - (a.score + a.seedCount * 0.75),
  );
  const selected: any[] = [];
  const genreCounts = new Map<number, number>();
  for (const candidate of ranked) {
    const genres = (candidate.movie.genre_ids ?? []) as number[];
    const alreadyHeavy = genres.some((genre) => (genreCounts.get(genre) ?? 0) >= 3);
    if (alreadyHeavy && selected.length < limit - 3) continue;
    selected.push(mapTmdb(candidate.movie));
    for (const genre of genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    if (selected.length >= limit) break;
  }

  // A partial provider response should still return a stable, useful contract.
  if (selected.length < limit) {
    const fallback = await tmdbGet("/trending/movie/week");
    for (const movie of (fallback?.results ?? [])) {
      if (!seen.has(movie.id) && !selected.some((item) => item.id === movie.id)) {
        selected.push(mapTmdb(movie));
      }
      if (selected.length >= limit) break;
    }
  }
  res.json(selected.slice(0, limit));
});

export default router;
