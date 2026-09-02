CREATE TABLE IF NOT EXISTS cinema_os_states (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  profile_id integer NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  afterglow jsonb NOT NULL DEFAULT '{"movieId":null,"movieTitle":"","note":"","updatedAt":""}'::jsonb,
  double_feature jsonb NOT NULL DEFAULT '[null,null]'::jsonb,
  spoiler_note text NOT NULL DEFAULT '',
  passport_count integer NOT NULL DEFAULT 0,
  curriculum_progress integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cinema_os_states_user_profile_unique
  ON cinema_os_states(user_id, profile_id);