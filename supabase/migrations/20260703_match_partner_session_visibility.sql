-- Matched partners must be able to read each other's session rows: the match
-- card, waiting pass, and confirmed-match screen all join the partner's
-- session (flight, gate, terminal, and the nested users row) through matches.
-- Without this policy the partner side of every match renders blank.
--
-- SECURITY DEFINER helper breaks what would otherwise be recursive RLS
-- (a sessions policy whose predicate queries sessions).

CREATE OR REPLACE FUNCTION is_match_partner(session_row_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matches m
    JOIN sessions mine
      ON mine.id = CASE
        WHEN m.session_id_a = session_row_id THEN m.session_id_b
        ELSE m.session_id_a
      END
    WHERE (m.session_id_a = session_row_id OR m.session_id_b = session_row_id)
      AND mine.user_id = uid
      AND m.status IN ('pending', 'pending_a', 'pending_b', 'mutual')
  );
$$;

DROP POLICY IF EXISTS "matched partners can read sessions" ON sessions;
CREATE POLICY "matched partners can read sessions"
  ON sessions FOR SELECT TO authenticated
  USING (is_match_partner(id, auth.uid()));
