import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Persistent anime cache — populated from AniList (primary) or Jikan (fallback).
 * Cache keys: "top:<filter>:<type>:<page>", "search:<query>", "detail:<id>"
 * TTL enforced at the application layer (24 h for list pages, 7 d for detail).
 */
export const animeCacheTable = pgTable("anime_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  data: jsonb("data").notNull(),
  source: text("source").notNull().default("anilist"), // "anilist" | "jikan"
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AnimeCacheEntry = typeof animeCacheTable.$inferSelect;
