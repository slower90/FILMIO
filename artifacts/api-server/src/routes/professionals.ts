import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  db,
  professionalsTable,
  usersTable,
  professionalWorkEntriesTable,
  professionalAuditionsTable,
  professionalProfileMediaTable,
  professionalPostsTable,
  professionalPostLikesTable,
  professionalPostCommentsTable,
} from "@workspace/db";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/auth";
import {
  CreateProfessionalProfileBody,
  UpdateProfessionalProfileBody,
} from "@workspace/api-zod";
import { deletePrivateObject } from "../lib/objectStorage";

const router: IRouter = Router();
const SIDECAR = "http://127.0.0.1:1106";
export const COMMUNITY_MAX_UPLOAD = 100 * 1024 * 1024;
export const PROFILE_MEDIA_MAX_UPLOAD = 100 * 1024 * 1024;

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

export function isCommunityMediaType(contentType: unknown): contentType is string {
  return typeof contentType === "string" && /^(image|video)\//.test(contentType);
}

export function isOwnedCommunityObjectPath(objectPath: unknown, userId: string): objectPath is string {
  return typeof objectPath === "string" && objectPath.startsWith(`/objects/professional-posts/${userId}/`) && !objectPath.includes("..");
}

export function isProfessionalProfileMediaType(contentType: unknown): contentType is string {
  return typeof contentType === "string" && /^(image|video)\//.test(contentType);
}

export function isOwnedProfessionalProfileObjectPath(objectPath: unknown, userId: string): objectPath is string {
  return typeof objectPath === "string"
    && objectPath.startsWith(`/objects/professional-profile-media/${userId}/`)
    && !objectPath.includes("..");
}

function profileMediaResponse(media: any, professionalId: number) {
  return {
    id: media.id,
    mediaType: media.mediaType,
    mediaUrl: `/api/professionals/${professionalId}/media/${media.id}/file`,
    fileName: media.fileName,
    contentType: media.contentType,
    fileSize: media.fileSize,
    createdAt: media.createdAt,
  };
}

function communityAuthor(professional: any, user?: { displayName: string | null; avatarUrl: string | null }) {
  return {
    id: professional.id,
    displayName: professional.displayName ?? user?.displayName ?? "FILMIO professional",
    headshotUrl: professional.headshotUrl ?? user?.avatarUrl ?? null,
    roles: professional.roles ?? [],
    verified: professional.verified,
  };
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
  const [work, auditions, media] = await Promise.all([
    db.select().from(professionalWorkEntriesTable).where(eq(professionalWorkEntriesTable.professionalId, prof.id)),
    db.select().from(professionalAuditionsTable).where(eq(professionalAuditionsTable.professionalId, prof.id)),
    db.select().from(professionalProfileMediaTable)
      .where(eq(professionalProfileMediaTable.professionalId, prof.id))
      .orderBy(desc(professionalProfileMediaTable.createdAt)),
  ]);
  res.json({ work, auditions, media: media.map((item) => profileMediaResponse(item, prof.id)) });
});

router.post("/professionals/me/media/request-upload", requireAuth as any, async (req: any, res): Promise<void> => {
  const [professional] = await db
    .select({ id: professionalsTable.id })
    .from(professionalsTable)
    .where(eq(professionalsTable.userId, req.userId));
  if (!professional) {
    res.status(404).json({ error: "Create your professional profile first." });
    return;
  }

  const { name, size, contentType } = req.body || {};
  const numericSize = Number(size);
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 240 ||
    !Number.isSafeInteger(numericSize) ||
    numericSize <= 0 ||
    numericSize > PROFILE_MEDIA_MAX_UPLOAD ||
    !isProfessionalProfileMediaType(contentType)
  ) {
    res.status(400).json({ error: "Upload an image or video up to 100MB." });
    return;
  }

  try {
    const objectName = `professional-profile-media/${req.userId}/${randomUUID()}`;
    const signed = await signedObjectUrl(objectName, "PUT");
    res.json({ uploadURL: signed.url, objectPath: signed.objectPath, name: name.trim(), size: numericSize, contentType });
  } catch (error) {
    req.log.error({ error }, "profile media upload signing failed");
    res.status(500).json({ error: "Could not prepare the upload." });
  }
});

