CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_key TEXT NOT NULL,
  body TEXT NOT NULL,
  movie_id INTEGER,
  movie_title TEXT,
  movie_poster_path TEXT,
  href TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS signals_user_source_unique
  ON signals(user_id, source_key);

CREATE INDEX IF NOT EXISTS signals_user_profile_read_idx
  ON signals(user_id, profile_id, is_read, created_at);