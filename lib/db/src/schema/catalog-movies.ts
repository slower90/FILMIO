import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type CatalogGenre = { id: number; name: string };
export type CatalogCredit = {
  id: number;
  name: string;
  character?: string;
  job?: string;
  department?: string;
  profilePath?: string | null;
  order?: number;
};

/**
 * Provider-backed records that need a stable FILMIO movie id.
 *
 * TMDB ids remain the public id whenever TMDB has an exact match. This table
 * owns an isolated high numeric range for OMDb/manual records so ratings,
 * reviews, and watchlists can keep using their existing integer movieId field.
 */
export const catalogMoviesTable = pgTable(
  "catalog_movies",
  {
    id: integer("id").primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    mediaType: text("media_type").notNull().default("movie"),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    overview: text("overview").notNull().default(""),
    releaseDate: text("release_date"),
    runtime: integer("runtime"),
    genres: jsonb("genres").$type<CatalogGenre[]>().notNull().default([]),
    credits: jsonb("credits").$type<{ cast: CatalogCredit[]; crew: CatalogCredit[] }>().notNull().default({
      cast: [],
      crew: [],
    }),
    voteAverage: real("vote_average").notNull().default(0),
    voteCount: integer("vote_count").notNull().default(0),
    tagline: text("tagline"),
    status: text("status").notNull().default(""),
    budget: integer("budget").notNull().default(0),
    revenue: integer("revenue").notNull().default(0),
    imdbId: text("imdb_id"),
    isUpcoming: boolean("is_upcoming").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceIdentityUnique: uniqueIndex("catalog_movies_source_identity_idx").on(
      table.source,
      table.sourceId,
    ),
    normalizedTitleIndex: index("catalog_movies_normalized_title_idx").on(table.normalizedTitle),
    upcomingIndex: index("catalog_movies_upcoming_idx").on(table.isUpcoming, table.releaseDate),
  }),
);

export const insertCatalogMovieSchema = createInsertSchema(catalogMoviesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCatalogMovie = z.infer<typeof insertCatalogMovieSchema>;
export type CatalogMovie = typeof catalogMoviesTable.$inferSelect;