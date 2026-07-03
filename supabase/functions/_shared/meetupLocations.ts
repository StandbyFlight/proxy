// Curated airport meetup spots — the ONLY copy of this table in the codebase.
// Runs inside edge functions (Deno); the client never selects a spot — it
// renders whatever string the matcher stored on the match row, so both users
// always see the identical place (Postgres `matches` is the source of truth).
//
// Storage format (fits the existing text column, no migration):
//   "<name> — <walking guidance>"
// The meetup screen splits on the first " — " to render name + guidance.
// Fallback strings contain no " — " and render as a single line, exactly like
// legacy values.
//
// V1 is RDU-only and fully hard-coded: no Places/Routes APIs, no GPS, no
// tracking. Selection is a pure synchronous function of the two sessions'
// terminal/gate data — it can never block or fail match creation.

export type MeetupSpot = {
  airport: string
  terminal: string            // normalized: '1' | '2'
  name: string
  short_label: string
  description: string
  zone: 'post_security' | 'pre_security'
  best_for: string
  fallback_priority: number   // lower = preferred
  walking_guidance: string
  concourse_hints?: Record<string, string>  // gate-letter → extra hint
}

export const RDU_MEETUP_SPOTS: MeetupSpot[] = [
  {
    airport: 'RDU',
    terminal: '2',
    name: 'Terminal 2 food court seating',
    short_label: 'T2 food court',
    description: 'The open seating area at the center of Terminal 2, between the C and D gates.',
    zone: 'post_security',
    best_for: 'central, easy to find from any T2 gate',
    fallback_priority: 1,
    walking_guidance: 'mid-terminal past security, between the C and D gates',
    concourse_hints: {
      C: 'a short walk from the C gates',
      D: 'a short walk from the D gates',
    },
  },
  {
    airport: 'RDU',
    terminal: '2',
    name: 'The rocking chairs by the Terminal 2 windows',
    short_label: 'T2 rocking chairs',
    description: 'The row of wooden rocking chairs along the airfield windows in the central atrium.',
    zone: 'post_security',
    best_for: 'quieter, easy landmark',
    fallback_priority: 2,
    walking_guidance: 'central atrium, along the big windows facing the runway',
  },
  {
    airport: 'RDU',
    terminal: '1',
    name: 'Terminal 1 central seating',
    short_label: 'T1 central seating',
    description: 'The main seating area just past the Terminal 1 checkpoint — visible from all A gates.',
    zone: 'post_security',
    best_for: 'small terminal, impossible to miss',
    fallback_priority: 1,
    walking_guidance: 'just past security, in view of the A gates',
  },
]

const DIFFERENT_TERMINALS_FALLBACK =
  "You're in different terminals: pick a spot together in Messages"

function normalizeTerminal(t: string | null | undefined): string | null {
  if (!t) return null
  const m = String(t).trim().toUpperCase().match(/^T?(?:ERMINAL\s*)?([0-9]+)$/)
  return m ? m[1] : null
}

function gateLetter(gate: string | null | undefined): string | null {
  const m = (gate ?? '').trim().toUpperCase().match(/^([A-Z])/)
  return m ? m[1] : null
}

export type MeetupSelectionInput = {
  airport: string | null
  terminalA: string | null
  terminalB: string | null
  gateA: string | null
  gateB: string | null
  departureTimeA: string | null
  departureTimeB: string | null
}

// Deterministic curated selection. Returns the string to store on the match
// row, or null when this airport has no curated coverage — the caller then
// uses the existing generic behavior. Never throws.
export function selectMeetupLocationForMatch(input: MeetupSelectionInput): string | null {
  const airport = (input.airport ?? '').trim().toUpperCase()
  const spots = RDU_MEETUP_SPOTS.filter(s => s.airport === airport)
  if (spots.length === 0) return null  // unsupported airport → generic fallback

  const termA = normalizeTerminal(input.terminalA)
  const termB = normalizeTerminal(input.terminalB)

  // Different or unknown terminals: don't pretend to know the perfect route.
  if (!termA || !termB || termA !== termB) {
    return DIFFERENT_TERMINALS_FALLBACK
  }

  const candidates = spots
    .filter(s => s.terminal === termA)
    .sort((a, b) => a.fallback_priority - b.fallback_priority)
  if (candidates.length === 0) return DIFFERENT_TERMINALS_FALLBACK

  const spot = candidates[0]

  // If both travelers share a concourse letter and the spot has a hint for
  // it, use the more specific guidance.
  const letterA = gateLetter(input.gateA)
  const letterB = gateLetter(input.gateB)
  const hint =
    letterA && letterA === letterB && spot.concourse_hints?.[letterA]
      ? spot.concourse_hints[letterA]
      : spot.walking_guidance

  return `${spot.name} — ${hint}`
}
