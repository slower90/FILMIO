import { Router, type IRouter } from "express";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  ratingsTable,
  reviewsTable,
  signalsTable,
  type InsertSignal,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { resolveOptionalProfileId } from "./profiles";

const router: IRouter = Router();
const TMDB_BASE = "https://api.themoviedb.org/3";
const SIGNAL_LIMIT = 50;
const RECENT_RELEASE_WINDOW_DAYS = 45;

type CatalogResponse = {
  results?: Array<{
    id?: number;
    title?: string;
    poster_path?: string | null;
    release_date?: string;
  }>;
  credits?: {
    crew?: Array<{ id?: number; name?: string; job?: string }>;
  };
};

async function catalogFetch(path: string, params: Record<string, string | number> = {}): Promise<CatalogResponse | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7_000) });
    if (!response.ok) return null;
    return await response.json() as CatalogResponse;
  } catch {
    return null;
  }
}

function movieHref(movieId: number | null): string | null {
  return movieId ? `/movies/${movieId}` : null;
}

function profileScopeKey(profileId: number | null): string {
  return profileId === null ? "account" : `profile:${profileId}`;
}

async function favoriteDirectorRelease(rating: { movieId: number; score: number }) {
  if (rating.score < 8) return null;
  const details = await catalogFetch(`/movie/${rating.movieId}`, { append_to_response: "credits" });
  const director = details?.credits?.crew?.find((crew) => crew.job === "Director" && crew.id && crew.name);
  if (!director?.id || !director.name) return null;

  const today = new Date();
  const windowStart = new Date(today.getTime() - RECENT_RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const releases = await catalogFetch("/discover/movie", {
    with_crew: director.id,
    "primary_release_date.gte": windowStart.toISOString().slice(0, 10),
    "primary_release_date.lte": today.toISOString().slice(0, 10),
    sort_by: "primary_release_date.desc",
    page: 1,
  });
  const release = releases?.results?.find((movie) => movie.id && movie.id !== rating.movieId && movie.title);
  if (!release?.id || !release.title) return null;

  return {
    sourceKey: `director-release:${director.id}:${release.id}`,
    body: `Your favorite director ${director.name} has a new film.`,
    movieId: release.id,
    movieTitle: release.title,
    moviePosterPath: release.poster_path ?? null,
    href: movieHref(release.id),
  };
}

async function materializeSignals(userId: string, profileId: number | null): Promise<void> {
  const scope = profileScopeKey(profileId);
  const [reviews, ratings] = await Promise.all([
    db
      .select({
        id: reviewsTable.id,
        movieId: reviewsTable.movieId,
        movieTitle: reviewsTable.movieTitle,
        moviePosterPath: reviewsTable.moviePosterPath,
        likesCount: reviewsTable.likesCount,
        commentsCount: reviewsTable.commentsCount,
      })
      .from(reviewsTable)
      .where(and(
        eq(reviewsTable.userId, userId),
        or(gt(reviewsTable.likesCount, 0), gt(reviewsTable.commentsCount, 0)),
      ))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(5),
    db
      .select({
        movieId: ratingsTable.movieId,
        score: ratingsTable.score,
      })
      .from(ratingsTable)
      .where(and(
        eq(ratingsTable.userId, userId),
        ...(profileId === null ? [] : [eq(ratingsTable.profileId, profileId)]),
      ))
      .orderBy(desc(ratingsTable.score), desc(ratingsTable.updatedAt))
      .limit(24),
  ]);

  const candidates: InsertSignal[] = reviews.flatMap((review) => {
    const signals: InsertSignal[] = [];
    if (review.likesCount > 0) {
      signals.push({
        userId,
        profileId: null,
        kind: "review-agreement",
        sourceKey: `review-likes:${review.id}`,
        body: `${review.likesCount} ${review.likesCount === 1 ? "person agrees" : "people agree"} with your review.`,
        movieId: review.movieId,
        movieTitle: review.movieTitle,
        moviePosterPath: review.moviePosterPath,
        href: movieHref(review.movieId),
      });
    }
    if (review.commentsCount > 0) {
      signals.push({
        userId,
        profileId: null,
        kind: "review-conversation",
        sourceKey: `review-comments:${review.id}`,
        body: `Your review has a new conversation with ${review.commentsCount} ${review.commentsCount === 1 ? "comment" : "comments"}.`,
        movieId: review.movieId,
        movieTitle: review.movieTitle,
        moviePosterPath: review.moviePosterPath,
        href: movieHref(review.movieId),
      });
    }
    return signals;
  });

  if (ratings.length > 0) {
    const trending = await catalogFetch("/trending/movie/week", { page: 1 });
    const trendingIds = new Set((trending?.results ?? []).flatMap((movie) => movie.id ? [movie.id] : []));
    for (const rating of ratings.filter((item) => trendingIds.has(item.movieId)).slice(0, 3)) {
      const movie = trending?.results?.find((item) => item.id === rating.movieId);
      if (!movie?.id || !movie.title) continue;
      candidates.push({
        userId,
        profileId,
        kind: "rated-trending",
        sourceKey: `${scope}:rated-trending:${movie.id}`,
        body: `A movie you rated ${rating.score.toFixed(1)} is now trending globally.`,
        movieId: movie.id,
        movieTitle: movie.title,
        moviePosterPath: movie.poster_path ?? null,
        href: movieHref(movie.id),
      });
    }

    if (ratings.length >= 3) {
      candidates.push({
        userId,
        profileId,
        kind: "taste-graph",
        sourceKey: `${scope}:taste-graph`,
        body: "Your taste graph discovered a new connection.",
        movieId: null,
        movieTitle: null,
        moviePosterPath: null,
        href: "/profiles/graph",
      });
    }

    const directorRelease = await favoriteDirectorRelease(ratings[0]);
    if (directorRelease) {
      candidates.push({
        userId,
        profileId,
        kind: "director-release",
        ...directorRelease,
      });
    }
  }

  await Promise.all(candidates.map((signal) =>
    db
      .insert(signalsTable)
      .values(signal)
      .onConflictDoUpdate({
        target: [signalsTable.userId, signalsTable.sourceKey],
        set: {
          body: signal.body,
          movieId: signal.movieId,
          movieTitle: signal.movieTitle,
          moviePosterPath: signal.moviePosterPath,
          href: signal.href,
          updatedAt: new Date(),
        },
      }),
  ));
}

function responseSignal(signal: typeof signalsTable.$inferSelect) {
  return {
    id: signal.id,
    kind: signal.kind,
    label: "SIGNAL",
    body: signal.body,
    movieId: signal.movieId,
    movieTitle: signal.movieTitle,
    moviePosterPath: signal.moviePosterPath,
    href: signal.href,
    isRead: signal.isRead,
    createdAt: signal.createdAt.toISOString(),
  };
}

router.get("/signals", requireAuth as any, async (req: any, res): Promise<void> => {
  const scope = await resolveOptionalProfileId(req.userId, req.query.profileId);
  if (scope.provided && scope.id === null) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }
  const profileId = scope.id;

  await materializeSignals(req.userId, profileId);
  const conditions = [
    eq(signalsTable.userId, req.userId),
    profileId === null
      ? isNull(signalsTable.profileId)
      : or(isNull(signalsTable.profileId), eq(signalsTable.profileId, profileId)),
  ];
  if (String(req.query.unreadOnly) === "true") conditions.push(eq(signalsTable.isRead, false));

  const signals = await db
    .select()
    .from(signalsTable)
    .where(and(...conditions))
    .orderBy(desc(signalsTable.createdAt))
    .limit(SIGNAL_LIMIT);
  const unreadCount = signals.filter((signal) => !signal.isRead).length;
  res.json({ items: signals.map(responseSignal), unreadCount });
});

router.patch("/signals/:id/read", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "Signal id must be a positive integer." });
    return;
  }
  const [signal] = await db
    .update(signalsTable)
    .set({ isRead: true, updatedAt: new Date() })
    .where(and(eq(signalsTable.id, id), eq(signalsTable.userId, req.userId)))
    .returning();
  if (!signal) {
    res.status(404).json({ error: "Signal not found." });
    return;
  }
  res.json(responseSignal(signal));
});

router.post("/signals/read-all", requireAuth as any, async (req: any, res): Promise<void> => {
  await db
    .update(signalsTable)
    .set({ isRead: true, updatedAt: new Date() })
    .where(eq(signalsTable.userId, req.userId));
  res.status(204).send();
});

export default router;