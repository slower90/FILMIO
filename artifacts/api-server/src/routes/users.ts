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
  profileFavoritePeopleTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { resolveOptionalProfileId } from "./profiles";
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
  list: (userId: string, profileId?: number | null) => Promise<ViewingHistoryMovie[]>;
  merge: (userId: string, movies: ViewingHistoryMovie[], profileId?: number | null) => Promise<ViewingHistoryMovie[]>;
  clear: (userId: string, profileId?: number | null) => Promise<void>;
};

const databaseViewingHistoryRepository: ViewingHistoryRepository = {
  async list(userId, profileId = null) {
    const entries = await db
      .select()
      .from(viewingHistoryTable)
      .where(profileId === null
        ? eq(viewingHistoryTable.userId, userId)
        : and(eq(viewingHistoryTable.userId, userId), eq(viewingHistoryTable.profileId, profileId)))
      .orderBy(desc(viewingHistoryTable.viewedAt))
      .limit(12);
    return entries.map(mapViewingHistory);
  },
  async merge(userId, movies, profileId = null) {
    for (const movie of movies) {
      if (profileId === null) {
        const [existing] = await db
          .select({ id: viewingHistoryTable.id })
          .from(viewingHistoryTable)
          .where(and(eq(viewingHistoryTable.userId, userId), eq(viewingHistoryTable.movieId, movie.id)))
          .orderBy(asc(viewingHistoryTable.id))
          .limit(1);
        if (existing) {
          await db.update(viewingHistoryTable).set({
            movieTitle: movie.title,
            moviePosterPath: movie.posterPath ?? null,
            movieReleaseDate: movie.releaseDate ?? null,
            movieVoteAverage: movie.voteAverage ?? null,
            viewedAt: new Date(),
          }).where(eq(viewingHistoryTable.id, existing.id));
          continue;
        }
      }
      await db
        .insert(viewingHistoryTable)
        .values({
          userId,
          profileId,
          movieId: movie.id,
          movieTitle: movie.title,
          moviePosterPath: movie.posterPath ?? null,
          movieReleaseDate: movie.releaseDate ?? null,
          movieVoteAverage: movie.voteAverage ?? null,
          viewedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [viewingHistoryTable.userId, viewingHistoryTable.profileId, viewingHistoryTable.movieId],
          set: {
            movieTitle: movie.title,
            moviePosterPath: movie.posterPath ?? null,
            movieReleaseDate: movie.releaseDate ?? null,
            movieVoteAverage: movie.voteAverage ?? null,
            viewedAt: new Date(),
          },
        });
    }
    return databaseViewingHistoryRepository.list(userId, profileId);
  },
  async clear(userId, profileId = null) {
    await db.delete(viewingHistoryTable).where(profileId === null
      ? eq(viewingHistoryTable.userId, userId)
      : and(eq(viewingHistoryTable.userId, userId), eq(viewingHistoryTable.profileId, profileId)));
  },
};

