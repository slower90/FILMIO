import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchlistTable = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  movieId: integer("movie_id").notNull(),
  status: text("status").notNull().default("want_to_watch"),
  movieTitle: text("movie_title"),
  moviePosterPath: text("movie_poster_path"),
  movieReleaseDate: text("movie_release_date"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userStatusAddedIdx: index("watchlist_user_status_added_at_idx").on(
    table.userId,
    table.status,
    table.addedAt,
  ),
}));

export const insertWatchlistSchema = createInsertSchema(watchlistTable).omit({ id: true, addedAt: true });
export type InsertWatchlistEntry = z.infer<typeof insertWatchlistSchema>;
export type WatchlistEntry = typeof watchlistTable.$inferSelect;
