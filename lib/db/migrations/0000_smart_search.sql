-- Initial normalized catalog migration. The follow-up Meilisearch migration
-- removes the old PostgreSQL fuzzy-search objects after deployments switch
-- general text search to Meilisearch.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS search_catalog (
  id serial PRIMARY KEY,
  source text NOT NULL,
  provider_id text NOT NULL,
  media_type text NOT NULL,
  title text NOT NULL,
  genres text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  language_code text,
  release_date date,
  poster_path text,
  backdrop_path text,
  overview text NOT NULL DEFAULT '',
  vote_average real NOT NULL DEFAULT 0,
  genre_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  popularity real NOT NULL DEFAULT 0,
  metadata jsonb,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_catalog_source_provider_idx
  ON search_catalog (source, provider_id);
CREATE INDEX IF NOT EXISTS search_catalog_media_type_idx
  ON search_catalog (media_type);
CREATE INDEX IF NOT EXISTS search_catalog_release_date_idx
  ON search_catalog (release_date);