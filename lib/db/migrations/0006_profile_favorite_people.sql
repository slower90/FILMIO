CREATE TABLE IF NOT EXISTS profile_favorite_people (
  id serial PRIMARY KEY,
  profile_id integer NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  tmdb_person_id integer NOT NULL,
  name text NOT NULL,
  profile_path text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_favorite_people_profile_kind_person_idx
  ON profile_favorite_people(profile_id, kind, tmdb_person_id);
CREATE INDEX IF NOT EXISTS profile_favorite_people_profile_kind_position_idx
  ON profile_favorite_people(profile_id, kind, position);