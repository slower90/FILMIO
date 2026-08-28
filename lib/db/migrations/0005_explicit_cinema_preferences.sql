ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_actor text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_director text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_genre text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_country text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_decade text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS favorite_language text;