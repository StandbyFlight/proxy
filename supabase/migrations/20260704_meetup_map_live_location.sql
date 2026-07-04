-- Meetup map + opt-in live location. This migration is PURELY ADDITIVE and
-- LOCATION-ONLY: it never touches match creation, matcher logic, or the
-- meetup-string selection (supabase/functions/_shared/meetupLocations.ts remains
-- the source of truth for which spot a match gets). Matching keeps working
-- exactly as before whether or not any row here exists.
--
-- Two new tables:
--   1. airport_pois         — public read-only reference data so the app can
--                             resolve an existing meetup spot NAME to a point on
--                             a map. Seeded to match the curated RDU spot names.
--   2. match_live_locations — ephemeral, opt-in positions shared only between the
--                             two members of a MUTUAL match. Expires via
--                             expires_at (app/cron responsibility); RLS below
--                             guarantees you only ever see your own row and your
--                             mutual partner's row.

-- =============================================================================
-- TABLE 1 — airport_pois (public reference data, read-only to authenticated)
-- =============================================================================
CREATE TABLE IF NOT EXISTS airport_pois (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_iata text NOT NULL,
  name         text NOT NULL,
  category     text,                              -- 'cafe' | 'restaurant' | 'landmark'
  terminal     text,
  latitude     double precision NOT NULL,
  longitude    double precision NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (airport_iata, name)
);

ALTER TABLE airport_pois ENABLE ROW LEVEL SECURITY;

-- Read-only reference data: anyone signed in can read, nobody can write via the
-- API (no insert/update/delete policy is intentionally defined).
DROP POLICY IF EXISTS "airport pois are readable by authenticated users" ON airport_pois;
CREATE POLICY "airport pois are readable by authenticated users"
  ON airport_pois FOR SELECT TO authenticated USING (true);

-- Seed the curated RDU meetup spots so the map can resolve the exact strings the
-- matcher stores. Names MUST stay in sync with RDU_MEETUP_SPOTS in
-- supabase/functions/_shared/meetupLocations.ts. RDU is ~35.8776, -78.7875.
INSERT INTO airport_pois (airport_iata, name, category, terminal, latitude, longitude) VALUES
  ('RDU', 'Terminal 2 food court seating',                'restaurant', '2', 35.8779, -78.7876),
  ('RDU', 'The rocking chairs by the Terminal 2 windows', 'landmark',   '2', 35.8782, -78.7869),
  ('RDU', 'Terminal 1 central seating',                   'landmark',   '1', 35.8760, -78.7900)
ON CONFLICT (airport_iata, name) DO NOTHING;

-- =============================================================================
-- TABLE 2 — match_live_locations (opt-in, ephemeral live positions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS match_live_locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude   double precision NOT NULL,
  longitude  double precision NOT NULL,
  accuracy   double precision,
  arrived    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (match_id, user_id)
);

ALTER TABLE match_live_locations ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper to break recursive RLS (a match_live_locations policy
-- that needs to look through matches/sessions to confirm membership). Only
-- confirms membership in a MUTUAL match — location sharing is never exposed for
-- pending/declined matches.
CREATE OR REPLACE FUNCTION is_mutual_match_member(m_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matches m
    JOIN sessions s ON s.id IN (m.session_id_a, m.session_id_b)
    WHERE m.id = m_id
      AND s.user_id = uid
      AND m.status = 'mutual'
  );
$$;

-- Read your own row always; read your partner's row only in a mutual match.
DROP POLICY IF EXISTS "read own or mutual partner live location" ON match_live_locations;
CREATE POLICY "read own or mutual partner live location"
  ON match_live_locations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_mutual_match_member(match_id, auth.uid()));

-- Only ever write your own row, and only into a mutual match you belong to.
DROP POLICY IF EXISTS "insert own live location in mutual match" ON match_live_locations;
CREATE POLICY "insert own live location in mutual match"
  ON match_live_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_mutual_match_member(match_id, auth.uid()));

DROP POLICY IF EXISTS "update own live location in mutual match" ON match_live_locations;
CREATE POLICY "update own live location in mutual match"
  ON match_live_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_mutual_match_member(match_id, auth.uid()));

-- You can always stop sharing / delete your own row.
DROP POLICY IF EXISTS "delete own live location" ON match_live_locations;
CREATE POLICY "delete own live location"
  ON match_live_locations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime: partners watch each other's position update live. Mirror the pattern
-- in 20260519_enable_realtime_matches.sql (publication + REPLICA IDENTITY FULL),
-- but guard the publication add so re-running this migration won't error.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE match_live_locations;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already in the publication
END;
$$;

ALTER TABLE match_live_locations REPLICA IDENTITY FULL;
