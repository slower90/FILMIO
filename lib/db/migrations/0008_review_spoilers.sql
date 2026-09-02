ALTER TABLE "reviews"
  ADD COLUMN IF NOT EXISTS "contains_spoilers" boolean NOT NULL DEFAULT false;