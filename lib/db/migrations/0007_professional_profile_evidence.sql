ALTER TABLE professional_work_entries
  ADD COLUMN IF NOT EXISTS movie_id integer;

CREATE TABLE IF NOT EXISTS professional_influences (
  id serial PRIMARY KEY,
  professional_id integer NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_awards (
  id serial PRIMARY KEY,
  professional_id integer NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  title text NOT NULL,
  organization text,
  category text,
  year integer,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_interviews (
  id serial PRIMARY KEY,
  professional_id integer NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  title text NOT NULL,
  publication text NOT NULL,
  url text NOT NULL,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_questions (
  id serial PRIMARY KEY,
  professional_id integer NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  asker_user_id text NOT NULL,
  question text NOT NULL,
  answer text,
  status text NOT NULL DEFAULT 'pending',
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS professional_questions_public_idx
  ON professional_questions(professional_id, status, created_at);
CREATE INDEX IF NOT EXISTS professional_questions_asker_idx
  ON professional_questions(asker_user_id, professional_id, created_at);