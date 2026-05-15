import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)


const ABLY_KEY = Deno.env.get('ABLY_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

// ── Terminal reachability ──────────────────────────────────────────────────────

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

function terminalsReachable(airport: string, tA: string | null, tB: string | null): boolean {
  if (!tA || !tB) return true
  const map = REACHABILITY[airport.toUpperCase()]
  if (!map) return true
  const normA = tA.toUpperCase().trim()
  const normB = tB.toUpperCase().trim()
  return (map[normA] ?? [normA]).includes(normB)
}

function intentsCompatible(a: string, b: string): boolean {
  if (a === 'open' || b === 'open') return true
  return a === b
}

// ── Scoring ───────────────────────────────────────────────────────────────────

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
  spotify_top_artists: string[] | null
}

interface SessionRecord {
  id: string
  user_id: string
  origin_iata: string
  destination_iata: string | null
  departure_time: string | null
  created_at: string | null // Fix 8: needed for recency tiebreaker
  terminal: string | null
  connection_intent: string
  travel_purpose: string | null
  event_id: string | null
  users: UserProfile
  flights?: { flight_iata: string } | { flight_iata: string }[] | null
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

function scoreCandidate(me: SessionRecord, them: SessionRecord, myFlightIata?: string): ScoreResult {
  const signals: Signal[] = []
  const myUser = me.users
  const theirUser = them.users

  // ── Tier 1 — 5 pts — high specificity proper-noun signals ─────────────────

  // Same physical flight: strongest possible proximity signal. Two users on the
  // exact same aircraft have guaranteed co-presence, so this is tier-1 even
  // though the algorithm generally treats flights as context. Without this
  // signal, two flights leaving at the same time are indistinguishable.
  const theirFlightRecord = Array.isArray(them.flights) ? them.flights[0] : them.flights
  const theirFlightIata = theirFlightRecord?.flight_iata
  if (myFlightIata && theirFlightIata && myFlightIata === theirFlightIata) {
    signals.push({ type: 'same_flight', tier: 1, points: 5, label: `both on flight ${myFlightIata}` })
  }

  if (me.event_id && them.event_id && norm(me.event_id) === norm(them.event_id)) {
    signals.push({ type: 'same_event', tier: 1, points: 5, label: `attending ${me.event_id}` })
  }
  if (norm(myUser.school) && norm(myUser.school) === norm(theirUser.school)) {
    signals.push({ type: 'same_school', tier: 1, points: 5, label: `went to ${myUser.school}` })
  }
  if (norm(myUser.hometown) && norm(myUser.hometown) === norm(theirUser.hometown)) {
    signals.push({ type: 'same_hometown', tier: 1, points: 5, label: `from ${myUser.hometown}` })
  }

  // ── Tier 2 — 3 pts — organization-level specificity ───────────────────────
  if (norm(myUser.company) && norm(myUser.company) === norm(theirUser.company)) {
    signals.push({ type: 'same_company', tier: 2, points: 3, label: `works at ${myUser.company}` })
  }

  // ── Tier 3 — 2 pts — meaningful overlap, not rare enough alone ────────────
  // NOTE: same_destination and same_base_city intentionally moved here from
  // tier 2. At busy hubs (JFK, LAX) these fire too frequently to warrant a
  // high-confidence match on their own — they need at least one other signal.
  if (me.destination_iata && them.destination_iata && me.destination_iata === them.destination_iata) {
    signals.push({ type: 'same_destination', tier: 3, points: 2, label: `both flying to ${me.destination_iata}` })
  }
  if (norm(myUser.base_city) && norm(myUser.base_city) === norm(theirUser.base_city)) {
    signals.push({ type: 'same_base_city', tier: 3, points: 2, label: `based in ${myUser.base_city}` })
  }
  if (norm(myUser.industry) && norm(myUser.industry) === norm(theirUser.industry)) {
    signals.push({ type: 'same_industry', tier: 3, points: 2, label: `both in ${myUser.industry}` })
  }
  if (myUser.career_stage && myUser.career_stage === theirUser.career_stage) {
    signals.push({ type: 'same_career_stage', tier: 3, points: 2, label: `both ${myUser.career_stage}` })
  }

  // Asymmetry signals — interesting cross-pollination.
  // Fix 4: career_asymmetry is skipped when founder_asymmetry fires — both
  // describe the same seniority gap, and stacking them inflates the score by 4pts
  // for a single underlying observation.
  const oneIsFounder = (myUser.career_stage === 'founder') !== (theirUser.career_stage === 'founder')
  if (oneIsFounder) {
    signals.push({ type: 'founder_asymmetry', tier: 3, points: 2, label: 'founder meets operator' })
  } else if (myUser.career_stage && theirUser.career_stage) {
    const seniority = ['student','early','mid','senior','founder','executive']
    const iMe = seniority.indexOf(myUser.career_stage)
    const iThem = seniority.indexOf(theirUser.career_stage)
    if (iMe !== -1 && iThem !== -1 && Math.abs(iMe - iThem) >= 2) {
      signals.push({ type: 'career_asymmetry', tier: 3, points: 2, label: 'different career levels' })
    }
  }

  // ── Tier 3 (continued) — music taste ─────────────────────────────────────
  if (myUser.spotify_top_artists && theirUser.spotify_top_artists) {
    const mySet = new Set<string>(myUser.spotify_top_artists)
    const shared = theirUser.spotify_top_artists.filter(a => mySet.has(a))
    if (shared.length >= 2) {
      signals.push({ type: 'same_music_taste', tier: 3, points: 2, label: `both listen to ${shared[0]}` })
    }
  }

  // ── Tier 4 — 1 pt — soft context signals ──────────────────────────────────
  if (me.travel_purpose && them.travel_purpose && me.travel_purpose === them.travel_purpose) {
    signals.push({ type: 'same_travel_purpose', tier: 4, points: 1, label: `both ${me.travel_purpose}` })
  }
  if (myUser.travel_style && myUser.travel_style === theirUser.travel_style) {
    signals.push({ type: 'same_travel_style', tier: 4, points: 1, label: `both ${myUser.travel_style} travelers` })
  }

  if (signals.length === 0) {
    return { score: 0, best_signal: null, breakdown: [] }
  }

  // Best single signal drives the headline; additional signals add depth bonus.
  // TODO: QUALITY_THRESHOLD may need tuning as signal corpus grows.
  const sorted = [...signals].sort((a, b) => a.tier - b.tier || b.points - a.points)
  const best = sorted[0]
  const additionalBonus = Math.min(signals.length - 1, 3)
  const score = best.points + additionalBonus

  return { score, best_signal: best, breakdown: signals }
}

// ── Claude — point-of-connection sentence ─────────────────────────────────────

async function generatePointOfConnection(
  bestSignalLabel: string,
  destination: string | null,
): Promise<string> {
  const prompt = `You are writing display copy for a proximity-networking app used by air travelers at airports.

Write a single punchy sentence (under 18 words) that a traveler would see on their phone describing WHY they should meet a stranger nearby. The shared reason is: "${bestSignalLabel}".${destination ? ` Both are heading to ${destination}.` : ''}

Rules:
- One sentence only. No quotes. No filler ("I think", "It seems", "You might").
- Lead with the shared signal — make it specific and concrete.
- Warm, direct tone. Not sycophantic. Not corporate.
- No names. The app hides names until both users agree.
- Good example: "You both went to UT Austin — rare to find another Longhorn mid-flight."
- Good example: "Both in fintech, both heading to SF — the overlap is too clean to ignore."

Respond with only the sentence.`

  // Fix 7: race Claude against a 4-second timeout so a slow or degraded Anthropic
  // API doesn't block the match — the match surfaces without a phrasing sentence.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Claude API timeout after 4s')), 4000)
  )

