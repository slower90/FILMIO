import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  mediaName: text("media_name"),
  mediaSize: integer("media_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  expiresAtIndex: index("stories_expires_at_idx").on(table.expiresAt),
  authorCreatedAtIndex: index("stories_author_created_at_idx").on(table.authorId, table.createdAt),
}));

export const insertStorySchema = createInsertSchema(storiesTable).omit({
  id: true,
  createdAt: true,
  expiresAt: true,
});

export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof storiesTable.$inferSelect;