import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ABLY_KEY = Deno.env.get('ABLY_KEY')!

function intentsCompatible(a: string, b: string): boolean {
  if (a === 'open' || b === 'open') return true
  return a === b
}

async function publishToAbly(userId: string, matchId: string) {
  const channelName = `user:${userId}`
  const [keyId, keySecret] = ABLY_KEY.split(':')
  const credentials = btoa(`${keyId}:${keySecret}`)

  const res = await fetch(
    `https://rest.ably.io/channels/${encodeURIComponent(channelName)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'match.created', data: { match_id: matchId } }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ably publish failed (${res.status}): ${text}`)
  }
}

Deno.serve(async (req) => {
  try {
    const { record } = await req.json()
    const sessionId: string = record.id
    const userId: string = record.user_id
    const flightId: string = record.flight_id
    const intent: string = record.connection_intent

    // Find other active sessions on the same flight
    const { data: candidates, error: candidatesErr } = await supabase
      .from('sessions')
      .select('id, user_id, connection_intent')
      .eq('flight_id', flightId)
      .neq('user_id', userId)
      .neq('id', sessionId)

    if (candidatesErr) throw candidatesErr
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: 'no candidates' }), { status: 200 })
    }

    // Filter by compatible intent
    const compatible = candidates.filter(c => intentsCompatible(intent, c.connection_intent))
    if (compatible.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: 'no compatible intent' }), { status: 200 })
    }

    // Exclude candidates already matched with this user
    const { data: existing } = await supabase
      .from('matches')
      .select('session_id_a, session_id_b')
      .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)

    const alreadyMatchedSessionIds = new Set(
      (existing ?? []).flatMap(m => [m.session_id_a, m.session_id_b])
    )

    const available = compatible.filter(c => !alreadyMatchedSessionIds.has(c.id))
    if (available.length === 0) {
      return new Response(JSON.stringify({ matched: false, reason: 'all candidates already matched' }), { status: 200 })
    }

    const partner = available[0]

    // Create match row
    const { data: matchRow, error: matchErr } = await supabase
      .from('matches')
      .insert({ session_id_a: sessionId, session_id_b: partner.id, status: 'pending' })
      .select('id')
      .single()

    if (matchErr) throw matchErr

    // Notify both users on their personal Ably channels
    await Promise.all([
      publishToAbly(userId, matchRow.id),
      publishToAbly(partner.user_id, matchRow.id),
    ])

    return new Response(JSON.stringify({ matched: true, match_id: matchRow.id }), { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
})
