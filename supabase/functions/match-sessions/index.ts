import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ABLY_KEY = Deno.env.get('ABLY_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// ── Terminal reachability (inlined from lib/airports.ts for Deno) ──────────────

const REACHABILITY: Record<string, Record<string, string[]>> = {
  ATL: {
    T: ['T','A','B','C','D','E','F'], A: ['T','A','B','C','D','E','F'],
    B: ['T','A','B','C','D','E','F'], C: ['T','A','B','C','D','E','F'],
    D: ['T','A','B','C','D','E','F'], E: ['T','A','B','C','D','E','F'],
    F: ['T','A','B','C','D','E','F'],
  },
  LAX: {
    '1': ['1','2','3','TBIT'], '2': ['1','2','3','TBIT'],
    '3': ['1','2','3','TBIT'], 'TBIT': ['1','2','3','TBIT'],
    '4': ['4','5','6','7','8'], '5': ['4','5','6','7','8'],
    '6': ['4','5','6','7','8'], '7': ['4','5','6','7','8'],
    '8': ['4','5','6','7','8'],
  },
  ORD: {
    '1': ['1','2','3'], '2': ['1','2','3'], '3': ['1','2','3'], '5': ['5'],
  },
  DFW: {
    A: ['A','B','C','D','E'], B: ['A','B','C','D','E'],
    C: ['A','B','C','D','E'], D: ['A','B','C','D','E'], E: ['A','B','C','D','E'],
  },
  DEN: { A: ['A','B','C'], B: ['A','B','C'], C: ['A','B','C'] },
  JFK: {
    '1':['1'],'2':['2'],'3':['3'],'4':['4'],
    '5':['5'],'6':['6'],'7':['7'],'8':['8'],
  },
  SFO: {
    '1':['1','2','3','I'],'2':['1','2','3','I'],
    '3':['1','2','3','I'],'I':['1','2','3','I'],
  },
  SEA: {
    Main: ['Main','Satellite'], Satellite: ['Main','Satellite'],
    N: ['Main','Satellite'], S: ['Main','Satellite'],
  },
  LAS: { '1':['1'], '3':['3'], D:['D'], E:['E'] },
  MCO: { A:['A','B','C'], B:['A','B','C'], C:['A','B','C'] },
}

function getReachableTerminals(airportIata: string, terminal: string): string[] {
  const map = REACHABILITY[airportIata.toUpperCase()]
  if (!map) return [terminal]
  const norm = terminal.toUpperCase().trim()
  return map[norm] ?? [norm]
}

function terminalsReachable(airport: string, tA: string | null, tB: string | null): boolean {
  if (!tA || !tB) return true  // unknown terminal → don't filter out
  const reachable = getReachableTerminals(airport, tA)
  return reachable.includes(tB.toUpperCase().trim())
}

// ── Intent compatibility ───────────────────────────────────────────────────────

function intentsCompatible(a: string, b: string): boolean {
  if (a === 'open' || b === 'open') return true
  return a === b
}

// ── Tellability scoring ────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  first_name: string | null
  current_thinking: string | null
  industry: string | null
  company: string | null
  school: string | null
  hometown: string | null
  base_city: string | null
  career_stage: string | null
  travel_style: string | null
}

interface SessionRecord {
  id: string
  user_id: string
  origin_iata: string
  destination_iata: string | null
  departure_time: string | null
  terminal: string | null
  connection_intent: string
  travel_purpose: string | null
  event_id: string | null
  users: UserProfile
}

interface Signal {
  type: string
  tier: number
  points: number
  label: string
}

interface ScoreResult {
  score: number
  best_signal: Signal | null
  breakdown: Signal[]
}

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim()
}

