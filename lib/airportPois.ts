// Airport POI helper — READ-ONLY reference data lookup.
//
// This module does exactly one thing: it takes an already-stored
// `suggested_meetup_location` string (chosen elsewhere by the matcher) and
// maps it to structured coordinates by reading the `airport_pois` table.
//
// It deliberately does NOT:
//   - select or score matches,
//   - call the matcher / meetup-selection logic,
//   - insert, update, or delete any match row or POI row.
// It only SELECTs from `airport_pois` and parses a string. Every function
// fails safe by returning null / [] instead of throwing, so it can never
// break a screen render or interfere with match creation.
//
// Stored format of suggested_meetup_location (see
// supabase/functions/_shared/meetupLocations.ts):
//   "<name> — <walking guidance>"   (em dash surrounded by spaces)
// or a legacy / fallback single-line string with no " — ". The POI `name`
// matches the part before the first " — ".

import { supabase } from './supabase'

// A row of the read-only `airport_pois` reference table.
export type AirportPoi = {
  id: string
  airport_iata: string
  name: string
  category: string | null
  terminal: string | null
  latitude: number
  longitude: number
}

// The structured destination resolved from a stored meetup string.
export type MeetupDestination = {
  name: string
  latitude: number
  longitude: number
  category: string | null
}

// Separator used between the spot name and the walking guidance.
const NAME_GUIDANCE_SEPARATOR = ' — '

/**
 * Fetch all curated POIs for a single airport (read-only).
 *
 * Case-insensitive on the IATA code: the input is uppercased and compared
 * against the stored `airport_iata`. Returns [] on any error or when there
 * are no rows. Never throws.
 */
export async function fetchAirportPois(airportIata: string): Promise<AirportPoi[]> {
  const iata = (airportIata ?? '').trim().toUpperCase()
  if (!iata) return []

  try {
    const { data, error } = await supabase
      .from('airport_pois')
      .select('id, airport_iata, name, category, terminal, latitude, longitude')
      .eq('airport_iata', iata)

    if (error || !data) return []
    return data as AirportPoi[]
  } catch {
    // Read-only helper: swallow anything so callers never have to guard.
    return []
  }
}

/**
 * Extract the POI spot name from a stored meetup string.
 *
 * Pure and synchronous. Returns the substring before the first " — " when the
 * separator is present, otherwise the whole trimmed string. Returns null for
 * empty / null / undefined input.
 */
export function parseMeetupSpotName(
  suggestedMeetupLocation: string | null | undefined
): string | null {
  const raw = (suggestedMeetupLocation ?? '').trim()
  if (!raw) return null

  const sepIndex = raw.indexOf(NAME_GUIDANCE_SEPARATOR)
  const name = sepIndex === -1 ? raw : raw.slice(0, sepIndex)
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Resolve a stored meetup string to structured coordinates (read-only).
 *
 * Steps:
 *   1. Require both a suggested location string and an airport code.
 *   2. Parse the spot name out of the string.
 *   3. Fetch the airport's POIs and find one whose `name` matches the parsed
 *      name — exact case-insensitive first, then a trimmed case-insensitive
 *      equality. No aggressive fuzzy matching: if nothing matches confidently
 *      we return null (safe failure) rather than guessing a wrong location.
 *
 * Returns null on any missing input, no confident match, or any error. Never
 * throws. Does NOT modify any data.
 */
export async function resolveMeetupDestination(params: {
  suggestedMeetupLocation: string | null | undefined
  airportIata: string | null | undefined
}): Promise<MeetupDestination | null> {
  const { suggestedMeetupLocation, airportIata } = params

  // Both inputs are required to resolve anything.
  if (!suggestedMeetupLocation || !airportIata) return null

  const spotName = parseMeetupSpotName(suggestedMeetupLocation)
  if (!spotName) return null

  try {
    const pois = await fetchAirportPois(airportIata)
    if (pois.length === 0) return null

    const target = spotName.toLowerCase()

    // 1) Exact case-insensitive match on the stored name.
    let match = pois.find(p => p.name.toLowerCase() === target)

    // 2) Trimmed case-insensitive equality (guards stray whitespace).
    if (!match) {
      match = pois.find(p => p.name.trim().toLowerCase() === target)
    }

    if (!match) return null  // no confident match → safe failure

    return {
      name: match.name,
      latitude: match.latitude,
      longitude: match.longitude,
      category: match.category,
    }
  } catch {
    return null
  }
}
