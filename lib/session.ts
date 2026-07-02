import { supabase } from './supabase'

// Single source of truth for the travel-session lifecycle. Every screen reads
// sessions through this module — no screen builds its own "active session"
// query. Lifecycle:
//
//   createSession()  — inserts the new session, THEN archives any previous
//                      active session (never the other way round, so a failed
//                      insert can't wipe state) and declines its open matches.
//   getActiveSession() — the one canonical active-session query.
//   endActiveSession() — explicit archive.
//   getSessionHistory() — every past/upcoming session, never deleted.
//
// A session expires only when the flight window has actually passed:
// expires_at = departure_time + EXPIRY_GRACE. Nothing else expires it.

const EXPIRY_GRACE_MS = 45 * 60 * 1000
const NO_DEPARTURE_TTL_MS = 6 * 60 * 60 * 1000

export const ACTIVE_MATCH_STATUSES = ['pending', 'pending_a', 'pending_b', 'mutual']

const SESSION_SELECT =
  'id, user_id, flight_id, origin_iata, destination_iata, departure_time, ' +
  'terminal, gate, lounge, connection_intent, travel_purpose, event_id, ' +
  'expires_at, status, created_at, flights(flight_iata)'

export type Session = {
  id: string
  user_id: string
  flight_id: string | null
  flight_iata: string | null
  origin_iata: string | null
  destination_iata: string | null
  departure_time: string | null
  terminal: string | null
  gate: string | null
  lounge: string | null
  connection_intent: string
  travel_purpose: string | null
  event_id: string | null
  expires_at: string | null
  status: string
  created_at: string | null
}

export type MatchSummary = {
  id: string
  status: string
  session_id_a: string
  session_id_b: string
  iAmA: boolean
  iAccepted: boolean
}

type RawSessionRow = Record<string, unknown> & {
  flights?: { flight_iata?: string } | { flight_iata?: string }[] | null
}

function toSession(row: RawSessionRow): Session {
  const fl = row.flights
  const flightIata = Array.isArray(fl) ? fl[0]?.flight_iata : fl?.flight_iata
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    flight_id: (row.flight_id as string) ?? null,
    flight_iata: flightIata ?? null,
    origin_iata: (row.origin_iata as string) ?? null,
    destination_iata: (row.destination_iata as string) ?? null,
    departure_time: (row.departure_time as string) ?? null,
    terminal: (row.terminal as string) ?? null,
    gate: (row.gate as string) ?? null,
    lounge: (row.lounge as string) ?? null,
    connection_intent: (row.connection_intent as string) ?? 'open',
    travel_purpose: (row.travel_purpose as string) ?? null,
    event_id: (row.event_id as string) ?? null,
    expires_at: (row.expires_at as string) ?? null,
    status: (row.status as string) ?? 'active',
    created_at: (row.created_at as string) ?? null,
  }
}

async function requireUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

export async function getActiveSession(): Promise<Session | null> {
  const userId = await requireUserId()
  if (!userId) return null
  const { data } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? toSession(data as unknown as RawSessionRow) : null
}

export type CreateSessionInput = {
  flight_id: string
  origin_iata: string | null
  destination_iata: string | null
  departure_time: string | null
  terminal: string | null
  gate: string | null
  lounge: string | null
  connection_intent: string
  event_id: string | null
}

// Insert the new session first, then archive the previous one into history.
// The previous session is never deleted — "change flight" is an intentional
// transition, not a wipe.
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const userId = await requireUserId()
  if (!userId) throw new Error('Not authenticated')

  const expiresAt = input.departure_time
    ? new Date(new Date(input.departure_time).getTime() + EXPIRY_GRACE_MS).toISOString()
    : new Date(Date.now() + NO_DEPARTURE_TTL_MS).toISOString()

  const { data: prevSessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data: row, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      flight_id: input.flight_id,
      origin_iata: input.origin_iata,
      destination_iata: input.destination_iata,
      departure_time: input.departure_time,
      terminal: input.terminal,
      gate: input.gate,
      lounge: input.lounge,
      connection_intent: input.connection_intent,
      event_id: input.event_id,
      expires_at: expiresAt,
      status: 'active',
    })
    .select(SESSION_SELECT)
    .single()
  if (error) throw error

  const prevIds = (prevSessions ?? []).map(s => s.id)
  if (prevIds.length > 0) {
    await releaseMatchesFor(prevIds)
    const { error: archiveErr } = await supabase
      .from('sessions')
      .update({ status: 'archived' })
      .in('id', prevIds)
    // Surface a failed archive: two "active" sessions would confuse the
    // matcher. Retrying createSession converges — it archives all leftovers.
    if (archiveErr) throw archiveErr
  }

  return toSession(row as unknown as RawSessionRow)
}

