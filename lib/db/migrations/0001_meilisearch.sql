ALTER TABLE search_catalog
  ADD COLUMN IF NOT EXISTS alternate_titles text NOT NULL DEFAULT '';

DROP INDEX IF EXISTS search_catalog_title_trgm_idx;
DROP INDEX IF EXISTS search_catalog_genres_trgm_idx;
DROP INDEX IF EXISTS search_catalog_language_trgm_idx;

DO $$
DECLARE
  trigram_extension oid;
BEGIN
  SELECT oid
  INTO trigram_extension
  FROM pg_extension
  WHERE extname = 'pg_trgm';

  IF trigram_extension IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_depend
       WHERE refobjid = trigram_extension
         AND deptype <> 'e'
     ) THEN
    EXECUTE 'DROP EXTENSION pg_trgm';
  END IF;
END $$;