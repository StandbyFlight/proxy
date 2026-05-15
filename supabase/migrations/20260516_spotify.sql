ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_access_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_refresh_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_token_expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_top_artists jsonb;