export async function endActiveSession(): Promise<void> {
  const userId = await requireUserId()
  if (!userId) return
  const { data: rows } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
  const ids = (rows ?? []).map(r => r.id)
  if (ids.length === 0) return
  await releaseMatchesFor(ids)
  await supabase.from('sessions').update({ status: 'archived' }).in('id', ids)
}

// Decline any live matches on the given sessions — including mutual ones —
// so the other party is released back to searching instead of holding a ghost
// meetup with someone who left (and being blocked from new matches by the
// single-active-match trigger).
async function releaseMatchesFor(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return
  const orClause = sessionIds
    .flatMap(id => [`session_id_a.eq.${id}`, `session_id_b.eq.${id}`])
    .join(',')
  const { error } = await supabase
    .from('matches')
    .update({ status: 'declined' })
    .or(orClause)
    .in('status', ACTIVE_MATCH_STATUSES)
  if (error) throw error
}

// Attach (or clear) an event on the live session. Events are additive context
// on the normal matching flow — they narrow who you match with, nothing more.
export async function attachEventToActiveSession(eventId: string | null): Promise<void> {
  const active = await getActiveSession()
  if (!active) throw new Error('No active session')
  const { error } = await supabase
    .from('sessions')
    .update({ event_id: eventId })
    .eq('id', active.id)
  if (error) throw error
}

// The one canonical "current match for this session" query.
export async function getActiveMatch(sessionId: string): Promise<MatchSummary | null> {
  const { data: match } = await supabase
    .from('matches')
    .select('id, status, session_id_a, session_id_b')
    .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
    .in('status', ACTIVE_MATCH_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!match) return null
  const iAmA = match.session_id_a === sessionId
  const iAccepted =
    match.status === 'mutual' ||
    (iAmA && match.status === 'pending_b') ||
    (!iAmA && match.status === 'pending_a')
  return { ...match, iAmA, iAccepted }
}

export type HistoryEntry = {
  id: string
  flight_iata: string | null
  origin_iata: string | null
  destination_iata: string | null
  departure_time: string | null
  connection_intent: string | null
  status: string
  upcoming: boolean
  outcome: 'met' | 'matched' | 'no_match' | 'live'
}

export async function getSessionHistory(limit = 60): Promise<HistoryEntry[]> {
  const userId = await requireUserId()
  if (!userId) return []
  const { data: rows } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  const sessions = (rows ?? []).map(r => toSession(r as unknown as RawSessionRow))
  if (sessions.length === 0) return []

  const orClause = sessions
    .flatMap(s => [`session_id_a.eq.${s.id}`, `session_id_b.eq.${s.id}`])
    .join(',')
  const { data: matches } = await supabase
    .from('matches')
    .select('session_id_a, session_id_b, status')
    .or(orClause)

  const outcomeBySession = new Map<string, 'met' | 'matched'>()
  for (const m of matches ?? []) {
    for (const sid of [m.session_id_a, m.session_id_b]) {
      if (m.status === 'mutual') outcomeBySession.set(sid, 'met')
      else if (!outcomeBySession.has(sid)) outcomeBySession.set(sid, 'matched')
    }
  }

  const now = Date.now()
  return sessions.map(s => {
    const live =
      s.status === 'active' && !!s.expires_at && new Date(s.expires_at).getTime() > now
    // An archived session with a future flight was replaced — it belongs to
    // the past, not the upcoming list.
    const upcoming =
      s.status === 'active' &&
      !!s.departure_time && new Date(s.departure_time).getTime() > now
    return {
      id: s.id,
      flight_iata: s.flight_iata,
      origin_iata: s.origin_iata,
      destination_iata: s.destination_iata,
      departure_time: s.departure_time,
      connection_intent: s.connection_intent,
      status: s.status,
      upcoming,
      outcome: live ? 'live' : (outcomeBySession.get(s.id) ?? 'no_match'),
    }
  })
}
