import { pgTable, text, serial, integer, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const viewingHistoryTable = pgTable(
  "viewing_history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    movieId: integer("movie_id").notNull(),
    movieTitle: text("movie_title").notNull(),
    moviePosterPath: text("movie_poster_path"),
    movieReleaseDate: text("movie_release_date"),
    movieVoteAverage: real("movie_vote_average"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userMovieUnique: uniqueIndex("viewing_history_user_movie_idx").on(
      table.userId,
      table.movieId,
    ),
  }),
);

export const insertViewingHistorySchema = createInsertSchema(viewingHistoryTable).omit({
  id: true,
  viewedAt: true,
});
export type InsertViewingHistory = z.infer<typeof insertViewingHistorySchema>;
export type ViewingHistoryEntry = typeof viewingHistoryTable.$inferSelect;