router.delete("/professionals/me/media/upload", requireAuth as any, async (req: any, res): Promise<void> => {
  if (!isOwnedProfessionalProfileObjectPath(req.body?.objectPath, req.userId)) {
    res.status(400).json({ error: "Invalid profile media object path." });
    return;
  }
  try {
    await deletePrivateObject(req.body.objectPath);
    res.status(204).end();
  } catch (error) {
    req.log.warn({ error }, "profile media upload cleanup failed");
    res.status(404).json({ error: "Uploaded object could not be removed." });
  }
});

router.post("/professionals/me/media", requireAuth as any, async (req: any, res): Promise<void> => {
  const [professional] = await db
    .select({ id: professionalsTable.id })
    .from(professionalsTable)
    .where(eq(professionalsTable.userId, req.userId));
  if (!professional) {
    res.status(404).json({ error: "Create your professional profile first." });
    return;
  }

  const { objectPath, fileName, contentType, fileSize } = req.body || {};
  const numericFileSize = Number(fileSize);
  if (
    !isOwnedProfessionalProfileObjectPath(objectPath, req.userId) ||
    typeof fileName !== "string" ||
    !fileName.trim() ||
    fileName.length > 240 ||
    !isProfessionalProfileMediaType(contentType) ||
    !Number.isSafeInteger(numericFileSize) ||
    numericFileSize <= 0 ||
    numericFileSize > PROFILE_MEDIA_MAX_UPLOAD
  ) {
    res.status(400).json({ error: "Complete image/video upload details are required." });
    return;
  }

  const mediaType = contentType.startsWith("image/") ? "photo" : "video";
  try {
    const [media] = await db.insert(professionalProfileMediaTable).values({
      professionalId: professional.id,
      mediaType,
      objectPath,
      fileName: fileName.trim(),
      contentType,
      fileSize: numericFileSize,
    }).returning();
    res.status(201).json(profileMediaResponse(media, professional.id));
  } catch (error) {
    await deletePrivateObject(objectPath).catch((cleanupError) => {
      req.log.warn({ cleanupError }, "failed to clean up unpublished profile media");
    });
    req.log.error({ error }, "profile media creation failed");
    res.status(500).json({ error: "Could not save this media." });
  }
});

router.delete("/professionals/me/media/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    res.status(400).json({ error: "Invalid media id." });
    return;
  }
  const deleted = await db.delete(professionalProfileMediaTable).where(and(
    eq(professionalProfileMediaTable.id, id),
    sql`${professionalProfileMediaTable.professionalId} IN (SELECT id FROM professionals WHERE user_id = ${req.userId})`,
  )).returning({ id: professionalProfileMediaTable.id, objectPath: professionalProfileMediaTable.objectPath });
  if (!deleted.length) {
    res.status(404).json({ error: "Profile media not found." });
    return;
  }
  try {
    await deletePrivateObject(deleted[0].objectPath);
  } catch (error) {
    req.log.warn({ error, mediaId: id }, "profile media cleanup failed");
  }
  res.status(204).end();
});

