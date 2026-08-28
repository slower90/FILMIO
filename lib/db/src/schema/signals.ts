import { pgTable, serial, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { userProfilesTable } from "./profiles";

export const signalsTable = pgTable("signals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  profileId: integer("profile_id").references(() => userProfilesTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  sourceKey: text("source_key").notNull(),
  body: text("body").notNull(),
  movieId: integer("movie_id"),
  movieTitle: text("movie_title"),
  moviePosterPath: text("movie_poster_path"),
  href: text("href"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userSourceUnique: uniqueIndex("signals_user_source_unique").on(table.userId, table.sourceKey),
  userProfileReadIdx: index("signals_user_profile_read_idx").on(table.userId, table.profileId, table.isRead, table.createdAt),
}));

export const insertSignalSchema = createInsertSchema(signalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;