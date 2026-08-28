import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  authorType: text("author_type").notNull().default("user"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  imageType: text("image_type"),
  imageName: text("image_name"),
  imageSize: integer("image_size"),
  linkedMovieId: integer("linked_movie_id"),
  linkedMovieTitle: text("linked_movie_title"),
  linkedMoviePosterPath: text("linked_movie_poster_path"),
  postType: text("post_type").notNull().default("standard"),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPostUnique: uniqueIndex("post_likes_user_post_unique").on(table.userId, table.postId),
}));

export const postCommentsTable = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPostLikeSchema = createInsertSchema(postLikesTable).omit({ id: true, createdAt: true });
export const insertPostCommentSchema = createInsertSchema(postCommentsTable).omit({ id: true, createdAt: true });

export type InsertPost = z.infer<typeof insertPostSchema>;
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type Post = typeof postsTable.$inferSelect;
export type PostLike = typeof postLikesTable.$inferSelect;
export type PostComment = typeof postCommentsTable.$inferSelect;