router.get("/professionals/:id/media/:mediaId/file", async (req: any, res): Promise<void> => {
  const professionalId = Number(req.params.id);
  const mediaId = Number(req.params.mediaId);
  if (!Number.isSafeInteger(professionalId) || !Number.isSafeInteger(mediaId)) {
    res.status(400).json({ error: "Invalid media reference." });
    return;
  }
  const [media] = await db.select({ item: professionalProfileMediaTable })
    .from(professionalProfileMediaTable)
    .where(and(
      eq(professionalProfileMediaTable.id, mediaId),
      eq(professionalProfileMediaTable.professionalId, professionalId),
    ));
  if (!media) {
    res.status(404).json({ error: "Profile media not found." });
    return;
  }
  try {
    const signed = await signedObjectUrl(media.item.objectPath.replace("/objects/", ""), "GET");
    res.redirect(signed.url);
  } catch (error) {
    req.log.warn({ error, mediaId }, "profile media unavailable");
    res.status(404).json({ error: "Profile media unavailable." });
  }
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

// GET /professionals/community/feed
router.get("/professionals/community/feed", async (req: any, res): Promise<void> => {
  const requestedPage = Number(req.query.page);
  const requestedLimit = Number(req.query.limit);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 40) : 20;
  const offset = (page - 1) * limit;
  const authUserId = getAuth(req).userId;

  const rows = await db
    .select({
      post: professionalPostsTable,
      professional: professionalsTable,
      user: { displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl },
    })
    .from(professionalPostsTable)
    .innerJoin(professionalsTable, eq(professionalPostsTable.professionalId, professionalsTable.id))
    .leftJoin(usersTable, eq(professionalsTable.userId, usersTable.clerkId))
    .orderBy(desc(professionalPostsTable.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const visibleRows = rows.slice(0, limit);
  const postIds = visibleRows.map(({ post }) => post.id);
  const [likeRows, commentRows, viewerLikeRows] = await Promise.all([
    postIds.length
      ? db.select({ postId: professionalPostLikesTable.postId, count: sql<number>`count(*)` })
        .from(professionalPostLikesTable)
        .where(inArray(professionalPostLikesTable.postId, postIds))
        .groupBy(professionalPostLikesTable.postId)
      : Promise.resolve([]),
    postIds.length
      ? db.select({ postId: professionalPostCommentsTable.postId, count: sql<number>`count(*)` })
        .from(professionalPostCommentsTable)
        .where(inArray(professionalPostCommentsTable.postId, postIds))
        .groupBy(professionalPostCommentsTable.postId)
      : Promise.resolve([]),
    authUserId && postIds.length
      ? db.select({ postId: professionalPostLikesTable.postId })
        .from(professionalPostLikesTable)
        .where(and(eq(professionalPostLikesTable.userId, authUserId), inArray(professionalPostLikesTable.postId, postIds)))
      : Promise.resolve([]),
  ]);

  const likesByPost = new Map(likeRows.map((row) => [row.postId, Number(row.count)]));
  const commentsByPost = new Map(commentRows.map((row) => [row.postId, Number(row.count)]));
  const likedPostIds = new Set(viewerLikeRows.map((row) => row.postId));

  res.json({
    posts: visibleRows.map(({ post, professional, user }) => ({
      id: post.id,
      caption: post.caption,
      mediaUrl: post.objectPath ? `/api/professionals/community/posts/${post.id}/media` : null,
      mediaType: post.contentType,
      createdAt: post.createdAt,
      likeCount: likesByPost.get(post.id) ?? 0,
      commentCount: commentsByPost.get(post.id) ?? 0,
      viewerLiked: likedPostIds.has(post.id),
      author: communityAuthor(professional, user ?? undefined),
    })),
    page,
    limit,
    hasMore: rows.length > limit,
  });
});

// POST /professionals/community/posts/request-upload
router.post("/professionals/community/posts/request-upload", requireAuth as any, async (req: any, res): Promise<void> => {
  const [professional] = await db
    .select({ id: professionalsTable.id })
    .from(professionalsTable)
    .where(eq(professionalsTable.userId, req.userId));
  if (!professional) {
    res.status(403).json({ error: "Create your professional profile before sharing work." });
    return;
  }

  const { name, size, contentType } = req.body || {};
  const numericSize = Number(size);
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 240 ||
    !Number.isSafeInteger(numericSize) ||
    numericSize <= 0 ||
    numericSize > COMMUNITY_MAX_UPLOAD ||
    !isCommunityMediaType(contentType)
  ) {
    res.status(400).json({ error: "Upload an image or video up to 100MB." });
    return;
  }

  try {
    const objectName = `professional-posts/${req.userId}/${randomUUID()}`;
    const signed = await signedObjectUrl(objectName, "PUT");
    res.json({ uploadURL: signed.url, objectPath: signed.objectPath, name: name.trim(), size: numericSize, contentType });
  } catch (error) {
    req.log.error({ error }, "community upload signing failed");
    res.status(500).json({ error: "Could not prepare the upload." });
  }
});

// DELETE /professionals/community/uploads — clean up an upload that was not published
router.delete("/professionals/community/uploads", requireAuth as any, async (req: any, res): Promise<void> => {
  if (!isOwnedCommunityObjectPath(req.body?.objectPath, req.userId)) {
    res.status(400).json({ error: "Invalid community object path." });
    return;
  }
  try {
    await deletePrivateObject(req.body.objectPath);
    res.status(204).end();
  } catch (error) {
    req.log.warn({ error }, "community upload cleanup failed");
    res.status(404).json({ error: "Uploaded object could not be removed." });
  }
});

// POST /professionals/community/posts
router.post("/professionals/community/posts", requireAuth as any, async (req: any, res): Promise<void> => {
  const [professional] = await db
    .select({ id: professionalsTable.id })
    .from(professionalsTable)
    .where(eq(professionalsTable.userId, req.userId));
  if (!professional) {
    res.status(403).json({ error: "Create your professional profile before sharing work." });
    return;
  }

  const body = req.body || {};
  if (body.caption != null && typeof body.caption !== "string") {
    res.status(400).json({ error: "Caption must be text." });
    return;
  }
  const caption = String(body.caption ?? "").trim();
  if (caption.length > 2000) {
    res.status(400).json({ error: "Keep your caption under 2,000 characters." });
    return;
  }

  const hasMedia = body.objectPath != null;
  const numericFileSize = Number(body.fileSize);
  if (!caption && !hasMedia) {
    res.status(400).json({ error: "Add a caption or an image/video." });
    return;
  }
  if (hasMedia && (
    !isOwnedCommunityObjectPath(body.objectPath, req.userId) ||
    typeof body.fileName !== "string" ||
    !body.fileName.trim() ||
    body.fileName.length > 240 ||
    !isCommunityMediaType(body.contentType) ||
    !Number.isSafeInteger(numericFileSize) ||
    numericFileSize <= 0 ||
    numericFileSize > COMMUNITY_MAX_UPLOAD
  )) {
    res.status(400).json({ error: "Complete image/video upload details are required." });
    return;
  }

  let post;
  try {
    [post] = await db.insert(professionalPostsTable).values({
      professionalId: professional.id,
      caption,
      objectPath: hasMedia ? body.objectPath : null,
      fileName: hasMedia ? body.fileName.trim() : null,
      contentType: hasMedia ? body.contentType : null,
      fileSize: hasMedia ? numericFileSize : null,
    }).returning();
  } catch (error) {
    if (hasMedia) {
      await deletePrivateObject(body.objectPath).catch((cleanupError) => {
        req.log.warn({ cleanupError }, "failed to clean up unpublished community object");
      });
    }
    req.log.error({ error }, "community post creation failed");
    res.status(500).json({ error: "Could not publish this post." });
    return;
  }

  res.status(201).json({
    id: post.id,
    caption: post.caption,
    mediaUrl: post.objectPath ? `/api/professionals/community/posts/${post.id}/media` : null,
    mediaType: post.contentType,
    createdAt: post.createdAt,
    likeCount: 0,
    commentCount: 0,
    viewerLiked: false,
  });
});

// GET /professionals/community/posts/:id/media
router.get("/professionals/community/posts/:id/media", async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) {
    res.status(400).json({ error: "Invalid post id." });
    return;
  }
  const [post] = await db.select({ objectPath: professionalPostsTable.objectPath })
    .from(professionalPostsTable)
    .where(eq(professionalPostsTable.id, id));
  if (!post?.objectPath) {
    res.status(404).json({ error: "Media not found." });
    return;
  }
  try {
    const signed = await signedObjectUrl(post.objectPath.replace("/objects/", ""), "GET");
    res.redirect(signed.url);
  } catch (error) {
    req.log.warn({ error, postId: id }, "community media unavailable");
    res.status(404).json({ error: "Media unavailable." });
  }
});

