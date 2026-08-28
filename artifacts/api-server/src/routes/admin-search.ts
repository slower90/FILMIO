import { Router, type IRouter } from "express";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";
import { getSearchIndexStatus, reindexSearchIndex } from "../lib/meilisearch";

const router: IRouter = Router();

const adminClerkIds = (): Set<string> =>
  new Set(
    (process.env.FILMIO_ADMIN_CLERK_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

const requireSearchAdmin = (req: any, res: any, next: any): void => {
  const userId = (req as AuthedRequest).userId;
  if (!userId || !adminClerkIds().has(userId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};

// GET /admin/search-status — report the health of the Meilisearch catalog.
router.get(
  "/admin/search-status",
  requireAuth as any,
  requireSearchAdmin,
  async (_req, res): Promise<void> => {
    res.json(await getSearchIndexStatus());
  },
);

// POST /admin/reindex-search — replace the Meilisearch catalog from PostgreSQL.
router.post(
  "/admin/reindex-search",
  requireAuth as any,
  requireSearchAdmin,
  async (_req, res): Promise<void> => {
    try {
      const result = await reindexSearchIndex();
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(503).json({
        error: "Search reindex is temporarily unavailable",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
