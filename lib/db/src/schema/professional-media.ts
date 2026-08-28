import { pgTable, serial, text, timestamp, integer, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { professionalsTable } from "./professionals";

export const professionalProfileMediaTable = pgTable("professional_profile_media", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalsTable.id, { onDelete: "cascade" }),
  mediaType: text("media_type").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalProfileMediaSchema = createInsertSchema(professionalProfileMediaTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProfessionalProfileMedia = z.infer<typeof insertProfessionalProfileMediaSchema>;
export type ProfessionalProfileMedia = typeof professionalProfileMediaTable.$inferSelect;