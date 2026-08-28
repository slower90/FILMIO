-- Hot-path indexes for Supabase PostgreSQL.
-- CONCURRENTLY keeps production writes available while each index is built.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ratings_movie_id_idx
  ON ratings (movie_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ratings_user_updated_at_idx
  ON ratings (user_id, updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS reviews_movie_created_at_idx
  ON reviews (movie_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS reviews_user_created_at_idx
  ON reviews (user_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS review_likes_user_review_idx
  ON review_likes (user_id, review_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS review_likes_review_id_idx
  ON review_likes (review_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_review_created_at_idx
  ON comments (review_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS watchlist_user_status_added_at_idx
  ON watchlist (user_id, status, added_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS viewing_history_user_viewed_at_idx
  ON viewing_history (user_id, viewed_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS follows_follower_created_at_idx
  ON follows (follower_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS follows_following_created_at_idx
  ON follows (following_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_participants_user_conversation_idx
  ON conversation_participants (user_id, conversation_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_participants_conversation_id_idx
  ON conversation_participants (conversation_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS chat_messages_conversation_created_at_idx
  ON chat_messages (conversation_id, created_at);