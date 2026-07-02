-- Events move from hard-coded client arrays to a real table. Events are
-- matching context: sessions reference them via sessions.event_id (text key).

CREATE TABLE IF NOT EXISTS events (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  city        text NOT NULL,
  dates_label text NOT NULL,          -- display label, e.g. 'MAY 19–22'
  starts_on   date,
  ends_on     date,
  blurb       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events are readable by authenticated users" ON events;
CREATE POLICY "events are readable by authenticated users"
  ON events FOR SELECT TO authenticated USING (true);

-- Seed with the previously hard-coded set.
INSERT INTO events (id, name, city, dates_label, starts_on, ends_on, blurb) VALUES
  ('yc-startup-school-2026', 'YC AI Startup School', 'San Francisco', 'JUL 25', '2026-07-25', '2026-07-25',
   'A one-day intensive for early founders building AI startups.'),
  ('consensus-2026', 'Consensus', 'Austin', 'MAY 19–22', '2026-05-19', '2026-05-22',
   'The largest crypto + AI conference in the US.'),
  ('sxsw-2026', 'SXSW', 'Austin', 'MAR 12–22', '2026-03-12', '2026-03-22',
   'Music, film, tech — ten days of travelers crossing through Austin.'),
  ('aihackathon-berkeley', 'AI Hackathon @ Berkeley', 'Berkeley', 'JUN 20', '2026-06-20', '2026-06-20',
   'Weekend hackathon at Berkeley; most attendees fly in Friday.'),
  ('web-summit-2026', 'Web Summit', 'Lisbon', 'NOV 9–12', '2026-11-09', '2026-11-12',
   'Tech conference in Lisbon; most US travelers connect through JFK or BOS.')
ON CONFLICT (id) DO NOTHING;
