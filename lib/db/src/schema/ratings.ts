import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  movieId: integer("movie_id").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  movieIdx: index("ratings_movie_id_idx").on(table.movieId),
  userUpdatedIdx: index("ratings_user_updated_at_idx").on(table.userId, table.updatedAt),
}));

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
