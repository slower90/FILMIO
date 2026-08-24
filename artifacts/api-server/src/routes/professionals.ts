import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, professionalsTable, usersTable, professionalWorkEntriesTable, professionalAuditionsTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  CreateProfessionalProfileBody,
  UpdateProfessionalProfileBody,
} from "@workspace/api-zod";
import { deletePrivateObject } from "../lib/objectStorage";

const router: IRouter = Router();
const SIDECAR = "http://127.0.0.1:1106";

export type AuditionFileAccessError = "unauthorized" | "forbidden" | null;

export function auditionFileAccessError(
  authUserId: string | null | undefined,
  ownerUserId: string,
  isPublic: boolean,
): AuditionFileAccessError {
  if (isPublic) return null;
  if (!authUserId) return "unauthorized";
  if (authUserId !== ownerUserId) return "forbidden";
  return null;
}

export function ownsProfessionalResource(
  authUserId: string,
  ownerUserId: string,
): boolean {
  return authUserId === ownerUserId;
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

router.get("/professionals/me/portfolio", requireAuth as any, async (req: any, res): Promise<void> => {
  const [prof] = await db.select({ id: professionalsTable.id }).from(professionalsTable).where(eq(professionalsTable.userId, req.userId));
  if (!prof) { res.status(404).json({ error: "Profile not found" }); return; }
  const [work, auditions] = await Promise.all([
    db.select().from(professionalWorkEntriesTable).where(eq(professionalWorkEntriesTable.professionalId, prof.id)),
    db.select().from(professionalAuditionsTable).where(eq(professionalAuditionsTable.professionalId, prof.id)),
  ]);
  res.json({ work, auditions });
});

router.post("/professionals/me/work", requireAuth as any, async (req: any, res): Promise<void> => {
  const [prof] = await db.select({ id: professionalsTable.id }).from(professionalsTable).where(eq(professionalsTable.userId, req.userId));
  if (!prof) { res.status(404).json({ error: "Create your professional profile first" }); return; }
  const { projectName, role, year, collaborators, description } = req.body || {};
  if (!String(projectName || "").trim() || !String(role || "").trim()) { res.status(400).json({ error: "Project name and role are required" }); return; }
  const [entry] = await db.insert(professionalWorkEntriesTable).values({
    professionalId: prof.id, projectName: String(projectName).trim(), role: String(role).trim(),
    year: year ? Number(year) : null, collaborators: Array.isArray(collaborators) ? collaborators.map(String).filter(Boolean) : [],
    description: description ? String(description).trim() : null,
  }).returning();
  res.status(201).json(entry);
});

router.patch("/professionals/me/work/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const [entry] = await db.select({ entry: professionalWorkEntriesTable }).from(professionalWorkEntriesTable)
    .innerJoin(professionalsTable, eq(professionalWorkEntriesTable.professionalId, professionalsTable.id))
    .where(and(eq(professionalWorkEntriesTable.id, id), eq(professionalsTable.userId, req.userId)));
  if (!entry) { res.status(404).json({ error: "Work entry not found" }); return; }
  const body = req.body || {};
  const projectName = body.projectName !== undefined ? String(body.projectName).trim() : entry.entry.projectName;
  const role = body.role !== undefined ? String(body.role).trim() : entry.entry.role;
  if (!projectName || !role) {
    res.status(400).json({ error: "Project name and role are required" });
    return;
  }
  const [updated] = await db.update(professionalWorkEntriesTable).set({
    projectName,
    role,
    year: body.year === undefined ? entry.entry.year : (body.year ? Number(body.year) : null),
    collaborators: Array.isArray(body.collaborators) ? body.collaborators.map(String).filter(Boolean) : entry.entry.collaborators,
    description: body.description === undefined ? entry.entry.description : (body.description ? String(body.description).trim() : null),
    updatedAt: new Date(),
  }).where(eq(professionalWorkEntriesTable.id, id)).returning();
  res.json(updated);
});

router.delete("/professionals/me/work/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const deleted = await db.delete(professionalWorkEntriesTable).where(and(
    eq(professionalWorkEntriesTable.id, id),
    sql`${professionalWorkEntriesTable.professionalId} IN (SELECT id FROM professionals WHERE user_id = ${req.userId})`,
  )).returning({ id: professionalWorkEntriesTable.id });
  if (!deleted.length) { res.status(404).json({ error: "Work entry not found" }); return; }
  res.status(204).end();
});

