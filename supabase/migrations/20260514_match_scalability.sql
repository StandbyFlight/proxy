-- Fix 1: denormalized origin_iata on matches lets pending-match scans be scoped
-- to a single airport instead of scanning the entire table.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS origin_iata TEXT;

-- Backfill from sessions for any existing rows (safe no-op on empty table).
UPDATE matches m
SET origin_iata = s.origin_iata
FROM sessions s
WHERE m.session_id_a = s.id AND m.origin_iata IS NULL;

-- Fix 3: canonical-pair unique index prevents two concurrent invocations from
-- inserting duplicate A↔B match rows. LEAST/GREATEST normalises column order
-- so (A,B) and (B,A) are treated as the same pair.
CREATE UNIQUE INDEX IF NOT EXISTS matches_canonical_pair_idx
  ON matches (LEAST(session_id_a, session_id_b), GREATEST(session_id_a, session_id_b));