// History is always scoped by the authenticated Clerk user; no user id is accepted
// from the client, which prevents one account from reading another's activity.
export function createViewingHistoryRouter(
  repository: ViewingHistoryRepository = databaseViewingHistoryRepository,
  authMiddleware: any = requireAuth,
  profileResolver: typeof resolveOptionalProfileId = resolveOptionalProfileId,
): IRouter {
  const historyRouter: IRouter = Router();
  historyRouter.get("/users/me/viewing-history", authMiddleware, async (req: any, res): Promise<void> => {
    const scope = await profileResolver(req.userId, req.query.profileId);
    if (scope.provided && scope.id === null) {
      res.status(404).json({ error: "Viewing profile not found." });
      return;
    }
    res.json(await repository.list(req.userId, scope.id));
  });
  historyRouter.post("/users/me/viewing-history", authMiddleware, async (req: any, res): Promise<void> => {
    const movies = parseViewingHistoryBody(req.body);
    if (!movies) {
      res.status(400).json({ error: "Invalid viewing history" });
      return;
    }
    const scope = await profileResolver(req.userId, req.query.profileId);
    if (scope.provided && scope.id === null) {
      res.status(404).json({ error: "Viewing profile not found." });
      return;
    }
    res.json(await repository.merge(req.userId, movies, scope.id));
  });
  historyRouter.delete("/users/me/viewing-history", authMiddleware, async (req: any, res): Promise<void> => {
    const scope = await profileResolver(req.userId, req.query.profileId);
    if (scope.provided && scope.id === null) {
      res.status(404).json({ error: "Viewing profile not found." });
      return;
    }
    await repository.clear(req.userId, scope.id);
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

  const mapTmdb = (m: any, recommendationReason?: string) => ({
    id: m.id, title: m.title ?? "", posterPath: m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null, overview: m.overview ?? "",
    releaseDate: m.release_date ?? "", voteAverage: m.vote_average ?? 0, genreIds: m.genre_ids ?? [],
    ...(recommendationReason ? { recommendationReason } : {}),
  });

  if (!req.userId) {
    // Not signed in: return trending
    const data = await tmdbGet("/trending/movie/week");
    res.json(((data?.results ?? []) as any[]).slice(0, limit).map((movie) => mapTmdb(movie)));
    return;
  }

  const scope = await resolveOptionalProfileId(req.userId, req.query.profileId);
  if (scope.provided && scope.id === null) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }
  const profileId = scope.id;
  const [watched, ratings, history, saved, favoritePeople] = await Promise.all([
    db.select().from(watchlistTable)
      .where(profileId === null
        ? and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "watched"))
        : and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.profileId, profileId), eq(watchlistTable.status, "watched")))
      .orderBy(desc(watchlistTable.addedAt)).limit(12),
    db.select().from(ratingsTable)
      .where(profileId === null
        ? eq(ratingsTable.userId, req.userId)
        : and(eq(ratingsTable.userId, req.userId), eq(ratingsTable.profileId, profileId)))
      .orderBy(desc(ratingsTable.updatedAt)).limit(12),
    db.select().from(viewingHistoryTable)
      .where(profileId === null
        ? eq(viewingHistoryTable.userId, req.userId)
        : and(eq(viewingHistoryTable.userId, req.userId), eq(viewingHistoryTable.profileId, profileId)))
      .orderBy(desc(viewingHistoryTable.viewedAt)).limit(12),
    db.select().from(watchlistTable)
      .where(profileId === null
        ? and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "want_to_watch"))
        : and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.profileId, profileId), eq(watchlistTable.status, "want_to_watch")))
      .limit(12),
    profileId === null
      ? Promise.resolve([])
      : db.select().from(profileFavoritePeopleTable)
        .where(eq(profileFavoritePeopleTable.profileId, profileId))
        .orderBy(asc(profileFavoritePeopleTable.position))
        .limit(16),
  ]);

  const ratingByMovie = new Map(ratings.map((rating) => [rating.movieId, rating.score]));
  const seeds = [...new Map(
    [...ratings, ...history, ...watched]
      .map((item) => [item.movieId, item] as const),
  ).values()];

  if (!seeds.length && !favoritePeople.length) {
    const data = await tmdbGet("/trending/movie/week");
    res.json(((data?.results ?? []) as any[]).slice(0, limit).map((movie) => mapTmdb(movie)));
    return;
  }

  // Build a broad candidate pool, then rank it from explicit ratings and
  // recent viewing. This keeps recommendations useful without relying on
  // opaque engagement tricks or repeating one narrow genre forever.
  const seen = new Set([...seeds, ...saved].map((item) => item.movieId));
  const candidateMap = new Map<number, { movie: any; score: number; seedCount: number; reason?: string }>();
  const favoriteResults = await Promise.all(
    favoritePeople.slice(0, 12).map(async (person) => ({
      person,
      data: await tmdbGet(`/person/${person.tmdbPersonId}/movie_credits`),
    })),
  );
  for (const { person, data } of favoriteResults) {
    const credits = person.kind === "director" ? (data?.crew ?? []) : (data?.cast ?? []);
    const reason = `Because you like ${person.name}`;
    for (const [position, movie] of (credits as any[])
      .filter((candidate) => candidate.poster_path && candidate.id)
      .sort((a, b) => Number(b.popularity ?? 0) - Number(a.popularity ?? 0))
      .slice(0, 18)
      .entries()) {
      if (seen.has(movie.id)) continue;
      const quality = Math.min(Number(movie.vote_average ?? 0) / 10, 1);
      const existing = candidateMap.get(movie.id);
      candidateMap.set(movie.id, {
        movie,
        score: (existing?.score ?? 0) + 7 + quality * 2 + (18 - position) / 18,
        seedCount: (existing?.seedCount ?? 0) + 1,
        reason: existing?.reason ?? reason,
      });
    }
  }
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
        reason: existing?.reason,
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
    selected.push(mapTmdb(candidate.movie, candidate.reason));
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

