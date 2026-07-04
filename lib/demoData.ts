// ── Standby Beta Demo — sample data ───────────────────────────────────────────
//
// Fake, self-contained data used ONLY by the demo flow (app/(app)/demo/*). None
// of this is written to Supabase or fed into the real matcher. It should feel
// plausible but be clearly a sample when combined with the demo banner.
//
// Vibe: SFO → JFK red-eye, meeting for coffee near the gate.

export type DemoFlight = {
  flightIata: string
  flightLabel: string
  origin: string
  originName: string
  destination: string
  destinationName: string
  terminal: string
  gate: string
  date: string // pre-formatted for BoardingPass, e.g. "JUL 04"
  time: string // pre-formatted, e.g. "5:20 PM"
}

export type DemoMatch = {
  firstName: string
  sampleLabel: string // makes clear this is a sample profile
  pointOfConnection: string
  sharedContext: string
  intentLabel: string
  wearing: string
  flightIata: string
  originIata: string
  destinationIata: string
  destinationName: string
  gate: string
  terminal: string
  date: string
  time: string
}

export type DemoMeetup = {
  spotName: string
  spotContext: string // e.g. "near Gate D8"
  nearGate: string
  walkingMinutes: number
  airport: string
  terminal: string
  gate: string
  safetyPrimary: string
  safetySecondary: string
}

export const demoUser = {
  firstName: 'You',
  baseCity: 'San Francisco',
  baseIata: 'SFO',
}

export const demoFlight: DemoFlight = {
  flightIata: 'STBY204',
  flightLabel: 'STBY 204',
  origin: 'SFO',
  originName: 'San Francisco',
  destination: 'JFK',
  destinationName: 'New York',
  terminal: 'Terminal 2',
  gate: 'D12',
  date: 'JUL 04',
  time: '5:20 PM',
}

export const demoMatch: DemoMatch = {
  firstName: 'Maya',
  sampleLabel: 'SAMPLE TRAVELER',
  pointOfConnection: 'You’re both on the same red-eye, chasing a reset in a new city.',
  sharedContext:
    'Maya is heading out for a few days to clear her head — she said yes to meeting someone she’d have walked right past.',
  intentLabel: 'open to anything',
  wearing: 'Olive jacket, white sneakers',
  flightIata: 'STBY 118',
  originIata: 'SFO',
  destinationIata: 'BOS',
  destinationName: 'Boston',
  gate: 'D8',
  terminal: 'Terminal 2',
  date: 'JUL 04',
  time: '6:05 PM',
}

export const demoMeetup: DemoMeetup = {
  spotName: 'Blue Bottle Coffee',
  spotContext: 'near Gate D8',
  nearGate: 'D8',
  walkingMinutes: 4,
  airport: 'SFO',
  terminal: 'Terminal 2',
  gate: 'D12',
  safetyPrimary: 'Location sharing is simulated in this demo.',
  safetySecondary:
    'In the live app, location sharing turns off automatically once you both reach the meetup spot.',
}

// Progressive copy for the simulated searching screen. Advances one line at a
// time, ending on "Match found." before routing to the demo match reveal.
export const demoSearchSteps: string[] = [
  'Searching for travelers nearby…',
  'Finding shared context…',
  'Choosing a meetup spot…',
  'Match found.',
]

// Canonical demo route paths — every demo screen and entry point references
// these so navigation stays consistent.
export const DEMO_ROUTES = {
  searching: '/(app)/demo/searching',
  match: '/(app)/demo/match',
  meetup: '/(app)/demo/meetup',
} as const