// DELETE /professionals/community/posts/:id
router.delete("/professionals/community/posts/:id", requireAuth as any, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  const [found] = await db
    .select({ post: professionalPostsTable })
    .from(professionalPostsTable)
    .innerJoin(professionalsTable, eq(professionalPostsTable.professionalId, professionalsTable.id))
    .where(and(eq(professionalPostsTable.id, id), eq(professionalsTable.userId, req.userId)));
  if (!found) {
    res.status(404).json({ error: "Post not found." });
    return;
  }

  const [deleted] = await db.delete(professionalPostsTable)
    .where(eq(professionalPostsTable.id, id))
    .returning({ id: professionalPostsTable.id, objectPath: professionalPostsTable.objectPath });
  if (deleted?.objectPath) {
    await deletePrivateObject(deleted.objectPath).catch((error) => {
      req.log.warn({ error, postId: id }, "community post media cleanup failed");
    });
  }
  res.status(204).end();
});

// POST /professionals/community/posts/:id/like
router.post("/professionals/community/posts/:id/like", requireAuth as any, async (req: any, res): Promise<void> => {
  const postId = Number(req.params.id);
  if (!Number.isSafeInteger(postId)) {
    res.status(400).json({ error: "Invalid post id." });
    return;
  }
  const [post] = await db.select({ id: professionalPostsTable.id }).from(professionalPostsTable).where(eq(professionalPostsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  const [existing] = await db.select({ id: professionalPostLikesTable.id })
    .from(professionalPostLikesTable)
    .where(and(eq(professionalPostLikesTable.postId, postId), eq(professionalPostLikesTable.userId, req.userId)));
  let liked = false;
  if (existing) {
    await db.delete(professionalPostLikesTable).where(eq(professionalPostLikesTable.id, existing.id));
  } else {
    await db.insert(professionalPostLikesTable).values({ postId, userId: req.userId }).onConflictDoNothing();
    liked = true;
  }
  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(professionalPostLikesTable)
    .where(eq(professionalPostLikesTable.postId, postId));
  res.json({ liked, likeCount: Number(count) });
});

// GET /professionals/community/posts/:id/comments
router.get("/professionals/community/posts/:id/comments", async (req: any, res): Promise<void> => {
  const postId = Number(req.params.id);
  const [post] = await db.select({ id: professionalPostsTable.id }).from(professionalPostsTable).where(eq(professionalPostsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  const rows = await db.select({
    comment: professionalPostCommentsTable,
    user: { clerkId: usersTable.clerkId, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl },
  })
    .from(professionalPostCommentsTable)
    .leftJoin(usersTable, eq(professionalPostCommentsTable.userId, usersTable.clerkId))
    .where(eq(professionalPostCommentsTable.postId, postId))
    .orderBy(professionalPostCommentsTable.createdAt);
  res.json({
    comments: rows.map(({ comment, user }) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: {
        id: user?.clerkId ?? comment.userId,
        displayName: user?.displayName ?? "FILMIO member",
        headshotUrl: user?.avatarUrl ?? null,
      },
    })),
  });
});

// POST /professionals/community/posts/:id/comments
router.post("/professionals/community/posts/:id/comments", requireAuth as any, async (req: any, res): Promise<void> => {
  const postId = Number(req.params.id);
  const content = req.body?.content;
  if (!Number.isSafeInteger(postId) || typeof content !== "string" || !content.trim() || content.trim().length > 1000) {
    res.status(400).json({ error: "Write a note between 1 and 1,000 characters." });
    return;
  }
  const [post] = await db.select({ id: professionalPostsTable.id }).from(professionalPostsTable).where(eq(professionalPostsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  const [comment] = await db.insert(professionalPostCommentsTable)
    .values({ postId, userId: req.userId, content: content.trim() })
    .returning();
  const [user] = await db.select({ displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.userId));
  res.status(201).json({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: { id: req.userId, displayName: user?.displayName ?? "FILMIO member", headshotUrl: user?.avatarUrl ?? null },
  });
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
  const media = await db.select().from(professionalProfileMediaTable)
    .where(eq(professionalProfileMediaTable.professionalId, prof.id))
    .orderBy(desc(professionalProfileMediaTable.createdAt));
  res.json({
    ...(await enrichProfile(prof)),
    workHistory: work,
    publicAuditions: auditions.map(({ objectPath: _objectPath, ...audition }) => audition),
    media: media.map((item) => profileMediaResponse(item, prof.id)),
  });
});

export default router;
