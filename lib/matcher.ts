import { supabase } from './supabase'
import type { Session } from './session'

// The one way the client invokes the match-sessions edge function.
// The DB is the source of truth for match state; this helper just asks the
// matcher to run and reports what it said. It never throws — network and
// function failures come back as { error } so callers can't crash the
// searching loop. Requires an authenticated Supabase session (the JWT is
// forwarded explicitly; the token itself is never logged).

export type MatcherResult =
  | {
      matched: true
      match_id: string
      session_id_a: string
      session_id_b: string
      suggested_meetup_location: string | null
    }
  | { matched: false; reason: string; match_id?: string | null }
  | { error: string; debug_code?: string }

export async function requestMatch(
  session: Session,
  opts?: { curiosity?: boolean }
): Promise<MatcherResult> {
  const { data: { session: auth } } = await supabase.auth.getSession()
  if (!auth?.access_token) {
    console.warn('[matcher] skipped: no Supabase session')
    return { error: 'not_authenticated', debug_code: 'no_client_session' }
  }

  // The matcher consumes the session row fields; flight_iata is a client-side
  // join artifact it doesn't know about.
  const { flight_iata: _f, ...body } = session as unknown as Record<string, unknown>
  if (opts?.curiosity) body.curiosity_mode = true

  console.log(`[matcher] invoking for session ${session.id}${opts?.curiosity ? ' (curiosity)' : ''} (auth token present)`)

  try {
    const { data, error } = await supabase.functions.invoke('match-sessions', {
      body,
      headers: { Authorization: `Bearer ${auth.access_token}` },
    })

    if (error) {
      let detail: unknown = data
      const ctx = (error as unknown as { context?: Response }).context
      if (ctx instanceof Response) {
        try { detail = await ctx.clone().json() } catch { /* non-JSON body */ }
      }
      console.error('[matcher] edge function error:', error.message, JSON.stringify(detail))
      return { error: error.message, debug_code: 'edge_function_error' }
    }

    // Defensive parse: older deploys returned JSON without a Content-Type
    // header, which supabase-js hands back as a raw string.
    const result = (typeof data === 'string' ? JSON.parse(data) : data) as MatcherResult
    if ('matched' in result) {
      console.log(
        result.matched
          ? `[matcher] matched → ${result.match_id}`
          : `[matcher] no match: ${result.reason}${'match_id' in result && result.match_id ? ` (match ${result.match_id})` : ''}`
      )
    } else if ('error' in result) {
      console.error('[matcher] returned error:', result.error, result.debug_code)
    }
    return result
  } catch (e) {
    console.error('[matcher] invoke threw:', e)
    return { error: e instanceof Error ? e.message : String(e), debug_code: 'network_failure' }
  }
}
