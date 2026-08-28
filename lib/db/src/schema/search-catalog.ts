import {
  date,
  index,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Provider-neutral catalog records used by smart search.
 *
 * The text columns intentionally remain denormalized for provider-neutral
 * indexing into the external search engine.
 */
export const searchCatalogTable = pgTable(
  "search_catalog",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    providerId: text("provider_id").notNull(),
    mediaType: text("media_type").notNull(), // movie | tv | anime
    title: text("title").notNull(),
    alternateTitles: text("alternate_titles").notNull().default(""),
    genres: text("genres").notNull().default(""),
    language: text("language").notNull().default(""),
    languageCode: text("language_code"),
    releaseDate: date("release_date", { mode: "string" }),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    overview: text("overview").notNull().default(""),
    voteAverage: real("vote_average").notNull().default(0),
    genreIds: jsonb("genre_ids").$type<number[]>().notNull().default([]),
    popularity: real("popularity").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceProviderUnique: uniqueIndex("search_catalog_source_provider_idx").on(
      table.source,
      table.providerId,
    ),
    mediaTypeIndex: index("search_catalog_media_type_idx").on(table.mediaType),
    releaseDateIndex: index("search_catalog_release_date_idx").on(table.releaseDate),
  }),
);

export const insertSearchCatalogSchema = createInsertSchema(searchCatalogTable).omit({
  id: true,
  indexedAt: true,
});

export type InsertSearchCatalog = z.infer<typeof insertSearchCatalogSchema>;
export type SearchCatalogEntry = typeof searchCatalogTable.$inferSelect;