type SurpriseLens =
  | "tonight"
  | "15-minutes"
  | "90-minutes"
  | "3-hours"
  | "obscure"
  | "emotional"
  | "visually-insane"
  | "everyone-missed"
  | "india"
  | "outside-taste";

const SURPRISE_LENSES: Record<SurpriseLens, {
  label: string;
  targetRuntime?: number;
  maxRuntime?: number;
  minRuntime?: number;
  genres?: number[];
  originCountry?: string;
  sortBy: string;
  qualityFloor: number;
}> = {
  tonight: { label: "Tonight", targetRuntime: 120, maxRuntime: 150, sortBy: "popularity.desc", qualityFloor: 6.2 },
  "15-minutes": { label: "15 minutes", targetRuntime: 15, maxRuntime: 45, sortBy: "vote_average.desc", qualityFloor: 5.5 },
  "90-minutes": { label: "90 minutes", targetRuntime: 90, maxRuntime: 115, sortBy: "popularity.desc", qualityFloor: 6.2 },
  "3-hours": { label: "3 hours", targetRuntime: 180, minRuntime: 150, maxRuntime: 220, sortBy: "vote_average.desc", qualityFloor: 6.5 },
  obscure: { label: "Something obscure", sortBy: "popularity.asc", qualityFloor: 6.5 },
  emotional: { label: "Something emotional", genres: [18, 10749], sortBy: "vote_average.desc", qualityFloor: 6.8 },
  "visually-insane": { label: "Something visually insane", genres: [878, 14, 16, 12], sortBy: "vote_average.desc", qualityFloor: 6.6 },
  "everyone-missed": { label: "Something everyone missed", sortBy: "vote_average.desc", qualityFloor: 7.1 },
  india: { label: "Something from India", originCountry: "IN", sortBy: "popularity.desc", qualityFloor: 6.4 },
  "outside-taste": { label: "Something outside my taste", sortBy: "vote_average.desc", qualityFloor: 6.8 },
};

function parseSurpriseLens(value: unknown): SurpriseLens | null {
  const lens = String(value ?? "").trim() as SurpriseLens;
  return lens in SURPRISE_LENSES ? lens : null;
}

function mapSurpriseMovie(movie: any, details: any) {
  const genres = Array.isArray(details?.genres)
    ? details.genres
        .filter((genre: any) => Number.isInteger(Number(genre.id)) && typeof genre.name === "string")
        .map((genre: any) => ({ id: Number(genre.id), name: genre.name }))
    : [];
  return {
    id: Number(movie.id),
    title: String(details?.title ?? movie.title ?? ""),
    posterPath: details?.poster_path ?? movie.poster_path ?? null,
    backdropPath: details?.backdrop_path ?? movie.backdrop_path ?? null,
    overview: String(details?.overview ?? movie.overview ?? ""),
    releaseDate: String(details?.release_date ?? movie.release_date ?? ""),
    runtime: Number.isInteger(details?.runtime) ? details.runtime : null,
    genres,
    voteAverage: Number(details?.vote_average ?? movie.vote_average ?? 0),
  };
}

