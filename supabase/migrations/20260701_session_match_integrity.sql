-- Session/match integrity pass (2026-07-01 maintenance).

-- Lounge is collected in the session flow (Terminal + Gate/Lounge location
-- model) and used for meetup-location assignment.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lounge text;

-- Boarding time / arrival date parsed from the boarding pass (validated
-- server-side in parse-boarding-pass).
ALTER TABLE flights ADD COLUMN IF NOT EXISTS boarding_time text;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrival_date date;

-- Normalise legacy status naming: old flows wrote 'inactive' when a session
-- was replaced; the canonical archived state is 'archived'.
UPDATE sessions SET status = 'archived' WHERE status = 'inactive';

-- A user (session) can only have ONE active match at a time — enforced at the
-- data layer, not just in the matcher. Any insert that would give either
-- session a second live match is rejected with 23505, which the matcher
-- already handles as a benign race.
CREATE OR REPLACE FUNCTION enforce_single_active_match() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM matches m
    WHERE m.status IN ('pending', 'pending_a', 'pending_b', 'mutual')
      AND (m.session_id_a IN (NEW.session_id_a, NEW.session_id_b)
        OR m.session_id_b IN (NEW.session_id_a, NEW.session_id_b))
  ) THEN
    RAISE unique_violation USING MESSAGE = 'session already has an active match';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matches_single_active ON matches;
CREATE TRIGGER matches_single_active
  BEFORE INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_match();