function scoreCandidate(me: SessionRecord, them: SessionRecord): ScoreResult {
  const signals: Signal[] = []

  const myUser = me.users
  const theirUser = them.users

  // Tier 1 — 5 pts each
  if (me.event_id && them.event_id && norm(me.event_id) === norm(them.event_id)) {
    signals.push({ type: 'same_event', tier: 1, points: 5, label: `attending ${me.event_id}` })
  }
  if (norm(myUser.school) && norm(myUser.school) === norm(theirUser.school)) {
    signals.push({ type: 'same_school', tier: 1, points: 5, label: `went to ${myUser.school}` })
  }
  if (norm(myUser.hometown) && norm(myUser.hometown) === norm(theirUser.hometown)) {
    signals.push({ type: 'same_hometown', tier: 1, points: 5, label: `from ${myUser.hometown}` })
  }

  // Tier 2 — 3 pts each
  if (norm(myUser.company) && norm(myUser.company) === norm(theirUser.company)) {
    signals.push({ type: 'same_company', tier: 2, points: 3, label: `works at ${myUser.company}` })
  }
  if (norm(myUser.base_city) && norm(myUser.base_city) === norm(theirUser.base_city)) {
    signals.push({ type: 'same_base_city', tier: 2, points: 3, label: `based in ${myUser.base_city}` })
  }
  if (me.destination_iata && them.destination_iata && me.destination_iata === them.destination_iata) {
    signals.push({ type: 'same_destination', tier: 2, points: 3, label: `both flying to ${me.destination_iata}` })
  }

  // Tier 3 — 2 pts each
  if (norm(myUser.industry) && norm(myUser.industry) === norm(theirUser.industry)) {
    signals.push({ type: 'same_industry', tier: 3, points: 2, label: `both in ${myUser.industry}` })
  }
  if (myUser.career_stage && myUser.career_stage === theirUser.career_stage) {
    signals.push({ type: 'same_career_stage', tier: 3, points: 2, label: `both ${myUser.career_stage}` })
  }

  // Tier 3 asymmetry signals — 2 pts each
  if (norm(myUser.company) && norm(theirUser.industry) && norm(myUser.industry) !== norm(theirUser.industry)) {
    // One is a founder, other isn't — interesting asymmetry
    if (myUser.career_stage === 'founder' || theirUser.career_stage === 'founder') {
      signals.push({ type: 'founder_asymmetry', tier: 3, points: 2, label: 'founder meets non-founder' })
    }
  }
  if (myUser.career_stage && theirUser.career_stage) {
    const seniority = ['student','early','mid','senior','founder','executive']
    const iMe = seniority.indexOf(myUser.career_stage)
    const iThem = seniority.indexOf(theirUser.career_stage)
    if (Math.abs(iMe - iThem) >= 2) {
      signals.push({ type: 'career_asymmetry', tier: 3, points: 2, label: 'different career levels' })
    }
  }

  // Tier 4 — 1 pt each
  if (me.travel_purpose && them.travel_purpose && me.travel_purpose === them.travel_purpose) {
    signals.push({ type: 'same_travel_purpose', tier: 4, points: 1, label: `both ${me.travel_purpose}` })
  }
  if (myUser.travel_style && myUser.travel_style === theirUser.travel_style) {
    signals.push({ type: 'same_travel_style', tier: 4, points: 1, label: `both ${myUser.travel_style} travelers` })
  }

  if (signals.length === 0) {
    return { score: 0, best_signal: null, breakdown: [] }
  }

  // Best single signal (sort by tier asc, then points desc)
  const sorted = [...signals].sort((a, b) => a.tier - b.tier || b.points - a.points)
  const best = sorted[0]

  // Total score = best signal + 1pt per additional signal (depth bonus)
  const additionalBonus = Math.min(signals.length - 1, 3)
  const score = best.points + additionalBonus

  return { score, best_signal: best, breakdown: signals }
}

// ── Claude API — point-of-connection sentence ──────────────────────────────────

async function generatePointOfConnection(
  meFirst: string,
  themFirst: string,
  bestSignalLabel: string,
  destination: string | null,
): Promise<string> {
  const prompt = `You are writing a one-sentence intro for a proximity networking app for air travelers.

Write a single warm, specific sentence (under 20 words) explaining why ${meFirst} and ${themFirst} should meet before their flight. Base it on this shared signal: "${bestSignalLabel}".${destination ? ` They're both heading to ${destination}.` : ''}

Rules:
- One sentence only. No quotes. No filler like "I think" or "It seems".
- Mention the shared signal specifically.
- Warm but not sycophantic.
- Example: "You both went to UT Austin — rare to find another Longhorn mid-flight."`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude API error (${res.status}): ${t}`)
  }

  const json = await res.json()
  return (json.content?.[0]?.text ?? '').trim()
}

// ── Ably publish ───────────────────────────────────────────────────────────────

