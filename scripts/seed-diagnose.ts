/**
 * One-user diagnostic — run this to see exactly where seeding breaks.
 * Usage: SERVICE_ROLE_KEY=your_key npx tsx scripts/seed-diagnose.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nbsuzowidjwmooxzuepp.supabase.co'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const BASE_DATE = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
})()

async function run() {
  console.log('── 1. Check auth connection ──')
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1 })
  if (listErr) { console.error('AUTH FAILED:', listErr); process.exit(1) }
  console.log(`✓ Auth connected. Total auth users: ${users.length}`)

  console.log('\n── 2. Create test auth user ──')
  const testEmail = 'diag001@standbytest.dev'

  // Delete if exists
  const existing = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find(u => u.email === testEmail)
  if (existing) {
    await admin.from('users').delete().eq('id', existing.id)
    await admin.auth.admin.deleteUser(existing.id)
    console.log('  (deleted existing diag user)')
  }
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
  })
  if (authErr) { console.error('AUTH CREATE FAILED:', JSON.stringify(authErr, null, 2)); process.exit(1) }
  console.log(`✓ Auth user created: ${authData.user.id}`)

  console.log('\n── 3. Upsert public.users row ──')
  // Use upsert (not insert) in case a trigger auto-created the row on auth user creation.
  const { error: pubErr } = await admin.from('users').upsert({
    id: authData.user.id,
    first_name: 'DiagUser',
    age: 30,
    base_city: 'New York',
    hometown: 'Chicago',
    industry: 'Tech',
    company: 'TestCo',
    school: 'MIT',
    career_stage: 'mid',
    travel_style: 'light_packer',
    current_thinking: 'Testing the seed script.',
    phone: '+15550000001',
    email: testEmail,
    email_verified: true,
  }, { onConflict: 'id' })
  if (pubErr) { console.error('PUBLIC.USERS UPSERT FAILED:', JSON.stringify(pubErr, null, 2)); process.exit(1) }
  console.log('✓ public.users row upserted')

  console.log('\n── 4. Upsert flight ──')
  const { data: flight, error: flightErr } = await admin
    .from('flights')
    .upsert({
      flight_iata: 'DIAGTEST',
      departure_date: BASE_DATE,
      origin_iata: 'JFK',
      destination_iata: 'LAX',
      departure_scheduled: `${BASE_DATE}T08:00:00`,
      last_enriched_at: new Date().toISOString(),
    }, { onConflict: 'flight_iata,departure_date' })
    .select('id')
    .single()
  if (flightErr) { console.error('FLIGHT UPSERT FAILED:', JSON.stringify(flightErr, null, 2)); process.exit(1) }
  console.log(`✓ Flight row: ${flight.id}`)

  console.log('\n── 5. Insert session ──')
  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      user_id: authData.user.id,
      flight_id: flight.id,
      origin_iata: 'JFK',
      destination_iata: 'LAX',
      departure_time: `${BASE_DATE}T08:00:00`,
      terminal: null,
      gate: null,
      connection_intent: 'professional',
      travel_purpose: 'work_trip',
      event_id: null,
      status: 'active',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()
  if (sessionErr) { console.error('SESSION INSERT FAILED:', JSON.stringify(sessionErr, null, 2)); process.exit(1) }
  console.log(`✓ Session row: ${session.id}`)

  console.log('\n── 6. Invoke match-sessions ──')
  const fnRes = await fetch(
    `${SUPABASE_URL}/functions/v1/match-sessions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: session.id,
        user_id: authData.user.id,
        origin_iata: 'JFK',
        destination_iata: 'LAX',
        departure_time: `${BASE_DATE}T08:00:00`,
        terminal: null,
        connection_intent: 'professional',
        travel_purpose: 'work_trip',
        event_id: null,
        curiosity_mode: false,
      }),
    }
  )
  const fnBody = await fnRes.text()
  if (!fnRes.ok) {
    console.error(`FUNCTION FAILED (HTTP ${fnRes.status}):`)
    console.error(fnBody)
    process.exit(1)
  }
  console.log('✓ match-sessions result:', fnBody)

  console.log('\n✓ All steps passed. Re-run seed-users.ts to seed all 50 users.')
}

run().catch(e => { console.error('\nUnexpected error:', e); process.exit(1) })