  const claudeFetch = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const res = await Promise.race([claudeFetch, timeout])

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude API error (${res.status}): ${t}`)
  }

  const json = await res.json()
  return (json.content?.[0]?.text ?? '').trim()
}

// ── Ably ──────────────────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const record = body.record ?? body

    // ── Input validation ────────────────────────────────────────────────────
    const sessionId: string = record.id
    const userId: string = record.user_id
    const originIata: string = record.origin_iata
    const myTerminal: string | null = record.terminal ?? null
    const myDepartureTime: string | null = record.departure_time ?? null
    const intent: string = record.connection_intent
    const isCuriosityMode: boolean = body.curiosity_mode === true

    // Both users must have been waiting at least this long before a curiosity
    // match can fire. The framing is "we haven't found you a fit yet — be open
    // to something unexpected" — that only lands if both people are genuinely
    // in that holding pattern, not one impatient person paired with a fresh
    // arrival. See matching_algorithm.md §7.
    const CURIOSITY_MIN_WAIT_MS = 15 * 1000

    if (!sessionId || !userId || !originIata || !intent) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: id, user_id, origin_iata, connection_intent' }),
        { status: 400 }
      )
    }

    // In curiosity mode, verify the requester has actually been waiting ≥ 15s
    // server-side, regardless of what the client claims. Cheap single-row query.
    if (isCuriosityMode) {
      const { data: requesterSession } = await supabase
        .from('sessions')
        .select('created_at')
        .eq('id', sessionId)
        .maybeSingle()

      const requesterCreatedAt = requesterSession?.created_at
        ? new Date(requesterSession.created_at as string).getTime()
        : null

      if (!requesterCreatedAt || Date.now() - requesterCreatedAt < CURIOSITY_MIN_WAIT_MS) {
        return new Response(
          JSON.stringify({ matched: false, reason: 'curiosity: requester has not waited 15s' }),
          { status: 200 }
        )
      }
    }

    // ── Stage 1: find candidates ─────────────────────────────────────────────
    const windowMs = 90 * 60 * 1000
    const myDep = myDepartureTime ? new Date(myDepartureTime) : null
    const windowStart = myDep ? new Date(myDep.getTime() - windowMs).toISOString() : null
    const windowEnd   = myDep ? new Date(myDep.getTime() + windowMs).toISOString() : null

    // Fix 2: order by created_at DESC before limit so the most recently active
    // sessions are seen first — prevents arbitrary heap-order rows from hiding
    // better matches beyond the 200-row ceiling at busy hubs.
    let candidateQuery = supabase
      .from('sessions')
      .select(`
        id, user_id, origin_iata, destination_iata, departure_time, created_at,
        terminal, connection_intent, travel_purpose, event_id,
        flights!flight_id (flight_iata),
        users (
          id, first_name, current_thinking, industry, company,
          school, hometown, base_city, career_stage, travel_style, spotify_top_artists
        )
      `)
      .eq('origin_iata', originIata)
      .eq('status', 'active')
      .neq('user_id', userId)
      .neq('id', sessionId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (windowStart && windowEnd) {
      candidateQuery = candidateQuery
        .gte('departure_time', windowStart)
        .lte('departure_time', windowEnd)
    }

    const { data: rawCandidates, error: candidatesErr } = await candidateQuery
    if (candidatesErr) throw candidatesErr

    const candidates = (rawCandidates ?? []) as unknown as SessionRecord[]

    // Terminal reachable + intent compatible
    const stage1 = candidates.filter(c =>
      intentsCompatible(intent, c.connection_intent) &&
      terminalsReachable(originIata, myTerminal, c.terminal)
    )

    // Always send pool.exhausted when no one is at the airport — regardless of mode
    if (stage1.length === 0) {
      await publishToAbly(userId, 'pool.exhausted', {})
      return new Response(JSON.stringify({ matched: false, reason: 'no stage1 candidates' }), { status: 200 })
    }

    // ── Parallel DB lookups ───────────────────────────────────────────────────
    // Fix 5: myMatches, pendingMatches, myUserData, and myFlight are all
    // independent — running them in parallel saves ~60–120ms per invocation.
    const myFlightPromise = record.flight_id
      ? supabase.from('flights').select('flight_iata').eq('id', record.flight_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [
      { data: myMatches },
      { data: pendingMatches },
      { data: myUserData },
      { data: myFlightData },
    ] = await Promise.all([
      // Sessions already in any match with ME (pending, accepted, or declined)
      supabase
        .from('matches')
        .select('session_id_a, session_id_b')
        .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`),

      // Fix 1: scope pending-match scan to this airport — prevents a full table
      // scan that returns every pending match globally on every invocation.
      // Include pending_a and pending_b: a session that one side already accepted
      // should not be re-matched with a third party until the pair resolves.
      supabase
        .from('matches')
        .select('session_id_a, session_id_b')
        .in('status', ['pending', 'pending_a', 'pending_b'])
        .eq('origin_iata', originIata)
        .limit(500),

      // My profile for scoring
      supabase
        .from('users')
        .select('id, first_name, current_thinking, industry, company, school, hometown, base_city, career_stage, travel_style, spotify_top_artists')
        .eq('id', userId)
        .single(),

      // Fix 6: initiator's flight_iata for curiosity-mode partner payload
      myFlightPromise,
    ])

    const myFlightIata: string = (myFlightData as { flight_iata?: string } | null)?.flight_iata ?? ''

    // ── Exclude already-matched or already-seen sessions ─────────────────────
    type MatchPair = { session_id_a: string; session_id_b: string }

    const excludedByMe = new Set<string>(
      (myMatches ?? []).flatMap((m: MatchPair) => [m.session_id_a, m.session_id_b])
    )

    // Sessions already locked in a pending match with someone else.
    // Prevents two users from simultaneously being matched to the same third party.
    const lockedInPending = new Set<string>(
      (pendingMatches ?? []).flatMap((m: MatchPair) => [m.session_id_a, m.session_id_b])
    )

    let available = stage1.filter(c =>
      !excludedByMe.has(c.id) && !lockedInPending.has(c.id)
    )

    if (available.length === 0) {
      // Don't fire pool.exhausted from the curiosity probe — it isn't really
      // "no one's here," it's "no one new since the last probe." The user's
      // earlier high-confidence search already drove that signal if relevant.
      if (!isCuriosityMode) {
        await publishToAbly(userId, 'pool.exhausted', {})
      }
      return new Response(JSON.stringify({ matched: false, reason: 'pool exhausted' }), { status: 200 })
    }

    // Curiosity mode: only candidates who have also been waiting ≥ 90s are
    // eligible. One impatient person paired with a fresh arrival defeats the
    // whole "we've both been waiting, let's be open to each other" framing.
    if (isCuriosityMode) {
      const cutoff = Date.now() - CURIOSITY_MIN_WAIT_MS
      available = available.filter(c => {
        if (!c.created_at) return false
        return new Date(c.created_at).getTime() <= cutoff
      })
      if (available.length === 0) {
        return new Response(
          JSON.stringify({ matched: false, reason: 'curiosity: no candidate has waited 90s' }),
          { status: 200 }
        )
      }
    }

    // ── Stage 2: score all candidates ────────────────────────────────────────
    const mySession: SessionRecord = {
      id: sessionId,
      user_id: userId,
      origin_iata: originIata,
      destination_iata: record.destination_iata ?? null,
      departure_time: myDepartureTime,
      created_at: null,
      terminal: myTerminal,
      connection_intent: intent,
      travel_purpose: record.travel_purpose ?? null,
      event_id: record.event_id ?? null,
      users: myUserData ?? {
        id: userId, first_name: null, current_thinking: null, industry: null,
        company: null, school: null, hometown: null, base_city: null,
        career_stage: null, travel_style: null,
      },
    }

    const poolSize = available.length

    console.log(`[match] scoring ${poolSize} candidates for session ${sessionId} (flight=${myFlightIata || 'none'})`)

    // Fix 8: break score ties by signal specificity (lower tier = more specific
    // signal wins), then by session recency (newer session wins) — prevents
    // systematic bias toward the earliest-inserted sessions at busy hubs.
    const scored = available
      .map(c => {
        const result = scoreCandidate(mySession, c, myFlightIata || undefined)
        console.log(`[match] candidate ${c.id} score=${result.score} best=${result.best_signal?.type ?? 'none'} breakdown=${JSON.stringify(result.breakdown.map(s => s.type))}`)
        return { session: c, result }
      })
      .sort((a, b) => {
        if (b.result.score !== a.result.score) return b.result.score - a.result.score
        const tierA = a.result.best_signal?.tier ?? 99
        const tierB = b.result.best_signal?.tier ?? 99
        if (tierA !== tierB) return tierA - tierB
        return (
          new Date(b.session.created_at ?? 0).getTime() -
          new Date(a.session.created_at ?? 0).getTime()
        )
      })

    const best = scored[0]
    // TODO: QUALITY_THRESHOLD may need tuning as real-world signal corpus grows
    const HIGH_CONFIDENCE_THRESHOLD = 3

    console.log(`[match] best candidate score=${best.result.score} threshold=${HIGH_CONFIDENCE_THRESHOLD} curiosity=${isCuriosityMode}`)

    if (!isCuriosityMode && best.result.score < HIGH_CONFIDENCE_THRESHOLD) {
      console.log(`[match] score ${best.result.score} below threshold ${HIGH_CONFIDENCE_THRESHOLD} — no match`)
      return new Response(
        JSON.stringify({ matched: false, reason: 'score below threshold', score: best.result.score }),
        { status: 200 }
      )
    }

    // ── Race condition guard ──────────────────────────────────────────────────
    // Re-check right before insert that this pair hasn't been matched by a
    // concurrent invocation in the milliseconds since we queried above.
    const partner = best.session
    const { data: existingPair } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(session_id_a.eq.${sessionId},session_id_b.eq.${partner.id}),` +
        `and(session_id_a.eq.${partner.id},session_id_b.eq.${sessionId})`
      )
      .maybeSingle()

    if (existingPair) {
      return new Response(
        JSON.stringify({ matched: false, reason: 'match already created by concurrent invocation' }),
        { status: 200 }
      )
    }

    // ── Create match ─────────────────────────────────────────────────────────
    const bestSignal = best.result.best_signal
    const matchType = isCuriosityMode ? 'curiosity' : 'high_confidence'

    let pointOfConnection: string | null = null
    if (bestSignal && !isCuriosityMode) {
      try {
        pointOfConnection = await generatePointOfConnection(
          bestSignal.label,
          partner.destination_iata ?? null,
        )
      } catch (e) {
        console.error('Claude API failed, continuing without sentence:', e)
      }
    }

    const { data: matchRow, error: matchErr } = await supabase
      .from('matches')
      .insert({
        session_id_a: sessionId,
        session_id_b: partner.id,
        origin_iata: originIata, // Fix 1: denormalized so pending-match queries can filter by airport
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

    // Fix 3: catch the unique-constraint violation (Postgres error 23505) that
    // fires when the canonical-pair index blocks a duplicate A↔B insert from a
    // concurrent invocation — return gracefully instead of throwing a 500.
    if (matchErr) {
      if ((matchErr as unknown as { code?: string }).code === '23505') {
        console.log('[match] race condition — match already exists')
        return new Response(
          JSON.stringify({ matched: false, reason: 'race_condition' }),
          { status: 200 }
        )
      }
      throw matchErr
    }

    console.log(`[match] created match ${matchRow.id} type=${matchType} score=${best.result.score} signal=${bestSignal?.type}`)

    // Resolve partner's flight_iata for the stranger row on the manifest board
    const partnerFlight = Array.isArray(partner.flights) ? partner.flights[0] : partner.flights
    const partnerFlightIata = partnerFlight?.flight_iata ?? ''

    const eventName = isCuriosityMode ? 'curiosity.match' : 'match.created'
    const basePayload = { match_id: matchRow.id, match_type: matchType }
    const highConfidenceExtras = { point_of_connection: pointOfConnection }
    const curiosityExtras = {
      winning_signal: bestSignal?.label ?? null,
      flight_iata: partnerFlightIata,
      origin_iata: partner.origin_iata,
    }

    const payload = isCuriosityMode
      ? { ...basePayload, ...curiosityExtras }
      : { ...basePayload, ...highConfidenceExtras }

    await Promise.all([
      publishToAbly(userId, eventName, payload),
      // Fix 6: send initiator's real flight_iata to partner so their manifest board
      // stranger row shows a flight number instead of a blank string.
      publishToAbly(partner.user_id, eventName, {
        ...payload,
        ...(isCuriosityMode ? { origin_iata: originIata, flight_iata: myFlightIata } : {}),
      }),
    ])

    return new Response(
      JSON.stringify({ matched: true, match_id: matchRow.id, match_type: matchType, score: best.result.score }),
      { status: 200 }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('match-sessions error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
})
