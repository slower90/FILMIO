import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";
import { db, userProfilesTable, usersTable, watchlistTable, viewingHistoryTable, ratingsTable } from "@workspace/db";
import {
  CreateProfileBody,
  RequestProfileAvatarUploadBody,
  UpdateProfileBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { deletePrivateObject, signPrivateObjectUrl } from "../lib/objectStorage";

const router: IRouter = Router();
const PROFILE_LIMIT = 5;
const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_AVATAR_PATH = /^\/objects\/profile-avatars\/[^/]+\/[^/]+$/;

export const CURATED_PROFILE_AVATARS = {
  orbit: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=orbit",
  nova: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=nova",
  ember: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=ember",
  cine: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=cine",
  prism: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=prism",
  lunar: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=lunar",
} as const;

type CuratedAvatarKey = keyof typeof CURATED_PROFILE_AVATARS;

function profileIdFromRequest(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isOwnedProfileAvatarPath(value: unknown, userId: string): value is string {
  return typeof value === "string" &&
    PROFILE_AVATAR_PATH.test(value) &&
    value.startsWith(`/objects/profile-avatars/${userId}/`) &&
    !value.includes("..");
}

function profileResponse(profile: typeof userProfilesTable.$inferSelect) {
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    avatarKey: profile.avatarKey as CuratedAvatarKey,
    avatarUrl: profile.avatarObjectPath ? `/api/profiles/${profile.id}/avatar` : CURATED_PROFILE_AVATARS[profile.avatarKey as CuratedAvatarKey] ?? CURATED_PROFILE_AVATARS.orbit,
    kidsMode: profile.kidsMode,
    language: profile.language,
    maturity: profile.maturity === "all" ? "all" : Number(profile.maturity),
    autoplay: profile.autoplay,
    favoriteActor: profile.favoriteActor,
    favoriteDirector: profile.favoriteDirector,
    favoriteGenre: profile.favoriteGenre,
    favoriteCountry: profile.favoriteCountry,
    favoriteDecade: profile.favoriteDecade,
    favoriteLanguage: profile.favoriteLanguage,
    isDefault: profile.isDefault,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

async function ensureDefaultProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(userProfilesTable)
    .where(and(eq(userProfilesTable.userId, userId), eq(userProfilesTable.isDefault, true)))
    .limit(1);
  if (existing) return existing;

  const [user] = await db
    .select({ displayName: usersTable.displayName, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.clerkId, userId))
    .limit(1);
  const defaultName = user?.displayName?.trim() || user?.username?.trim() || "You";
  await db.insert(userProfilesTable).values({
    userId,
    name: defaultName.slice(0, 40),
    avatarKey: "orbit",
    isDefault: true,
  }).onConflictDoNothing();

  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(and(eq(userProfilesTable.userId, userId), eq(userProfilesTable.isDefault, true)))
    .limit(1);
  if (!profile) throw new Error("Unable to create a default viewing profile");
  return profile;
}

export async function ownedProfile(userId: string, value: unknown) {
  const id = profileIdFromRequest(value);
  if (!id) return null;
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(and(eq(userProfilesTable.id, id), eq(userProfilesTable.userId, userId)));
  return profile ?? null;
}

export async function resolveOptionalProfileId(userId: string, value: unknown): Promise<{
  provided: boolean;
  id: number | null;
}> {
  const provided = value !== undefined && value !== null && value !== "";
  if (!provided) return { provided: false, id: null };
  const profile = await ownedProfile(userId, value);
  return { provided: true, id: profile?.id ?? null };
}

router.get("/profiles", requireAuth as any, async (req: any, res): Promise<void> => {
  await ensureDefaultProfile(req.userId);
  const profiles = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId))
    .orderBy(asc(userProfilesTable.isDefault), asc(userProfilesTable.createdAt));
  res.json(profiles.map(profileResponse));
});

router.post("/profiles", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureDefaultProfile(req.userId);
  const [{ total }] = await db
    .select({ total: count() })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, req.userId));
  if (Number(total) >= PROFILE_LIMIT) {
    res.status(409).json({ error: `You can create up to ${PROFILE_LIMIT} viewing profiles.` });
    return;
  }

  const body = parsed.data;
  if (body.avatarObjectPath && !isOwnedProfileAvatarPath(body.avatarObjectPath, req.userId)) {
    res.status(400).json({ error: "That avatar upload is not owned by this account." });
    return;
  }
  const [profile] = await db.insert(userProfilesTable).values({
    userId: req.userId,
    name: body.name.trim(),
    avatarKey: body.avatarKey ?? "orbit",
    avatarObjectPath: body.avatarObjectPath ?? null,
    kidsMode: body.kidsMode ?? false,
    language: body.language ?? "en",
    maturity: body.maturity === "all" || body.maturity == null ? "all" : String(body.maturity),
    autoplay: body.autoplay ?? true,
    favoriteActor: body.favoriteActor?.trim() || null,
    favoriteDirector: body.favoriteDirector?.trim() || null,
    favoriteGenre: body.favoriteGenre?.trim() || null,
    favoriteCountry: body.favoriteCountry?.trim() || null,
    favoriteDecade: body.favoriteDecade?.trim() || null,
    favoriteLanguage: body.favoriteLanguage?.trim() || null,
    isDefault: false,
  }).returning();
  res.status(201).json(profileResponse(profile));
});

