import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { userProfilesTable } from "./profiles";

export type CinemaOsAfterglow = {
  movieId: number | null;
  movieTitle: string;
  note: string;
  updatedAt: string;
};

export const cinemaOsStatesTable = pgTable(
  "cinema_os_states",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.clerkId, { onDelete: "cascade" }),
    profileId: integer("profile_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    afterglow: jsonb("afterglow").$type<CinemaOsAfterglow>().notNull().default({
      movieId: null,
      movieTitle: "",
      note: "",
      updatedAt: "",
    }),
    doubleFeature: jsonb("double_feature")
      .$type<[number | null, number | null]>()
      .notNull()
      .default([null, null]),
    spoilerNote: text("spoiler_note").notNull().default(""),
    passportCount: integer("passport_count").notNull().default(0),
    curriculumProgress: integer("curriculum_progress").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userProfileUnique: uniqueIndex("cinema_os_states_user_profile_unique").on(
      table.userId,
      table.profileId,
    ),
  }),
);

export type CinemaOsState = typeof cinemaOsStatesTable.$inferSelect;
