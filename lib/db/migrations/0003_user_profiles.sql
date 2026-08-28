-- Viewing profiles are account-owned; legacy activity remains account-scoped
-- until a profile context is supplied by the client.
CREATE TABLE IF NOT EXISTS user_profiles (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_key text NOT NULL DEFAULT 'orbit',
  avatar_object_path text,
  kids_mode boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  maturity text NOT NULL DEFAULT 'all',
  autoplay boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS profile_id integer;
ALTER TABLE viewing_history ADD COLUMN IF NOT EXISTS profile_id integer;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS profile_id integer;

DROP INDEX CONCURRENTLY IF EXISTS viewing_history_user_movie_idx;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS viewing_history_user_profile_movie_idx
  ON viewing_history (user_id, profile_id, movie_id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS viewing_history_user_movie_legacy_idx
  ON viewing_history (user_id, movie_id) WHERE profile_id IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS user_profiles_user_id_idx
  ON user_profiles (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_profiles_user_default_idx
  ON user_profiles (user_id, is_default);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS user_profiles_one_default_idx
  ON user_profiles (user_id) WHERE is_default = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS watchlist_user_profile_status_idx
  ON watchlist (user_id, profile_id, status, added_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS viewing_history_user_profile_viewed_idx
  ON viewing_history (user_id, profile_id, viewed_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ratings_user_profile_updated_idx
  ON ratings (user_id, profile_id, updated_at);

INSERT INTO user_profiles (user_id, name, is_default)
SELECT u.clerk_id, COALESCE(NULLIF(u.display_name, ''), NULLIF(u.username, ''), 'You'), true
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.user_id = u.clerk_id
);

UPDATE watchlist w
SET profile_id = p.id
FROM user_profiles p
WHERE w.user_id = p.user_id
  AND p.is_default = true
  AND w.profile_id IS NULL;

UPDATE viewing_history h
SET profile_id = p.id
FROM user_profiles p
WHERE h.user_id = p.user_id
  AND p.is_default = true
  AND h.profile_id IS NULL;

UPDATE ratings r
SET profile_id = p.id
FROM user_profiles p
WHERE r.user_id = p.user_id
  AND p.is_default = true
  AND r.profile_id IS NULL;