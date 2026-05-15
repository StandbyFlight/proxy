// Carries the session row from intent.tsx to index.tsx so match-sessions is
// invoked only after the home screen's Ably subscription is active.
let _session: Record<string, unknown> | null = null

export function setPendingSession(session: Record<string, unknown>) {
  _session = session
}

export function takePendingSession(): Record<string, unknown> | null {
  const s = _session
  _session = null
  return s
}
