import { Router, type IRouter } from "express";
import { db, watchlistTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { AddToWatchlistBody, UpdateWatchlistEntryBody } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /watchlist
router.get("/watchlist", requireAuth as any, async (req: any, res): Promise<void> => {
  const items = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.userId, req.userId));
  res.json(items);
});

// POST /watchlist
router.post("/watchlist", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = AddToWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Upsert — update if already exists
  const [existing] = await db
    .select()
    .from(watchlistTable)
    .where(
      and(
        eq(watchlistTable.userId, req.userId),
        eq(watchlistTable.movieId, parsed.data.movieId),
      ),
    );

  if (existing) {
    const [updated] = await db
      .update(watchlistTable)
      .set({ status: parsed.data.status ?? "want_to_watch" })
      .where(eq(watchlistTable.id, existing.id))
      .returning();
    res.status(201).json(updated);
    return;
  }

  const [entry] = await db
    .insert(watchlistTable)
    .values({
      userId: req.userId,
      movieId: parsed.data.movieId,
      status: parsed.data.status ?? "want_to_watch",
      movieTitle: parsed.data.movieTitle ?? null,
      moviePosterPath: parsed.data.moviePosterPath ?? null,
      movieReleaseDate: parsed.data.movieReleaseDate ?? null,
    })
    .returning();
  res.status(201).json(entry);
});

// DELETE /watchlist/:movieId
router.delete("/watchlist/:movieId", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const movieId = parseInt(raw, 10);
  await db
    .delete(watchlistTable)
    .where(
      and(
        eq(watchlistTable.userId, req.userId),
        eq(watchlistTable.movieId, movieId),
      ),
    );
  res.sendStatus(204);
});

// PATCH /watchlist/:movieId
router.patch("/watchlist/:movieId", requireAuth as any, async (req: any, res): Promise<void> => {
  const raw = Array.isArray(req.params.movieId) ? req.params.movieId[0] : req.params.movieId;
  const movieId = parseInt(raw, 10);
  const parsed = UpdateWatchlistEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await db
    .update(watchlistTable)
    .set({ status: parsed.data.status })
    .where(
      and(
        eq(watchlistTable.userId, req.userId),
        eq(watchlistTable.movieId, movieId),
      ),
    )
    .returning();
  if (!entry) {
    res.status(404).json({ error: "Not in watchlist" });
    return;
  }
  res.json(entry);
});

export default router;
