import { pgTable, text, serial, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.clerkId, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarKey: text("avatar_key").notNull().default("orbit"),
  avatarObjectPath: text("avatar_object_path"),
  kidsMode: boolean("kids_mode").notNull().default(false),
  language: text("language").notNull().default("en"),
  maturity: text("maturity").notNull().default("all"),
  autoplay: boolean("autoplay").notNull().default(true),
  favoriteActor: text("favorite_actor"),
  favoriteDirector: text("favorite_director"),
  favoriteGenre: text("favorite_genre"),
  favoriteCountry: text("favorite_country"),
  favoriteDecade: text("favorite_decade"),
  favoriteLanguage: text("favorite_language"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("user_profiles_user_id_idx").on(table.userId),
  userDefaultIdx: index("user_profiles_user_default_idx").on(table.userId, table.isDefault),
}));

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;