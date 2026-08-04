import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
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