router.patch("/profiles/:profileId", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await ownedProfile(req.userId, req.params.profileId);
  if (!profile) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }
  const body = parsed.data;
  if (body.avatarObjectPath && !isOwnedProfileAvatarPath(body.avatarObjectPath, req.userId)) {
    res.status(400).json({ error: "That avatar upload is not owned by this account." });
    return;
  }
  if (body.avatarKey && body.avatarObjectPath === undefined) {
    // Choosing a curated avatar intentionally clears an older private upload.
    if (profile.avatarObjectPath) {
      await deletePrivateObject(profile.avatarObjectPath, { ignoreNotFound: true }).catch(() => undefined);
    }
  }
  const [updated] = await db.update(userProfilesTable).set({
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.avatarKey !== undefined ? { avatarKey: body.avatarKey } : {}),
     ...(body.avatarKey !== undefined && body.avatarObjectPath === undefined
       ? { avatarObjectPath: null }
       : body.avatarObjectPath !== undefined
         ? { avatarObjectPath: body.avatarObjectPath }
         : {}),
    ...(body.kidsMode !== undefined ? { kidsMode: body.kidsMode } : {}),
    ...(body.language !== undefined ? { language: body.language } : {}),
    ...(body.maturity !== undefined ? { maturity: body.maturity === "all" ? "all" : String(body.maturity) } : {}),
    ...(body.autoplay !== undefined ? { autoplay: body.autoplay } : {}),
    ...(body.favoriteActor !== undefined ? { favoriteActor: body.favoriteActor?.trim() || null } : {}),
    ...(body.favoriteDirector !== undefined ? { favoriteDirector: body.favoriteDirector?.trim() || null } : {}),
    ...(body.favoriteGenre !== undefined ? { favoriteGenre: body.favoriteGenre?.trim() || null } : {}),
    ...(body.favoriteCountry !== undefined ? { favoriteCountry: body.favoriteCountry?.trim() || null } : {}),
    ...(body.favoriteDecade !== undefined ? { favoriteDecade: body.favoriteDecade?.trim() || null } : {}),
    ...(body.favoriteLanguage !== undefined ? { favoriteLanguage: body.favoriteLanguage?.trim() || null } : {}),
    updatedAt: new Date(),
  }).where(eq(userProfilesTable.id, profile.id)).returning();
  res.json(profileResponse(updated));
});

router.delete("/profiles/:profileId", requireAuth as any, async (req: any, res): Promise<void> => {
  const profile = await ownedProfile(req.userId, req.params.profileId);
  if (!profile) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }
  if (profile.isDefault) {
    res.status(400).json({ error: "The default viewing profile cannot be deleted." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(watchlistTable).where(and(eq(watchlistTable.userId, req.userId), eq(watchlistTable.profileId, profile.id)));
    await tx.delete(viewingHistoryTable).where(and(eq(viewingHistoryTable.userId, req.userId), eq(viewingHistoryTable.profileId, profile.id)));
    await tx.delete(ratingsTable).where(and(eq(ratingsTable.userId, req.userId), eq(ratingsTable.profileId, profile.id)));
    await tx.delete(userProfilesTable).where(eq(userProfilesTable.id, profile.id));
  });
  if (profile.avatarObjectPath) {
    await deletePrivateObject(profile.avatarObjectPath, { ignoreNotFound: true }).catch(() => undefined);
  }
  res.sendStatus(204);
});

router.post("/profiles/:profileId/select", requireAuth as any, async (req: any, res): Promise<void> => {
  const profile = await ownedProfile(req.userId, req.params.profileId);
  if (!profile) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }
  res.json(profileResponse(profile));
});

router.post("/profiles/:profileId/avatar/upload-url", requireAuth as any, async (req: any, res): Promise<void> => {
  const parsed = RequestProfileAvatarUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await ownedProfile(req.userId, req.params.profileId);
  if (!profile) {
    res.status(404).json({ error: "Viewing profile not found." });
    return;
  }
  const { name, size, contentType } = parsed.data;
  if (!name.trim() || size > PROFILE_AVATAR_MAX_BYTES) {
    res.status(400).json({ error: "Upload a JPG, PNG, or WebP image up to 5MB." });
    return;
  }
  try {
    const objectPath = `/objects/profile-avatars/${req.userId}/${randomUUID()}`;
    const signed = await signPrivateObjectUrl(objectPath, "PUT");
    res.json({ uploadURL: signed.url, objectPath, name: name.trim(), size, contentType });
  } catch (error) {
    req.log?.error?.({ error }, "profile avatar upload signing failed");
    res.status(500).json({ error: "Could not prepare the avatar upload." });
  }
});

router.get("/profiles/:profileId/avatar", requireAuth as any, async (req: any, res): Promise<void> => {
  const profile = await ownedProfile(req.userId, req.params.profileId);
  if (!profile?.avatarObjectPath) {
    res.status(404).send("Avatar not found");
    return;
  }
  try {
    const signed = await signPrivateObjectUrl(profile.avatarObjectPath, "GET");
    res.redirect(302, signed.url);
  } catch (error) {
    req.log?.warn?.({ error }, "profile avatar unavailable");
    res.status(404).send("Avatar unavailable");
  }
});

export default router;