async function publishToAbly(userId: string, eventName: string, data: unknown) {
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
      body: JSON.stringify({ name: eventName, data }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ably publish failed (${res.status}): ${text}`)
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const body = await req.json()

    // Supports both webhook trigger (body.record) and direct call (body itself)
    const record = body.record ?? body
    const sessionId: string = record.id
    const userId: string = record.user_id
    const originIata: string = record.origin_iata
    const myTerminal: string | null = record.terminal ?? null
    const myDepartureTime: string | null = record.departure_time ?? null
    const intent: string = record.connection_intent
    const isCuriosityMode: boolean = body.curiosity_mode === true

    // ── Stage 1: find candidates ───────────────────────────────────────────────

    // 90-minute window around my departure time
    const windowMs = 90 * 60 * 1000
    const myDep = myDepartureTime ? new Date(myDepartureTime) : null
    const windowStart = myDep ? new Date(myDep.getTime() - windowMs).toISOString() : null
    const windowEnd   = myDep ? new Date(myDep.getTime() + windowMs).toISOString() : null

    let candidateQuery = supabase
      .from('sessions')
      .select(`
        id, user_id, origin_iata, destination_iata, departure_time,
        terminal, connection_intent, travel_purpose, event_id,
        users (
          id, first_name, current_thinking, industry, company,
          school, hometown, base_city, career_stage, travel_style
        )
      `)
      .eq('origin_iata', originIata)
      .neq('user_id', userId)
      .neq('id', sessionId)

    if (windowStart && windowEnd) {
      candidateQuery = candidateQuery
        .gte('departure_time', windowStart)
        .lte('departure_time', windowEnd)
    }

    const { data: rawCandidates, error: candidatesErr } = await candidateQuery
    if (candidatesErr) throw candidatesErr

    const candidates = (rawCandidates ?? []) as unknown as SessionRecord[]

    // Filter: terminal reachable + intent compatible
    const stage1 = candidates.filter(c => {
      if (!intentsCompatible(intent, c.connection_intent)) return false
      if (!terminalsReachable(originIata, myTerminal, c.terminal)) return false
      return true
    })

    if (stage1.length === 0) {
      if (isCuriosityMode) {
        await publishToAbly(userId, 'pool.exhausted', {})
      }
      return new Response(JSON.stringify({ matched: false, reason: 'no stage1 candidates' }), { status: 200 })
    }

    // Exclude sessions already matched or declined with me
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('session_id_a, session_id_b, status')
      .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)

    const excludedSessionIds = new Set<string>(
      (existingMatches ?? []).flatMap(m => [m.session_id_a, m.session_id_b])
    )

    const available = stage1.filter(c => !excludedSessionIds.has(c.id))

    if (available.length === 0) {
      await publishToAbly(userId, 'pool.exhausted', {})
      return new Response(JSON.stringify({ matched: false, reason: 'pool exhausted' }), { status: 200 })
    }

    // ── Stage 2: score all candidates ─────────────────────────────────────────

    const mySession: SessionRecord = {
      id: sessionId,
      user_id: userId,
      origin_iata: originIata,
      destination_iata: record.destination_iata ?? null,
      departure_time: myDepartureTime,
      terminal: myTerminal,
      connection_intent: intent,
      travel_purpose: record.travel_purpose ?? null,
      event_id: record.event_id ?? null,
      users: {
        id: userId,
        first_name: null,
        current_thinking: null,
        industry: null,
        company: null,
        school: null,
        hometown: null,
        base_city: null,
        career_stage: null,
        travel_style: null,
      },
    }

    // Fetch my own user profile
    const { data: myUserData } = await supabase
      .from('users')
      .select('id, first_name, current_thinking, industry, company, school, hometown, base_city, career_stage, travel_style')
      .eq('id', userId)
      .single()

    if (myUserData) mySession.users = myUserData

    const poolSize = available.length

    const scored = available.map(c => ({
      session: c,
      result: scoreCandidate(mySession, c),
    })).sort((a, b) => b.result.score - a.result.score)

    const best = scored[0]
    const HIGH_CONFIDENCE_THRESHOLD = 3

    if (!isCuriosityMode && best.result.score < HIGH_CONFIDENCE_THRESHOLD) {
      // Let pg_cron handle the curiosity retry later
      return new Response(JSON.stringify({ matched: false, reason: 'score below threshold', score: best.result.score }), { status: 200 })
    }

    // ── Create the match ───────────────────────────────────────────────────────

    const partner = best.session
    const bestSignal = best.result.best_signal
    const matchType = isCuriosityMode ? 'curiosity' : 'high_confidence'

    let pointOfConnection: string | null = null
    if (bestSignal && !isCuriosityMode) {
      try {
        const myFirst = mySession.users.first_name ?? 'you'
        const theirFirst = partner.users.first_name ?? 'them'
        const dest = partner.destination_iata ?? null
        pointOfConnection = await generatePointOfConnection(myFirst, theirFirst, bestSignal.label, dest)
      } catch (e) {
        console.error('Claude API failed, continuing without sentence:', e)
      }
    }

    const { data: matchRow, error: matchErr } = await supabase
      .from('matches')
      .insert({
        session_id_a: sessionId,
        session_id_b: partner.id,
        status: 'pending',
        match_type: matchType,
        point_of_connection: pointOfConnection,
        winning_signal_type: bestSignal?.type ?? null,
        winning_signal_score: best.result.score,
        pool_size_at_match: poolSize,
        signal_breakdown: best.result.breakdown,
      })
      .select('id')
      .single()

    if (matchErr) throw matchErr

    const eventName = isCuriosityMode ? 'curiosity.match' : 'match.created'
    const payload = {
      match_id: matchRow.id,
      match_type: matchType,
      point_of_connection: pointOfConnection,
      winning_signal: bestSignal?.label ?? null,
    }

    await Promise.all([
      publishToAbly(userId, eventName, payload),
      publishToAbly(partner.user_id, eventName, payload),
    ])

    return new Response(JSON.stringify({ matched: true, match_id: matchRow.id, match_type: matchType, score: best.result.score }), { status: 200 })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('match-sessions error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
})
