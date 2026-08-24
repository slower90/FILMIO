import { pgTable, text, serial, boolean, timestamp, integer, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const professionalsTable = pgTable("professionals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  displayName: text("display_name"),
  headshotUrl: text("headshot_url"),
  demoReelUrl: text("demo_reel_url"),
  bio: text("bio"),
  roles: text("roles").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]),
  agencyContact: text("agency_contact"),
  availabilityStatus: text("availability_status").notNull().default("not_available"),
  verified: boolean("verified").notNull().default(false),
  imdbLink: text("imdb_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalSchema = createInsertSchema(professionalsTable).omit({ id: true, verified: true, createdAt: true, updatedAt: true });
export type InsertProfessional = z.infer<typeof insertProfessionalSchema>;
export type Professional = typeof professionalsTable.$inferSelect;

export const professionalWorkEntriesTable = pgTable("professional_work_entries", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalsTable.id, { onDelete: "cascade" }),
  projectName: text("project_name").notNull(),
  role: text("role").notNull(),
  year: integer("year"),
  collaborators: text("collaborators").array().notNull().default([]),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const professionalAuditionsTable = pgTable("professional_auditions", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalWorkEntrySchema = createInsertSchema(professionalWorkEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProfessionalAuditionSchema = createInsertSchema(professionalAuditionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type ProfessionalWorkEntry = typeof professionalWorkEntriesTable.$inferSelect;
export type ProfessionalAudition = typeof professionalAuditionsTable.$inferSelect;
