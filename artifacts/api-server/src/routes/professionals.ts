import { Router, type IRouter } from "express";
import { db, professionalsTable, usersTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  CreateProfessionalProfileBody,
  UpdateProfessionalProfileBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const enrichProfile = async (prof: any) => {
  const [user] = await db
    .select({ displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.clerkId, prof.userId));
  return { ...prof, displayName: prof.displayName ?? user?.displayName ?? null };
};

// GET /professionals/me
router.get("/professionals/me", requireAuth as any, async (req: any, res): Promise<void> => {
  const [prof] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.userId, req.userId));
  if (!prof) {
    res.status(404).json({ error: "Professional profile not set up" });
    return;
  }
  res.json(await enrichProfile(prof));
});

// POST /professionals/me
router.post("/professionals/me", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = CreateProfessionalProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.userId, req.userId));
  if (existing) {
    res.status(409).json({ error: "Profile already exists. Use PATCH to update." });
    return;
  }

  const [prof] = await db
    .insert(professionalsTable)
    .values({ userId: req.userId, ...parsed.data })
    .returning();

  // Mark user as professional
  await db
    .update(usersTable)
    .set({ isProfessional: true })
    .where(eq(usersTable.clerkId, req.userId));

  res.status(201).json(await enrichProfile(prof));
});

// PATCH /professionals/me
router.patch("/professionals/me", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = UpdateProfessionalProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prof] = await db
    .update(professionalsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(professionalsTable.userId, req.userId))
    .returning();
  if (!prof) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(await enrichProfile(prof));
});

// GET /professionals/search — must be before /:id
router.get("/professionals/search", async (req, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  const role = req.query.role as string | undefined;

  let query = db.select().from(professionalsTable).$dynamic();

  if (q) {
    query = query.where(
      or(
        ilike(professionalsTable.displayName, `%${q}%`),
        ilike(professionalsTable.bio, `%${q}%`),
        sql`${professionalsTable.roles}::text ilike ${'%' + q + '%'}`,
      ),
    );
  }
  if (role) {
    query = query.where(sql`${professionalsTable.roles} @> ARRAY[${role}]::text[]`);
  }

  const results = await query.limit(20);
  const enriched = await Promise.all(results.map(enrichProfile));
  res.json(enriched);
});

// GET /professionals/:id
router.get("/professionals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [prof] = await db
    .select()
    .from(professionalsTable)
    .where(eq(professionalsTable.id, id));
  if (!prof) {
    res.status(404).json({ error: "Professional not found" });
    return;
  }
  res.json(await enrichProfile(prof));
});

export default router;
