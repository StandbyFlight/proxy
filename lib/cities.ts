// Static directory of major US metros and the airports that serve them.
// Used by the base-city autocomplete on onboarding.
// Display form: "City, ST" with IATA codes shown to the right in mono.

export interface CityEntry {
  name: string         // "Brooklyn"
  state: string        // "NY"
  airports: string[]   // ["JFK", "LGA"]
}

export const CITIES: CityEntry[] = [
  { name: 'New York', state: 'NY', airports: ['JFK', 'LGA', 'EWR'] },
  { name: 'Brooklyn', state: 'NY', airports: ['JFK', 'LGA'] },
  { name: 'Los Angeles', state: 'CA', airports: ['LAX', 'BUR', 'LGB'] },
  { name: 'Chicago', state: 'IL', airports: ['ORD', 'MDW'] },
  { name: 'Houston', state: 'TX', airports: ['IAH', 'HOU'] },
  { name: 'Phoenix', state: 'AZ', airports: ['PHX'] },
  { name: 'Philadelphia', state: 'PA', airports: ['PHL'] },
  { name: 'San Antonio', state: 'TX', airports: ['SAT'] },
  { name: 'San Diego', state: 'CA', airports: ['SAN'] },
  { name: 'Dallas', state: 'TX', airports: ['DFW', 'DAL'] },
  { name: 'Austin', state: 'TX', airports: ['AUS'] },
  { name: 'San Jose', state: 'CA', airports: ['SJC'] },
  { name: 'Fort Worth', state: 'TX', airports: ['DFW'] },
  { name: 'Jacksonville', state: 'FL', airports: ['JAX'] },
  { name: 'Columbus', state: 'OH', airports: ['CMH'] },
  { name: 'Charlotte', state: 'NC', airports: ['CLT'] },
  { name: 'Indianapolis', state: 'IN', airports: ['IND'] },
  { name: 'San Francisco', state: 'CA', airports: ['SFO', 'OAK'] },
  { name: 'Seattle', state: 'WA', airports: ['SEA'] },
  { name: 'Denver', state: 'CO', airports: ['DEN'] },
  { name: 'Washington', state: 'DC', airports: ['DCA', 'IAD', 'BWI'] },
  { name: 'Boston', state: 'MA', airports: ['BOS'] },
  { name: 'Nashville', state: 'TN', airports: ['BNA'] },
  { name: 'Memphis', state: 'TN', airports: ['MEM'] },
  { name: 'Portland', state: 'OR', airports: ['PDX'] },
  { name: 'Las Vegas', state: 'NV', airports: ['LAS'] },
  { name: 'Detroit', state: 'MI', airports: ['DTW'] },
  { name: 'Atlanta', state: 'GA', airports: ['ATL'] },
  { name: 'Miami', state: 'FL', airports: ['MIA', 'FLL'] },
  { name: 'Minneapolis', state: 'MN', airports: ['MSP'] },
  { name: 'New Orleans', state: 'LA', airports: ['MSY'] },
  { name: 'Salt Lake City', state: 'UT', airports: ['SLC'] },
  { name: 'Pittsburgh', state: 'PA', airports: ['PIT'] },
  { name: 'Cincinnati', state: 'OH', airports: ['CVG'] },
  { name: 'Kansas City', state: 'MO', airports: ['MCI'] },
  { name: 'Orlando', state: 'FL', airports: ['MCO'] },
  { name: 'Tampa', state: 'FL', airports: ['TPA'] },
  { name: 'Raleigh', state: 'NC', airports: ['RDU'] },
  { name: 'Durham', state: 'NC', airports: ['RDU'] },
  { name: 'Chapel Hill', state: 'NC', airports: ['RDU'] },
  { name: 'St. Louis', state: 'MO', airports: ['STL'] },
  { name: 'Honolulu', state: 'HI', airports: ['HNL'] },
  { name: 'Anchorage', state: 'AK', airports: ['ANC'] },
  { name: 'Cleveland', state: 'OH', airports: ['CLE'] },
  { name: 'Milwaukee', state: 'WI', airports: ['MKE'] },
  { name: 'Sacramento', state: 'CA', airports: ['SMF'] },
  { name: 'Oakland', state: 'CA', airports: ['OAK'] },
]

// Derive a 3-letter IATA-shaped code from a user-typed city.
// Used by the profile preview row when the user entered a free-text city
// that didn't match the autocomplete.
export function primaryIataForCity(cityRaw: string): string {
  const city = cityRaw.trim()
  if (!city) return '···'
  const match = CITIES.find(c => c.name.toLowerCase() === city.toLowerCase())
  if (match) return match.airports[0]
  // Free-text fallback: first 3 alpha chars, uppercased.
  const letters = city.replace(/[^a-zA-Z]/g, '').toUpperCase()
  return letters.slice(0, 3).padEnd(3, '·')
}

export function searchCities(query: string, limit = 6): CityEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: CityEntry[] = []
  const contains: CityEntry[] = []
  for (const c of CITIES) {
    const n = c.name.toLowerCase()
    if (n.startsWith(q)) starts.push(c)
    else if (n.includes(q)) contains.push(c)
  }
  return [...starts, ...contains].slice(0, limit)
}
