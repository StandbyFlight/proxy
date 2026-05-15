-- Interest flags written when a user taps a coming-soon enrichment row.
-- Used to prioritise notification order when integrations ship, and will
-- eventually feed into matching signals (same_music_taste, etc.) once
-- real provider data is stored.
ALTER TABLE users ADD COLUMN IF NOT EXISTS spotify_interest boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS goodreads_interest boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS letterboxd_interest boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS beli_interest boolean DEFAULT false;
