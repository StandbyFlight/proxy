/**
 * Demo control panel — bypass the matching algorithm entirely.
 *
 * Three commands:
 *
 *   setup                 — create the demo partner user + session (run once before the meeting)
 *   match <your-email>    — fire the match notification to your phone (run when standby screen is showing)
 *   accept <match-id>     — partner accepts → your phone jumps to meetup screen
 *
 * Required env vars:
 *   SERVICE_ROLE_KEY   Supabase → Settings → API → service_role key
 *   ABLY_KEY           Supabase → Edge Functions → Secrets → ABLY_KEY  (only needed for 'match')
 *
 * Usage:
 *   SERVICE_ROLE_KEY=xxx ABLY_KEY=xxx npx tsx scripts/demo.ts setup
 *   SERVICE_ROLE_KEY=xxx ABLY_KEY=xxx npx tsx scripts/demo.ts match kumar.sutharsika@gmail.com
 *   SERVICE_ROLE_KEY=xxx             npx tsx scripts/demo.ts accept <match-id>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nbsuzowidjwmooxzuepp.supabase.co'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY
const ABLY_KEY = process.env.ABLY_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SERVICE_ROLE_KEY. Get it from Supabase → Settings → API → service_role')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Demo partner profile ─────────────────────────────────────────────────────
// Shown to whoever is holding the phone during the demo.
// Compelling for VC / early-stage investors — a founder heading to SF.

const PARTNER_EMAIL = 'demo-partner@standbytest.dev'

const PARTNER_PROFILE = {
  first_name: 'Jordan',
  age: 32,
  base_city: 'San Francisco',
  hometown: 'New York',
  industry: 'Tech',
  company: null as string | null,          // founder — no company name
  school: 'Stanford',
  career_stage: 'founder',
  travel_style: 'light_packer',
  current_thinking: 'Building in consumer social — working on the distribution problem.',
  phone: '+15550009999',
  email: PARTNER_EMAIL,
  email_verified: true,
}

// This sentence appears on the flip board on the match screen.
// Keep it punchy and VC-resonant.
const POINT_OF_CONNECTION =
  'Both focused on early-stage consumer tech — the kind of conversation that does not happen by accident.'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string)  { process.stdout.write(msg + '\n') }
function ok(msg: string)   { process.stdout.write(`  \x1b[32m✓\x1b[0m ${msg}\n`) }
function err(msg: string)  { process.stdout.write(`  \x1b[31m✗\x1b[0m ${msg}\n`); process.exit(1) }
function dim(msg: string)  { process.stdout.write(`  \x1b[2m${msg}\x1b[0m\n`) }
function bold(msg: string) { process.stdout.write(`\x1b[1m${msg}\x1b[0m\n`) }

// ─── Ably REST publish ────────────────────────────────────────────────────────

async function publishToAbly(userId: string, eventName: string, data: unknown) {
  if (!ABLY_KEY) {
    err('ABLY_KEY is required for this command. Get it from Supabase → Edge Functions → Secrets.')
  }
  const [keyId, keySecret] = ABLY_KEY!.split(':')
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const channelName = `user:${userId}`

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
    err(`Ably publish failed (${res.status}): ${text}`)
  }
}

// ─── setup ───────────────────────────────────────────────────────────────────
// Creates the demo partner user + a session that expires 48 hours from now.
// Safe to re-run — reuses an existing partner if already created.

async function setup() {
  bold('\n  STANDBY DEMO — setup\n')

  // ── Partner auth user ──────────────────────────────────────────────────────
  const { data: { users: existing } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const alreadyExists = existing.find(u => u.email === PARTNER_EMAIL)

  let partnerId: string

  if (alreadyExists) {
    partnerId = alreadyExists.id
    dim(`partner already exists (${partnerId}) — reusing`)
  } else {
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: PARTNER_EMAIL,
      email_confirm: true,
      user_metadata: { first_name: PARTNER_PROFILE.first_name },
    })
    if (authErr || !created.user) err(`auth create failed — ${authErr?.message}`)
    partnerId = created.user!.id

    const { error: profileErr } = await admin.from('users').upsert(
      { id: partnerId, ...PARTNER_PROFILE },
      { onConflict: 'id' }
    )
    if (profileErr) err(`profile upsert failed — ${profileErr.message}`)
    ok(`created partner user — ${PARTNER_PROFILE.first_name} (${partnerId})`)
  }

  // ── Flight placeholder ─────────────────────────────────────────────────────
  // We need a flight row for the session FK. Use a dedicated demo flight.
  const demoDate = new Date().toISOString().split('T')[0]
  const { data: flightRow, error: flightErr } = await admin
    .from('flights')
    .upsert({
      flight_iata: 'DEMO01',
      departure_date: demoDate,
      origin_iata: 'JFK',
      destination_iata: 'SFO',
      departure_scheduled: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      last_enriched_at: new Date().toISOString(),
    }, { onConflict: 'flight_iata,departure_date' })
    .select('id')
    .single()
  if (flightErr || !flightRow) err(`flight upsert failed — ${flightErr?.message}`)

  // ── Session ────────────────────────────────────────────────────────────────
  // Wipe any old session first so there's exactly one active one.
  await admin.from('sessions').delete().eq('user_id', partnerId)

  const { data: sessionRow, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      user_id: partnerId,
      flight_id: flightRow!.id,
      origin_iata: 'JFK',
      destination_iata: 'SFO',
      departure_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      terminal: null,           // null = bypass terminal reachability check
      gate: null,
      connection_intent: 'professional',
      travel_purpose: 'work_trip',
      event_id: null,
      status: 'active',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
  if (sessionErr || !sessionRow) err(`session create failed — ${sessionErr?.message}`)
  ok(`partner session created (${sessionRow!.id})`)

  log('')
  bold('  Ready. Now run:')
  log(`  SERVICE_ROLE_KEY=xxx ABLY_KEY=xxx npx tsx scripts/demo.ts match <your-email>`)
  log('')
}

// ─── match ────────────────────────────────────────────────────────────────────
// Insert a match row directly and fire the Ably push.
// Run this while the standby screen is showing on the demo phone.

async function match(yourEmail: string) {
  bold('\n  STANDBY DEMO — match\n')

  if (!yourEmail) err('Usage: demo.ts match <your-email>')

  // ── Look up the real user ──────────────────────────────────────────────────
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const yourAuthUser = authUsers.find(u => u.email === yourEmail)
  if (!yourAuthUser) err(`No auth user found for ${yourEmail}`)
  const yourUserId = yourAuthUser!.id
  dim(`your user ID: ${yourUserId}`)

  // ── Get your active session ────────────────────────────────────────────────
  const { data: yourSession, error: sessionErr } = await admin
    .from('sessions')
    .select('id, origin_iata')
    .eq('user_id', yourUserId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sessionErr) err(`session lookup error — ${sessionErr.message}`)
  if (!yourSession) err(`No active session found for ${yourEmail}. Make sure you've gone through the flight + intent screens first.`)
  dim(`your session ID: ${yourSession!.id}`)

  // ── Get the demo partner's session ────────────────────────────────────────
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const partnerAuthUser = allUsers.find(u => u.email === PARTNER_EMAIL)
  if (!partnerAuthUser) err(`Demo partner not found. Run 'setup' first.`)
  const partnerId = partnerAuthUser!.id

  const { data: partnerSession, error: partnerSessionErr } = await admin
    .from('sessions')
    .select('id')
    .eq('user_id', partnerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (partnerSessionErr) err(`partner session lookup error — ${partnerSessionErr.message}`)
  if (!partnerSession) err(`No active session for demo partner. Run 'setup' first.`)
  dim(`partner session ID: ${partnerSession!.id}`)

  // ── Insert the match row ───────────────────────────────────────────────────
  const { data: matchRow, error: matchErr } = await admin
    .from('matches')
    .insert({
      session_id_a: yourSession!.id,
      session_id_b: partnerSession!.id,
      origin_iata: yourSession!.origin_iata ?? 'JFK',
      status: 'pending',
      match_type: 'high_confidence',
      point_of_connection: POINT_OF_CONNECTION,
      winning_signal_type: 'same_industry',
      winning_signal_score: 7,
      pool_size_at_match: 12,
      signal_breakdown: [
        { type: 'same_industry', tier: 3, points: 2, label: 'both in Tech' },
        { type: 'founder_asymmetry', tier: 3, points: 2, label: 'founder meets operator' },
        { type: 'same_destination', tier: 3, points: 2, label: 'both flying to SFO' },
      ],
    })
    .select('id')
    .single()

  if (matchErr) {
    if ((matchErr as unknown as { code?: string }).code === '23505') {
      err('A match between these two sessions already exists. Run \'setup\' to reset the partner session, then try again.')
    }
    err(`match insert failed — ${matchErr.message}`)
  }
  const matchId = matchRow!.id
  ok(`match created: ${matchId}`)

  // ── Publish Ably push to YOUR phone ───────────────────────────────────────
  // This fires the match notification on the standby screen.
  const payload = {
    match_id: matchId,
    match_type: 'high_confidence',
    point_of_connection: POINT_OF_CONNECTION,
  }
  await publishToAbly(yourUserId, 'match.created', payload)
  ok('Ably push sent → your phone should jump to the match screen now')

  // Also notify the partner channel (benign — nobody is listening on it).
  await publishToAbly(partnerId, 'match.created', payload).catch(() => {})

  log('')
  bold('  Next step (after you press MEET THEM):')
  log(`  SERVICE_ROLE_KEY=xxx npx tsx scripts/demo.ts accept ${matchId}`)
  log('')
}

// ─── accept ───────────────────────────────────────────────────────────────────
// Update match to 'mutual'. The Supabase Realtime subscription on the waiting
// screen fires automatically and routes the phone to the meetup screen.
// No Ably key needed — Realtime handles it.

async function accept(matchId: string) {
  bold('\n  STANDBY DEMO — accept\n')

  if (!matchId) err('Usage: demo.ts accept <match-id>')

  const { error: updateErr } = await admin
    .from('matches')
    .update({ status: 'mutual' })
    .eq('id', matchId)
  if (updateErr) err(`match update failed — ${updateErr.message}`)

  ok(`match ${matchId} → mutual`)
  ok('Supabase Realtime will route the phone to the meetup screen automatically')
  log('')
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const [,, cmd, arg] = process.argv

switch (cmd) {
  case 'setup':  setup().catch(e  => { console.error(e); process.exit(1) }); break
  case 'match':  match(arg).catch(e => { console.error(e); process.exit(1) }); break
  case 'accept': accept(arg).catch(e => { console.error(e); process.exit(1) }); break
  default:
    log('')
    bold('  Usage:')
    log('  npx tsx scripts/demo.ts setup')
    log('  npx tsx scripts/demo.ts match <your-email>')
    log('  npx tsx scripts/demo.ts accept <match-id>')
    log('')
    process.exit(1)
}