router.post("/professionals/me/auditions/request-upload", requireAuth as any, async (req: any, res): Promise<void> => {
  const { name, size, contentType } = req.body || {};
  const allowed = /^(video\/|audio\/|application\/pdf$|image\/)/.test(String(contentType || ""));
  if (!name || !size || !contentType || !allowed || Number(size) > 500 * 1024 * 1024) {
    res.status(400).json({ error: "Upload a video, audio, image, or PDF up to 500MB." }); return;
  }
  try {
    const objectName = `auditions/${req.userId}/${randomUUID()}`;
    const signed = await signedObjectUrl(objectName, "PUT");
    res.json({ ...signed, name, size: Number(size), contentType });
  } catch (error) {
    console.error("audition upload signing failed", error);
    res.status(500).json({ error: "Could not prepare the upload." });
  }
});

router.post("/professionals/me/auditions", requireAuth as any, async (req: any, res): Promise<void> => {
  const [prof] = await db.select({ id: professionalsTable.id }).from(professionalsTable).where(eq(professionalsTable.userId, req.userId));
  if (!prof) { res.status(404).json({ error: "Create your professional profile first" }); return; }
  const { title, description, objectPath, fileName, contentType, fileSize, isPublic } = req.body || {};
  if (!title || !objectPath || !fileName || !contentType || !fileSize || !String(objectPath).startsWith("/objects/auditions/")) {
    res.status(400).json({ error: "Complete audition upload details are required." }); return;
  }
  const [audition] = await db.insert(professionalAuditionsTable).values({
    professionalId: prof.id, title: String(title).trim(), description: description ? String(description).trim() : null,
    objectPath: String(objectPath), fileName: String(fileName), contentType: String(contentType),
    fileSize: Number(fileSize), isPublic: Boolean(isPublic),
  }).returning();
  res.status(201).json(audition);
});

router.patch("/professionals/me/auditions/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const [found] = await db.select({ audition: professionalAuditionsTable }).from(professionalAuditionsTable)
    .innerJoin(professionalsTable, eq(professionalAuditionsTable.professionalId, professionalsTable.id))
    .where(and(eq(professionalAuditionsTable.id, id), eq(professionalsTable.userId, req.userId)));
  if (!found) { res.status(404).json({ error: "Audition not found" }); return; }
  const [updated] = await db.update(professionalAuditionsTable).set({
    title: req.body?.title !== undefined ? String(req.body.title).trim() : found.audition.title,
    description: req.body?.description === undefined ? found.audition.description : (req.body.description ? String(req.body.description).trim() : null),
    isPublic: req.body?.isPublic === undefined ? found.audition.isPublic : Boolean(req.body.isPublic),
    updatedAt: new Date(),
  }).where(eq(professionalAuditionsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/professionals/me/auditions/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const deleted = await db.delete(professionalAuditionsTable).where(and(
    eq(professionalAuditionsTable.id, id),
    sql`${professionalAuditionsTable.professionalId} IN (SELECT id FROM professionals WHERE user_id = ${req.userId})`,
  )).returning({ id: professionalAuditionsTable.id, objectPath: professionalAuditionsTable.objectPath });
  if (!deleted.length) { res.status(404).json({ error: "Audition not found" }); return; }
  try {
    await deletePrivateObject(deleted[0].objectPath);
  } catch (error) {
    console.error("audition file cleanup failed", { objectPath: deleted[0].objectPath, error });
  }
  res.status(204).end();
});

router.get("/professionals/auditions/:id/file", async (req: any, res): Promise<void> => {
  const [audition] = await db.select({ audition: professionalAuditionsTable, userId: professionalsTable.userId })
    .from(professionalAuditionsTable).innerJoin(professionalsTable, eq(professionalAuditionsTable.professionalId, professionalsTable.id))
    .where(eq(professionalAuditionsTable.id, Number(req.params.id)));
  if (!audition) { res.status(404).json({ error: "Audition not found" }); return; }
  const authUser = (await import("@clerk/express")).getAuth(req).userId;
  const accessError = auditionFileAccessError(authUser, audition.userId, audition.audition.isPublic);
  if (accessError === "unauthorized") { res.status(401).json({ error: "Unauthorized" }); return; }
  if (accessError === "forbidden") { res.status(403).json({ error: "Private audition" }); return; }
  try {
    const signed = await signedObjectUrl(audition.audition.objectPath.replace("/objects/", ""), "GET");
    res.redirect(signed.url);
  } catch { res.status(404).json({ error: "Audition file unavailable" }); }
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
  const [work, auditions] = await Promise.all([
    db.select().from(professionalWorkEntriesTable).where(eq(professionalWorkEntriesTable.professionalId, prof.id)),
    db.select().from(professionalAuditionsTable).where(and(eq(professionalAuditionsTable.professionalId, prof.id), eq(professionalAuditionsTable.isPublic, true))),
  ]);
  res.json({ ...(await enrichProfile(prof)), workHistory: work, publicAuditions: auditions.map(({ objectPath: _objectPath, ...audition }) => audition) });
});

export default router;