function stableSurpriseOffset(seed: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % length;
}

// GET /surprise-me?lens= — choose exactly one explainable film.
// This route deliberately returns one result rather than a scrollable list.
router.get("/surprise-me", optionalAuth as any, async (req: any, res): Promise<void> => {
  const lens = parseSurpriseLens(req.query.lens);
  if (!lens) {
    res.status(400).json({ error: "lens must be one of the supported Surprise Me lenses." });
    return;
  }

  const config = SURPRISE_LENSES[lens];
  const requestedProfile = req.userId
    ? await resolveOptionalProfileId(req.userId, req.query.profileId)
    : { provided: false, id: null };
  if (requestedProfile.provided && requestedProfile.id === null) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    res.status(503).json({ error: "Surprise Me is temporarily unavailable while the catalog reconnects." });
    return;
  }

  const tmdbGet = async (path: string, params: Record<string, string | number> = {}) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set("api_key", key);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    const response = await fetch(url.toString());
    return response.ok ? response.json() as Promise<any> : null;
  };

  const profileId = requestedProfile.id;
  const profileSignals: string[] = [];
  const [watched, saved, ratings, history] = req.userId
    ? await Promise.all([
        db.select({ movieId: watchlistTable.movieId }).from(watchlistTable).where(
          profileId === null
            ? and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "watched"))
            : and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.profileId, profileId), eq(watchlistTable.status, "watched")),
        ).limit(80),
        db.select({ movieId: watchlistTable.movieId }).from(watchlistTable).where(
          profileId === null
            ? and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.status, "want_to_watch"))
            : and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.profileId, profileId), eq(watchlistTable.status, "want_to_watch")),
        ).limit(80),
        db.select({ movieId: ratingsTable.movieId, score: ratingsTable.score }).from(ratingsTable).where(
          profileId === null
            ? eq(ratingsTable.userId, req.userId)
            : and(eq(ratingsTable.userId, req.userId), eq(ratingsTable.profileId, profileId)),
        ).orderBy(desc(ratingsTable.updatedAt)).limit(30),
        db.select({ movieId: viewingHistoryTable.movieId }).from(viewingHistoryTable).where(
          profileId === null
            ? eq(viewingHistoryTable.userId, req.userId)
            : and(eq(viewingHistoryTable.userId, req.userId), eq(viewingHistoryTable.profileId, profileId)),
        ).orderBy(desc(viewingHistoryTable.viewedAt)).limit(30),
      ])
    : [[], [], [], []];

  const excludedIds = new Set([
    ...watched.map((item: any) => item.movieId),
    ...saved.map((item: any) => item.movieId),
    ...ratings.map((item: any) => item.movieId),
    ...history.map((item: any) => item.movieId),
  ]);
  if (req.userId) {
    profileSignals.push("profile context");
    if (ratings.length) profileSignals.push("rating signals");
    if (history.length) profileSignals.push("recent viewing");
    if (saved.length || watched.length) profileSignals.push("watched and saved exclusions");
  }

  const positiveRatedIds = ratings
    .filter((rating: any) => Number(rating.score) >= 7)
    .map((rating: any) => Number(rating.movieId))
    .filter((id: number) => Number.isInteger(id) && id > 0)
    .slice(0, 5);
  const seedDetails = positiveRatedIds.length
    ? await Promise.all(positiveRatedIds.map((id) => tmdbGet(`/movie/${id}`)))
    : [];
  const preferredGenres = new Set<number>(
    seedDetails.flatMap((movie: any) =>
      Array.isArray(movie?.genres) ? movie.genres.map((genre: any) => Number(genre.id)).filter(Number.isInteger) : [],
    ),
  );

  const baseParams: Record<string, string | number> = {
    sort_by: config.sortBy,
    include_adult: "false",
    "vote_average.gte": config.qualityFloor,
    "vote_count.gte": lens === "obscure" || lens === "everyone-missed" ? 25 : 80,
  };
  if (config.genres?.length) baseParams.with_genres = config.genres.join("|");
  if (config.originCountry) {
    baseParams.with_origin_country = config.originCountry;
    baseParams.region = config.originCountry;
  }
  if (config.maxRuntime) baseParams["with_runtime.lte"] = config.maxRuntime;
  if (config.minRuntime) baseParams["with_runtime.gte"] = config.minRuntime;
  if (lens === "everyone-missed") {
    baseParams["vote_count.lte"] = 600;
    baseParams.sort_by = "vote_average.desc";
  }
  if (lens === "outside-taste" && preferredGenres.size) {
    baseParams.without_genres = [...preferredGenres].slice(0, 6).join("|");
    profileSignals.push("genre distance from your highly rated films");
  }
  if (lens === "outside-taste" && !preferredGenres.size) {
    profileSignals.push("a deliberate genre detour");
  }

  const discover = async (params: Record<string, string | number>) => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) => tmdbGet("/discover/movie", { ...params, page })),
    );
    return pages.flatMap((page: any) => page?.results ?? []);
  };

  let candidates = await discover(baseParams);
  const candidateById = new Map<number, any>();
  for (const candidate of candidates) {
    if (Number.isInteger(candidate?.id) && !excludedIds.has(candidate.id) && candidate.poster_path) {
      candidateById.set(candidate.id, candidate);
    }
  }

  // Profile-aware recommendations add a personal signal without ever reading
  // private message content. Discovery remains the fallback for new accounts.
  if (
    req.userId &&
    positiveRatedIds.length &&
    !config.originCountry &&
    !config.targetRuntime &&
    lens !== "outside-taste"
  ) {
    const recommendationSets = await Promise.all(
      positiveRatedIds.slice(0, 3).map((id) => tmdbGet(`/movie/${id}/recommendations`)),
    );
    for (const recommendationSet of recommendationSets) {
      for (const candidate of recommendationSet?.results ?? []) {
        if (Number.isInteger(candidate?.id) && !excludedIds.has(candidate.id) && candidate.poster_path) {
          candidateById.set(candidate.id, { ...candidate, _profileSignal: true });
        }
      }
    }
  }

  let candidateList = [...candidateById.values()];
  if (!candidateList.length) {
    // A narrow runtime or niche lens may be empty on the live provider. Relax
    // only the impossible constraint and label the result as a near match.
    const relaxed = { ...baseParams };
    delete relaxed["with_runtime.lte"];
    delete relaxed["with_runtime.gte"];
    candidates = await discover(relaxed);
    candidateList = candidates.filter((candidate: any) =>
      Number.isInteger(candidate?.id) && !excludedIds.has(candidate.id) && candidate.poster_path,
    );
  }

  if (!candidateList.length) {
    res.status(503).json({ error: "The live catalog could not find a safe Surprise Me pick right now." });
    return;
  }

  const avoidMovieId = Number(req.query.avoidMovieId);
  if (Number.isInteger(avoidMovieId) && avoidMovieId > 0) {
    const withoutAvoided = candidateList.filter((candidate) => candidate.id !== avoidMovieId);
    if (withoutAvoided.length) candidateList = withoutAvoided;
  }
  const seed = String(req.query.seed ?? `${lens}-${Date.now()}`);
  const offset = stableSurpriseOffset(seed, candidateList.length);
  candidateList = [...candidateList.slice(offset), ...candidateList.slice(0, offset)];

  const detailCandidates = await Promise.all(
    candidateList.slice(0, 18).map(async (candidate) => ({
      candidate,
      details: await tmdbGet(`/movie/${candidate.id}`),
    })),
  );
  const validDetails = detailCandidates.filter(({ details }) =>
    details && !details.adult && typeof details.title === "string" && details.poster_path,
  );
  if (!validDetails.length) {
    res.status(503).json({ error: "Surprise Me could not verify a film from the live catalog." });
    return;
  }

  const isRuntimeLens = Boolean(config.targetRuntime);
  const scored = validDetails
    .map(({ candidate, details }) => {
      const runtime = Number.isInteger(details.runtime) ? Number(details.runtime) : null;
      const runtimeDistance = runtime === null || !config.targetRuntime ? 0 : Math.abs(runtime - config.targetRuntime);
      const genreIds = Array.isArray(details.genres) ? details.genres.map((genre: any) => Number(genre.id)) : [];
      const profileSignal = candidate._profileSignal ? 1.2 : 0;
      const quality = Math.min(Number(details.vote_average ?? candidate.vote_average ?? 0) / 10, 1);
      const popularity = Math.min(Math.log10(Number(details.popularity ?? candidate.popularity ?? 0) + 1) / 3, 1);
      const tastePenalty = lens === "outside-taste" && preferredGenres.size && genreIds.some((id: number) => preferredGenres.has(id)) ? 1.5 : 0;
      const runtimeScore = config.targetRuntime ? Math.max(0, 2 - runtimeDistance / 45) : 0;
      return {
        candidate,
        details,
        score: quality * 4 + popularity + profileSignal + runtimeScore - tastePenalty,
        runtimeDistance,
      };
    })
    .sort((a, b) => {
      if (isRuntimeLens && a.runtimeDistance !== b.runtimeDistance) return a.runtimeDistance - b.runtimeDistance;
      return b.score - a.score;
    });
  const selected = scored[0];
  const pick = mapSurpriseMovie(selected.candidate, selected.details);
  const runtimeExact = config.targetRuntime && pick.runtime !== null
    ? Math.abs(pick.runtime - config.targetRuntime) <= (lens === "15-minutes" ? 10 : 20)
    : null;
  const runtimeMatch = !config.targetRuntime
    ? "not-applicable"
    : runtimeExact
      ? "exact"
      : "nearest-available";

  const explanationByLens: Record<SurpriseLens, string> = {
    tonight: `A strong ${pick.runtime ? `${pick.runtime}-minute` : "feature-length"} choice for tonight, with enough room to settle into its world.`,
    "15-minutes": runtimeMatch === "exact"
      ? `A compact ${pick.runtime}-minute watch that respects your short window.`
      : `No exact 15-minute film was available, so this is the closest verified short-window match in the live catalog.`,
    "90-minutes": runtimeMatch === "exact"
      ? `A focused ${pick.runtime}-minute story with a clean arc for a 90-minute window.`
      : `The live catalog had no exact 90-minute match, so this is the nearest verified fit.`,
    "3-hours": runtimeMatch === "exact"
      ? `A full-scale ${pick.runtime}-minute journey for a night with room to disappear.`
      : `A long-form film chosen as the nearest available match to a three-hour window.`,
    obscure: "High quality with deliberately lower catalog momentum — a path away from the obvious.",
    emotional: "A story led by human feeling, chosen from drama and romance signals.",
    "visually-insane": "A high-sensory pick from worlds built for the largest possible inner screen.",
    "everyone-missed": "A quality-first detour with a smaller vote footprint — no invented audience claims, just a bounded catalog signal.",
    india: "A film from India, chosen to open a different regional door in the catalog.",
    "outside-taste": "A quality floor held steady while your familiar genre signals were deliberately kept at a distance.",
  };

  const signals = [...profileSignals];
  if (config.targetRuntime) signals.push(`runtime target: ${config.label}`);
  if (config.qualityFloor) signals.push(`quality floor: ${config.qualityFloor.toFixed(1)}/10`);
  if (!signals.length) signals.push("live catalog quality and lens fit");
  if (lens === "obscure" || lens === "everyone-missed") signals.push("bounded popularity signal");

  res.json({
    lens,
    lensLabel: config.label,
    movie: pick,
    explanation: explanationByLens[lens],
    signals: [...new Set(signals)].slice(0, 6),
    personalized: Boolean(req.userId && (ratings.length || history.length || saved.length || watched.length)),
    runtimeMatch,
    requestedRuntime: config.targetRuntime ?? null,
    metadata: {
      source: "tmdb",
      stale: false,
      partial: false,
      fetchedAt: new Date().toISOString(),
    },
  });
});

export default router;
