import { pgTable, serial, text, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const friendRequestsTable = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  receiverId: text("receiver_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  senderReceiverUnique: uniqueIndex("friend_requests_sender_receiver_unique").on(table.senderId, table.receiverId),
  statusCheck: check("friend_requests_status_check", sql`status in ('pending', 'accepted')`),
}));

export const insertFriendRequestSchema = createInsertSchema(friendRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type FriendRequest = typeof friendRequestsTable.$inferSelect;