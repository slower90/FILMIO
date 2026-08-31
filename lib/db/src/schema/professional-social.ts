import { pgTable, serial, text, timestamp, integer, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { professionalsTable } from "./professionals";

export const professionalPostsTable = pgTable("professional_posts", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalsTable.id, { onDelete: "cascade" }),
  caption: text("caption").notNull().default(""),
  objectPath: text("object_path"),
  fileName: text("file_name"),
  contentType: text("content_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const professionalPostLikesTable = pgTable("professional_post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => professionalPostsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  postUserUnique: uniqueIndex("professional_post_likes_post_user_unique").on(table.postId, table.userId),
}));

export const professionalPostCommentsTable = pgTable("professional_post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => professionalPostsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const professionalQuestionsTable = pgTable("professional_questions", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalsTable.id, { onDelete: "cascade" }),
  askerUserId: text("asker_user_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  status: text("status").notNull().default("pending"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalPostSchema = createInsertSchema(professionalPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProfessionalPostLikeSchema = createInsertSchema(professionalPostLikesTable).omit({ id: true, createdAt: true });
export const insertProfessionalPostCommentSchema = createInsertSchema(professionalPostCommentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProfessionalQuestionSchema = createInsertSchema(professionalQuestionsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertProfessionalPost = z.infer<typeof insertProfessionalPostSchema>;
export type InsertProfessionalPostLike = z.infer<typeof insertProfessionalPostLikeSchema>;
export type InsertProfessionalPostComment = z.infer<typeof insertProfessionalPostCommentSchema>;
export type ProfessionalPost = typeof professionalPostsTable.$inferSelect;
export type ProfessionalPostLike = typeof professionalPostLikesTable.$inferSelect;
export type ProfessionalPostComment = typeof professionalPostCommentsTable.$inferSelect;
export type ProfessionalQuestion = typeof professionalQuestionsTable.$inferSelect;