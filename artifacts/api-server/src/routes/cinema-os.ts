import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { UpdateCinemaOsStateBody } from "@workspace/api-zod";
import { cinemaOsStatesTable, db } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { ensureDefaultProfile, resolveOptionalProfileId } from "./profiles";

const router: IRouter = Router();

function mapCinemaOsState(row: typeof cinemaOsStatesTable.$inferSelect) {
  return {
    afterglow: row.afterglow,
    doubleFeature: row.doubleFeature,
    spoilerNote: row.spoilerNote,
    passportCount: row.passportCount,
    curriculumProgress: row.curriculumProgress,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function profileForRequest(userId: string, value: unknown) {
  const scope = await resolveOptionalProfileId(userId, value);
  if (scope.provided) return scope.id;
  return (await ensureDefaultProfile(userId)).id;
}

router.get(
  "/users/me/cinema-os",
  requireAuth as any,
  async (req: any, res): Promise<void> => {
    const profileId = await profileForRequest(req.userId, req.query.profileId);
    if (profileId === null) {
      res.status(404).json({ error: "Viewing profile not found." });
      return;
    }

    const [state] = await db
      .select()
      .from(cinemaOsStatesTable)
      .where(
        and(
          eq(cinemaOsStatesTable.userId, req.userId),
          eq(cinemaOsStatesTable.profileId, profileId),
        ),
      )
      .limit(1);

    res.json({ state: state ? mapCinemaOsState(state) : null });
  },
);

router.put(
  "/users/me/cinema-os",
  requireAuth as any,
  async (req: any, res): Promise<void> => {
    const parsed = UpdateCinemaOsStateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const profileId = await profileForRequest(req.userId, req.query.profileId);
    if (profileId === null) {
      res.status(404).json({ error: "Viewing profile not found." });
      return;
    }

    const input = parsed.data;
    const afterglow = {
      ...input.afterglow,
      updatedAt: new Date(input.afterglow.updatedAt).toISOString(),
    };
    const doubleFeature = [
      input.doubleFeature[0] ?? null,
      input.doubleFeature[1] ?? null,
    ] as [number | null, number | null];
    const [state] = await db
      .insert(cinemaOsStatesTable)
      .values({
        userId: req.userId,
        profileId,
        afterglow,
        doubleFeature,
        spoilerNote: input.spoilerNote,
        passportCount: input.passportCount,
        curriculumProgress: input.curriculumProgress,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [cinemaOsStatesTable.userId, cinemaOsStatesTable.profileId],
        set: {
          afterglow,
          doubleFeature,
          spoilerNote: input.spoilerNote,
          passportCount: input.passportCount,
          curriculumProgress: input.curriculumProgress,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ state: mapCinemaOsState(state) });
  },
);

export default router;
