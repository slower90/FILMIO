import { pgTable, text, serial, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  movieId: integer("movie_id").notNull(),
  content: text("content").notNull(),
  rating: integer("rating"),
  isCriticReview: boolean("is_critic_review").notNull().default(false),
  verifiedWatch: boolean("verified_watch").notNull().default(false),
  containsSpoilers: boolean("contains_spoilers").notNull().default(false),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  movieTitle: text("movie_title"),
  moviePosterPath: text("movie_poster_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  movieCreatedIdx: index("reviews_movie_created_at_idx").on(table.movieId, table.createdAt),
  userCreatedIdx: index("reviews_user_created_at_idx").on(table.userId, table.createdAt),
}));

export const reviewLikesTable = pgTable("review_likes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  reviewId: integer("review_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userReviewIdx: index("review_likes_user_review_idx").on(table.userId, table.reviewId),
  reviewIdx: index("review_likes_review_id_idx").on(table.reviewId),
}));

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  reviewId: integer("review_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reviewCreatedIdx: index("comments_review_created_at_idx").on(table.reviewId, table.createdAt),
}));

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, likesCount: true, commentsCount: true, createdAt: true, updatedAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
