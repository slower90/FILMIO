import { Router, type IRouter } from "express";
import { db, ratingsTable } from "@workspace/db";
import { and, avg, count, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { UpsertRatingBody } from "@workspace/api-zod";
import { syncSearchDocumentsForProviderId } from "../lib/meilisearch";

const router: IRouter = Router();

// POST /ratings — upsert
router.post("/ratings", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = UpsertRatingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { movieId, score } = parsed.data;

  const [existing] = await db
    .select()
    .from(ratingsTable)
    .where(and(eq(ratingsTable.userId, req.userId), eq(ratingsTable.movieId, movieId)));

  let rating;
  if (existing) {
    [rating] = await db
      .update(ratingsTable)
      .set({ score, updatedAt: new Date() })
      .where(eq(ratingsTable.id, existing.id))
      .returning();
  } else {
    [rating] = await db
      .insert(ratingsTable)
      .values({ userId: req.userId, movieId, score })
      .returning();
  }
  void syncSearchDocumentsForProviderId(movieId).catch((error) => {
    console.warn("[ratings] Meilisearch rating sync failed:", (error as Error).message);
  });
  res.json(rating);
});

// GET /ratings/movie/:movieId — aggregate
router.get("/ratings/movie/:movieId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const movieId = parseInt(raw, 10);

  const [stats] = await db
    .select({ average: avg(ratingsTable.score), total: count(ratingsTable.id) })
    .from(ratingsTable)
    .where(eq(ratingsTable.movieId, movieId));

  const average = stats.average ? parseFloat(String(stats.average)) : 0;
  const total = Number(stats.total);
  // Weighted score: Bayesian average with prior of 6.0 and weight of 10 ratings
  const m = 10;
  const C = 6.0;
  const weightedScore = total > 0 ? (total * average + m * C) / (total + m) : C;

  res.json({
    movieId,
    averageScore: average,
    totalRatings: total,
    weightedScore: parseFloat(weightedScore.toFixed(2)),
  });
});

// GET /ratings/my/:movieId
router.get("/ratings/my/:movieId", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const movieId = parseInt(raw, 10);

  const [rating] = await db
    .select()
    .from(ratingsTable)
    .where(and(eq(ratingsTable.userId, req.userId), eq(ratingsTable.movieId, movieId)));

  if (!rating) {
    res.status(404).json({ error: "Not rated" });
    return;
  }
  res.json(rating);
});

export default router;
