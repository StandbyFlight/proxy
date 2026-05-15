/**
 * Seed 50 test users into Supabase and run the matching algorithm for each.
 *
 * Usage:
 *   SERVICE_ROLE_KEY=<key> npx tsx scripts/seed-users.ts
 *
 * Get the service role key from:
 *   Supabase dashboard → Project Settings → API → service_role (secret)
 *
 * Re-running is safe — existing seed users are detected by email and skipped.
 * Pass --wipe to delete all seed data first.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nbsuzowidjwmooxzuepp.supabase.co'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SERVICE_ROLE_KEY. Get it from Supabase → Settings → API → service_role')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Flight all 50 users are on ───────────────────────────────────────────────
// JFK departure, 90-min window means all sessions must be within 90 min of each
// other. We spread them across 3 departure times so the algorithm still has a
// realistic pool rather than all 50 seeing all 50.

const BASE_DATE = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1) // tomorrow
  return d.toISOString().split('T')[0]   // YYYY-MM-DD
})()

function iso(date: string, hhmm: string) {
  return `${date}T${hhmm}:00`
}

// Three departure clusters — all within 90 min of each other (08:00–09:30)
const DEP_A = iso(BASE_DATE, '08:00')
const DEP_B = iso(BASE_DATE, '08:45')
const DEP_C = iso(BASE_DATE, '09:30')

// ─── 50 test user profiles ─────────────────────────────────────────────────────
// Designed with intentional signal clusters so the algorithm has rich matches.
// terminal: null → algorithm skips terminal filtering (JFK terminals isolate).

interface UserProfile {
  email: string
  first_name: string
  age: number
  base_city: string
  hometown: string | null
  industry: string | null
  company: string | null
  school: string | null
  career_stage: string | null
  travel_style: string | null
  current_thinking: string
  // Session fields
  origin_iata: string
  destination_iata: string
  departure_time: string
  connection_intent: 'professional' | 'social' | 'open'
  travel_purpose: string | null
  event_id: string | null
}

const USERS: UserProfile[] = [
  // ── AWS re:Invent cluster (8) — same event_id → tier-1 matches ───────────
  {
    email: 'seed001@standbytest.dev', first_name: 'Maya', age: 29,
    base_city: 'New York', hometown: 'Chicago', industry: 'Tech', company: 'AWS',
    school: 'Cornell', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Thinking about serverless cost modeling.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed002@standbytest.dev', first_name: 'James', age: 34,
    base_city: 'San Francisco', hometown: 'Austin', industry: 'Tech', company: 'Stripe',
    school: 'Stanford', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'Building out a platform team, need to hire.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed003@standbytest.dev', first_name: 'Priya', age: 26,
    base_city: 'New York', hometown: 'Mumbai', industry: 'Tech', company: 'Datadog',
    school: 'NYU', career_stage: 'early', travel_style: null,
    current_thinking: 'First time at re:Invent, excited about observability talks.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed004@standbytest.dev', first_name: 'Tom', age: 41,
    base_city: 'Boston', hometown: 'Boston', industry: 'Tech', company: 'HubSpot',
    school: 'MIT', career_stage: 'senior', travel_style: 'overpacker',
    current_thinking: 'Evaluating whether to go all-in on AWS or stay hybrid.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed005@standbytest.dev', first_name: 'Zoe', age: 31,
    base_city: 'New York', hometown: 'Seattle', industry: 'Tech', company: 'MongoDB',
    school: 'Columbia', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Following the database wars closely.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_B,
    connection_intent: 'open', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed006@standbytest.dev', first_name: 'Ravi', age: 36,
    base_city: 'Austin', hometown: 'Hyderabad', industry: 'Tech', company: 'Dell',
    school: 'UT Austin', career_stage: 'senior', travel_style: null,
    current_thinking: 'Trying to modernize infrastructure at a big company.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed007@standbytest.dev', first_name: 'Elena', age: 28,
    base_city: 'Chicago', hometown: 'Warsaw', industry: 'Tech', company: 'Morningstar',
    school: 'UChicago', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'Curious how AI will reshape financial data products.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_C,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },
  {
    email: 'seed008@standbytest.dev', first_name: 'Marcus', age: 44,
    base_city: 'New York', hometown: 'Atlanta', industry: 'Consulting', company: 'Accenture',
    school: 'Duke', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'AWS partner go-to-market is where I live.',
    origin_iata: 'JFK', destination_iata: 'LAS', departure_time: DEP_C,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: 'AWS re:Invent 2025',
  },

  // ── Google cluster (5) — same company → tier-2 matches ────────────────────
  {
    email: 'seed009@standbytest.dev', first_name: 'Sarah', age: 27,
    base_city: 'San Francisco', hometown: 'Portland', industry: 'Tech', company: 'Google',
    school: 'UC Berkeley', career_stage: 'early', travel_style: 'light_packer',
    current_thinking: 'On a team building search infrastructure.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed010@standbytest.dev', first_name: 'Kevin', age: 33,
    base_city: 'San Francisco', hometown: 'Toronto', industry: 'Tech', company: 'Google',
    school: 'Waterloo', career_stage: 'mid', travel_style: null,
    current_thinking: 'Deepmind / Google Brain merger still feels weird.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_A,
    connection_intent: 'open', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed011@standbytest.dev', first_name: 'Aisha', age: 38,
    base_city: 'New York', hometown: 'Lagos', industry: 'Tech', company: 'Google',
    school: 'Columbia', career_stage: 'senior', travel_style: 'overpacker',
    current_thinking: 'Product lead on Google Workspace.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed012@standbytest.dev', first_name: 'David', age: 30,
    base_city: 'Los Angeles', hometown: 'Miami', industry: 'Tech', company: 'Google',
    school: 'UCLA', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Ads team. Do not ask me about the TikTok deal.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_B,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed013@standbytest.dev', first_name: 'Nina', age: 24,
    base_city: 'San Francisco', hometown: 'Seoul', industry: 'Tech', company: 'Google',
    school: 'Carnegie Mellon', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'New grad, first work trip — figuring everything out.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_C,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },

  // ── Goldman Sachs cluster (4) — same company ──────────────────────────────
  {
    email: 'seed014@standbytest.dev', first_name: 'Alex', age: 35,
    base_city: 'New York', hometown: 'New York', industry: 'Finance', company: 'Goldman Sachs',
    school: 'Wharton', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'Rate cuts and what they mean for credit markets.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed015@standbytest.dev', first_name: 'Chloe', age: 28,
    base_city: 'New York', hometown: 'Greenwich', industry: 'Finance', company: 'Goldman Sachs',
    school: 'Yale', career_stage: 'early', travel_style: null,
    current_thinking: 'Investment banking associate, running on no sleep.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed016@standbytest.dev', first_name: 'Omar', age: 31,
    base_city: 'New York', hometown: 'Cairo', industry: 'Finance', company: 'Goldman Sachs',
    school: 'London School of Economics', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'EM debt is interesting right now.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed017@standbytest.dev', first_name: 'Tara', age: 42,
    base_city: 'New York', hometown: 'Boston', industry: 'Finance', company: 'Goldman Sachs',
    school: 'Harvard', career_stage: 'senior', travel_style: 'overpacker',
    current_thinking: 'Managing director, structuring deal on the West Coast.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_B,
    connection_intent: 'open', travel_purpose: 'work_trip', event_id: null,
  },

  // ── NYU alums (4) — same school ───────────────────────────────────────────
  {
    email: 'seed018@standbytest.dev', first_name: 'Leo', age: 26,
    base_city: 'New York', hometown: 'Barcelona', industry: 'Media', company: 'Vox Media',
    school: 'NYU', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'Long-form audio is having a moment.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_A,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed019@standbytest.dev', first_name: 'Mia', age: 29,
    base_city: 'New York', hometown: 'New York', industry: 'Healthcare', company: 'Mount Sinai',
    school: 'NYU', career_stage: 'early', travel_style: null,
    current_thinking: 'Finishing my residency. Almost there.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_A,
    connection_intent: 'social', travel_purpose: 'solo_travel', event_id: null,
  },
  {
    email: 'seed020@standbytest.dev', first_name: 'Ben', age: 32,
    base_city: 'New York', hometown: 'Philadelphia', industry: 'Finance', company: 'Citadel',
    school: 'NYU', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Quantitative research in fixed income.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed021@standbytest.dev', first_name: 'Lily', age: 35,
    base_city: 'Los Angeles', hometown: 'New York', industry: 'Media', company: 'A24',
    school: 'NYU', career_stage: 'mid', travel_style: 'spontaneous',
    current_thinking: 'Development on a limited series. Cannot say more.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_B,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },

  // ── MIT alums (3) — same school ───────────────────────────────────────────
  {
    email: 'seed022@standbytest.dev', first_name: 'Raj', age: 39,
    base_city: 'Boston', hometown: 'Chennai', industry: 'Tech', company: 'Moderna',
    school: 'MIT', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'mRNA platform has applications far beyond vaccines.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: null,
  },
  {
    email: 'seed023@standbytest.dev', first_name: 'Hannah', age: 33,
    base_city: 'Boston', hometown: 'Minneapolis', industry: 'Academia', company: 'MIT Media Lab',
    school: 'MIT', career_stage: 'mid', travel_style: 'spontaneous',
    current_thinking: 'Researching human-computer interaction in ambient environments.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'conference', event_id: null,
  },
  {
    email: 'seed024@standbytest.dev', first_name: 'Chris', age: 28,
    base_city: 'New York', hometown: 'Detroit', industry: 'Tech', company: null,
    school: 'MIT', career_stage: 'founder', travel_style: null,
    current_thinking: 'Building robotics infra for warehouses. Early days.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_C,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },

  // ── Founders cluster (4) — career_stage + asymmetry signals ─────────────
  {
    email: 'seed025@standbytest.dev', first_name: 'Sofia', age: 31,
    base_city: 'New York', hometown: 'Buenos Aires', industry: 'Tech', company: null,
    school: 'Columbia', career_stage: 'founder', travel_style: 'light_packer',
    current_thinking: 'Series A closed. Now the real work starts.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed026@standbytest.dev', first_name: 'Ethan', age: 37,
    base_city: 'New York', hometown: 'New York', industry: 'Finance', company: null,
    school: 'Wharton', career_stage: 'founder', travel_style: 'light_packer',
    current_thinking: 'Building a fintech for underserved communities.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed027@standbytest.dev', first_name: 'Yuki', age: 29,
    base_city: 'San Francisco', hometown: 'Tokyo', industry: 'Healthcare', company: null,
    school: 'UCSF', career_stage: 'founder', travel_style: null,
    current_thinking: 'Closing pre-seed for a diagnostics startup.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_B,
    connection_intent: 'open', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed028@standbytest.dev', first_name: 'Andre', age: 43,
    base_city: 'Los Angeles', hometown: 'São Paulo', industry: 'Media', company: null,
    school: 'USC', career_stage: 'founder', travel_style: 'overpacker',
    current_thinking: 'Media company meets AI tooling. Trying to figure it out.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_C,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },

  // ── Sundance cluster (4) — same event ─────────────────────────────────────
  {
    email: 'seed029@standbytest.dev', first_name: 'Isabelle', age: 27,
    base_city: 'Los Angeles', hometown: 'New Orleans', industry: 'Media', company: 'Netflix',
    school: 'USC', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'Acquisitions team, scouting docs.',
    origin_iata: 'JFK', destination_iata: 'SLC', departure_time: DEP_A,
    connection_intent: 'social', travel_purpose: 'conference', event_id: 'Sundance 2026',
  },
  {
    email: 'seed030@standbytest.dev', first_name: 'Diego', age: 34,
    base_city: 'Los Angeles', hometown: 'Mexico City', industry: 'Media', company: 'A24',
    school: 'NYU', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'We have a film in the dramatic competition.',
    origin_iata: 'JFK', destination_iata: 'SLC', departure_time: DEP_B,
    connection_intent: 'open', travel_purpose: 'conference', event_id: 'Sundance 2026',
  },
  {
    email: 'seed031@standbytest.dev', first_name: 'Grace', age: 32,
    base_city: 'New York', hometown: 'London', industry: 'Media', company: 'Deadline',
    school: 'Columbia', career_stage: 'mid', travel_style: null,
    current_thinking: 'Covering the festival for press. Sleep is a concept.',
    origin_iata: 'JFK', destination_iata: 'SLC', departure_time: DEP_B,
    connection_intent: 'social', travel_purpose: 'conference', event_id: 'Sundance 2026',
  },
  {
    email: 'seed032@standbytest.dev', first_name: 'Finn', age: 25,
    base_city: 'New York', hometown: 'Dublin', industry: 'Media', company: null,
    school: 'Tisch', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'Debut short in the shorts program. Terrified.',
    origin_iata: 'JFK', destination_iata: 'SLC', departure_time: DEP_C,
    connection_intent: 'social', travel_purpose: 'conference', event_id: 'Sundance 2026',
  },

  // ── Healthcare / same industry (4) ────────────────────────────────────────
  {
    email: 'seed033@standbytest.dev', first_name: 'Anna', age: 36,
    base_city: 'Boston', hometown: 'Stockholm', industry: 'Healthcare', company: 'Novartis',
    school: 'Harvard', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'Oncology pipeline. Long road, but worth it.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed034@standbytest.dev', first_name: 'Mo', age: 30,
    base_city: 'New York', hometown: 'Nairobi', industry: 'Healthcare', company: 'Pfizer',
    school: 'Johns Hopkins', career_stage: 'mid', travel_style: null,
    current_thinking: 'Global health equity is the lens I bring to everything.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed035@standbytest.dev', first_name: 'Clara', age: 32,
    base_city: 'New York', hometown: 'Paris', industry: 'Healthcare', company: 'Memorial Sloan Kettering',
    school: 'Sorbonne', career_stage: 'mid', travel_style: 'overpacker',
    current_thinking: 'Clinical research coordinator. The paperwork is real.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_B,
    connection_intent: 'open', travel_purpose: 'conference', event_id: null,
  },
  {
    email: 'seed036@standbytest.dev', first_name: 'Joel', age: 45,
    base_city: 'Chicago', hometown: 'Chicago', industry: 'Healthcare', company: 'Abbott',
    school: 'Northwestern', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'Medical device regulation is moving faster than people think.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_C,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },

  // ── Solo travelers / social intent (6) ────────────────────────────────────
  {
    email: 'seed037@standbytest.dev', first_name: 'Nia', age: 25,
    base_city: 'Atlanta', hometown: 'Atlanta', industry: 'Media', company: null,
    school: 'Spelman', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'Taking a month to work remotely from LA.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_A,
    connection_intent: 'social', travel_purpose: 'solo_travel', event_id: null,
  },
  {
    email: 'seed038@standbytest.dev', first_name: 'Lars', age: 28,
    base_city: 'New York', hometown: 'Oslo', industry: 'Tech', company: 'Spotify',
    school: null, career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Visiting the LA office then taking a long weekend.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_A,
    connection_intent: 'social', travel_purpose: 'solo_travel', event_id: null,
  },
  {
    email: 'seed039@standbytest.dev', first_name: 'Mei', age: 27,
    base_city: 'New York', hometown: 'Shanghai', industry: 'Finance', company: 'JPMorgan',
    school: 'Princeton', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'First real vacation in two years. Going to the desert.',
    origin_iata: 'JFK', destination_iata: 'PHX', departure_time: DEP_B,
    connection_intent: 'social', travel_purpose: 'solo_travel', event_id: null,
  },
  {
    email: 'seed040@standbytest.dev', first_name: 'Sam', age: 31,
    base_city: 'New York', hometown: 'Nashville', industry: 'Consulting', company: 'McKinsey',
    school: 'Georgetown', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Burned out. This trip is for me.',
    origin_iata: 'JFK', destination_iata: 'PHX', departure_time: DEP_B,
    connection_intent: 'social', travel_purpose: 'solo_travel', event_id: null,
  },
  {
    email: 'seed041@standbytest.dev', first_name: 'Jade', age: 33,
    base_city: 'New York', hometown: 'Kingston', industry: 'Academia', company: 'Columbia University',
    school: 'Columbia', career_stage: 'mid', travel_style: 'spontaneous',
    current_thinking: 'Ethnomusicology fieldwork in New Mexico.',
    origin_iata: 'JFK', destination_iata: 'ABQ', departure_time: DEP_C,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed042@standbytest.dev', first_name: 'Oscar', age: 36,
    base_city: 'New York', hometown: 'Buenos Aires', industry: 'Tech', company: 'Duolingo',
    school: 'Carnegie Mellon', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Language learning and what makes it stick.',
    origin_iata: 'JFK', destination_iata: 'SEA', departure_time: DEP_C,
    connection_intent: 'open', travel_purpose: 'work_trip', event_id: null,
  },

  // ── Assorted for curiosity matches (8) ─────────────────────────────────────
  {
    email: 'seed043@standbytest.dev', first_name: 'Vera', age: 40,
    base_city: 'New York', hometown: 'Moscow', industry: 'Finance', company: 'Blackstone',
    school: 'LSE', career_stage: 'senior', travel_style: 'overpacker',
    current_thinking: 'Real assets in a high-rate environment.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed044@standbytest.dev', first_name: 'Joon', age: 22,
    base_city: 'New York', hometown: 'Seoul', industry: 'Tech', company: null,
    school: 'Columbia', career_stage: 'student', travel_style: 'spontaneous',
    current_thinking: 'Interning at a startup this summer, shipping features fast.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_A,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed045@standbytest.dev', first_name: 'Camille', age: 29,
    base_city: 'New York', hometown: 'Lyon', industry: 'Media', company: 'Condé Nast',
    school: 'Sciences Po', career_stage: 'mid', travel_style: 'light_packer',
    current_thinking: 'Fashion and its supply chain problems.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_B,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed046@standbytest.dev', first_name: 'Felix', age: 46,
    base_city: 'Chicago', hometown: 'Vienna', industry: 'Consulting', company: 'Boston Consulting Group',
    school: 'HBS', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'Digital transformation in manufacturing. Still a long road.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed047@standbytest.dev', first_name: 'Amara', age: 24,
    base_city: 'New York', hometown: 'Accra', industry: 'Finance', company: 'Morgan Stanley',
    school: 'Dartmouth', career_stage: 'early', travel_style: null,
    current_thinking: 'Learning fixed income on the job.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_B,
    connection_intent: 'professional', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed048@standbytest.dev', first_name: 'Luca', age: 37,
    base_city: 'New York', hometown: 'Milan', industry: 'Tech', company: 'Palantir',
    school: 'Bocconi', career_stage: 'senior', travel_style: 'light_packer',
    current_thinking: 'Data infrastructure for government. Misunderstood space.',
    origin_iata: 'JFK', destination_iata: 'ORD', departure_time: DEP_C,
    connection_intent: 'open', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed049@standbytest.dev', first_name: 'Rin', age: 26,
    base_city: 'San Francisco', hometown: 'Osaka', industry: 'Tech', company: 'Figma',
    school: 'RISD', career_stage: 'early', travel_style: 'spontaneous',
    current_thinking: 'Design systems and how they break at scale.',
    origin_iata: 'JFK', destination_iata: 'SFO', departure_time: DEP_C,
    connection_intent: 'social', travel_purpose: 'work_trip', event_id: null,
  },
  {
    email: 'seed050@standbytest.dev', first_name: 'Patrick', age: 48,
    base_city: 'Boston', hometown: 'Dublin', industry: 'Academia', company: 'Harvard Kennedy School',
    school: 'Oxford', career_stage: 'senior', travel_style: 'overpacker',
    current_thinking: 'Writing a book on institutional trust. Slow going.',
    origin_iata: 'JFK', destination_iata: 'LAX', departure_time: DEP_C,
    connection_intent: 'open', travel_purpose: 'solo_travel', event_id: null,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) { process.stdout.write(msg + '\n') }
function dim(msg: string) { process.stdout.write(`  \x1b[2m${msg}\x1b[0m\n`) }
function ok(msg: string)  { process.stdout.write(`  \x1b[32m✓\x1b[0m ${msg}\n`) }
function err(msg: string) { process.stdout.write(`  \x1b[31m✗\x1b[0m ${msg}\n`) }

// ─── Wipe seed data ───────────────────────────────────────────────────────────

async function wipeSeedData() {
  log('\nWiping existing seed data...')

  const emails = USERS.map(u => u.email)

  // Find auth user IDs for our seed emails
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const seedAuthUsers = authUsers.filter(u => u.email && emails.includes(u.email))

  for (const u of seedAuthUsers) {
    await admin.from('users').delete().eq('id', u.id)
    await admin.auth.admin.deleteUser(u.id)
    dim(`deleted ${u.email}`)
  }

  log(`Wiped ${seedAuthUsers.length} seed users.\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const wipe = process.argv.includes('--wipe')
  if (wipe) await wipeSeedData()

  log(`\n\x1b[1mSeeding ${USERS.length} users → JFK, ${BASE_DATE}\x1b[0m`)
  log(`Departure clusters: 08:00 · 08:45 · 09:30 (all within 90-min match window)\n`)

  // ── Step 1: Upsert the shared flight record ────────────────────────────────
  log('Step 1 — Flight record')

  const { data: flightRow, error: flightErr } = await admin
    .from('flights')
    .upsert({
      flight_iata: 'SEEDTEST',
      departure_date: BASE_DATE,
      origin_iata: 'JFK',
      destination_iata: 'LAX',
      departure_scheduled: DEP_A,
      last_enriched_at: new Date().toISOString(),
    }, { onConflict: 'flight_iata,departure_date' })
    .select('id')
    .single()

  if (flightErr || !flightRow) {
    err(`Could not upsert flight: ${flightErr?.message}`)
    process.exit(1)
  }
  ok(`flight id: ${flightRow.id}`)

  // ── Step 2: Create auth + public users ────────────────────────────────────
  log('\nStep 2 — Creating users')

  const createdUsers: { id: string; profile: UserProfile }[] = []

  for (const profile of USERS) {
    // Check if already exists
    const { data: { users: existing } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const alreadyExists = existing.find(u => u.email === profile.email)

    let userId: string

    if (alreadyExists) {
      userId = alreadyExists.id
      dim(`${profile.first_name} already exists — reusing`)
    } else {
      // Unique fake phone per seed user: +1555000NNNN where NNNN = index
      const idx = String(USERS.indexOf(profile) + 1).padStart(4, '0')
      const fakePhone = `+1555000${idx}`

      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email: profile.email,
        email_confirm: true,
        user_metadata: { first_name: profile.first_name },
      })
      if (authErr || !created.user) {
        err(`${profile.first_name}: auth create failed — ${authErr?.message}`)
        continue
      }
      userId = created.user.id

      // Upsert (not insert) in case a trigger auto-created the row on auth user creation.
      const { error: publicErr } = await admin.from('users').upsert({
        id: userId,
        first_name: profile.first_name,
        age: profile.age,
        base_city: profile.base_city,
        hometown: profile.hometown,
        industry: profile.industry,
        company: profile.company,
        school: profile.school,
        career_stage: profile.career_stage,
        travel_style: profile.travel_style,
        current_thinking: profile.current_thinking,
        phone: fakePhone,
        email: profile.email,
        email_verified: true,
      }, { onConflict: 'id' })

      if (publicErr) {
        err(`${profile.first_name}: public.users upsert failed — ${publicErr.message}`)
        continue
      }
      ok(`${profile.first_name} (${profile.company ?? profile.school ?? profile.industry})`)
    }

    createdUsers.push({ id: userId, profile })
  }

  // ── Step 3: Create sessions ────────────────────────────────────────────────
  log(`\nStep 3 — Creating ${createdUsers.length} sessions`)

  const sessionRecords: Array<{ sessionId: string; userId: string; profile: UserProfile }> = []

  for (const { id: userId, profile } of createdUsers) {
    // Delete old session for this user to start fresh
    await admin.from('sessions').delete().eq('user_id', userId)

    const { data: sessionRow, error: sessionErr } = await admin
      .from('sessions')
      .insert({
        user_id: userId,
        flight_id: flightRow.id,
        origin_iata: profile.origin_iata,
        destination_iata: profile.destination_iata,
        departure_time: profile.departure_time,
        terminal: null,   // null = no terminal filtering at JFK
        gate: null,
        connection_intent: profile.connection_intent,
        travel_purpose: profile.travel_purpose,
        event_id: profile.event_id,
        status: 'active',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (sessionErr || !sessionRow) {
      err(`session for ${profile.first_name}: ${sessionErr?.message}`)
      continue
    }

    sessionRecords.push({ sessionId: sessionRow.id, userId, profile })
  }

  ok(`${sessionRecords.length} sessions created`)

  // ── Step 4: Run match-sessions for each session ────────────────────────────
  log(`\nStep 4 — Running match algorithm for ${sessionRecords.length} sessions\n`)

  let matched = 0
  let curiosity = 0
  let noMatch = 0
  let errors = 0

  for (const { sessionId, userId, profile } of sessionRecords) {
    const payload = {
      id: sessionId,
      user_id: userId,
      origin_iata: profile.origin_iata,
      destination_iata: profile.destination_iata,
      departure_time: profile.departure_time,
      terminal: null,
      connection_intent: profile.connection_intent,
      travel_purpose: profile.travel_purpose,
      event_id: profile.event_id,
      curiosity_mode: false,
    }

    const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/match-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const fnText = await fnRes.text()
    if (!fnRes.ok) {
      err(`${profile.first_name}: function error (${fnRes.status}) — ${fnText}`)
      errors++
      continue
    }
    const result = JSON.parse(fnText) as { matched: boolean; match_type?: string; score?: number; reason?: string }

    if (result.matched && result.match_type === 'high_confidence') {
      ok(`${profile.first_name.padEnd(12)} → high_confidence  score=${result.score}`)
      matched++
    } else if (result.matched && result.match_type === 'curiosity') {
      ok(`${profile.first_name.padEnd(12)} → curiosity`)
      curiosity++
    } else {
      dim(`${profile.first_name.padEnd(12)}   no match (${result.reason ?? 'score below threshold'}, score=${result.score ?? 0})`)
      noMatch++
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log('\n' + '─'.repeat(48))
  log(`\x1b[1mResults\x1b[0m`)
  log(`  High-confidence matches : \x1b[32m${matched}\x1b[0m`)
  log(`  Curiosity matches       : \x1b[33m${curiosity}\x1b[0m`)
  log(`  No match                : ${noMatch}`)
  log(`  Errors                  : ${errors > 0 ? `\x1b[31m${errors}\x1b[0m` : errors}`)
  log('')
  log(`Check your Supabase dashboard → matches table to inspect results.`)
  log(`Seed emails all end in @standbytest.dev for easy filtering.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
