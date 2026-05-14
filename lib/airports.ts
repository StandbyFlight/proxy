// Terminal reachability map for top US airports.
// Each terminal lists which other terminals you can reach on foot or via tram in <20 min.
// Airports not in this map fall back to same-terminal-only matching.

export const REACHABILITY: Record<string, Record<string, string[]>> = {
  // Atlanta — all concourses connected by underground train
  ATL: {
    T:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
    A:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
    B:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
    C:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
    D:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
    E:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
    F:  ['T', 'A', 'B', 'C', 'D', 'E', 'F'],
  },

  // Los Angeles — terminals 1-3 and TBIT connected airside; T4-8 separate clusters
  LAX: {
    '1':    ['1', '2', '3', 'TBIT'],
    '2':    ['1', '2', '3', 'TBIT'],
    '3':    ['1', '2', '3', 'TBIT'],
    'TBIT': ['1', '2', '3', 'TBIT'],
    '4':    ['4', '5', '6', '7', '8'],
    '5':    ['4', '5', '6', '7', '8'],
    '6':    ['4', '5', '6', '7', '8'],
    '7':    ['4', '5', '6', '7', '8'],
    '8':    ['4', '5', '6', '7', '8'],
  },

  // Chicago O'Hare — T1/2/3 connected by tunnel; T5 (international) separate
  ORD: {
    '1': ['1', '2', '3'],
    '2': ['1', '2', '3'],
    '3': ['1', '2', '3'],
    '5': ['5'],
  },

  // Dallas/Fort Worth — all terminals connected by Skylink train
  DFW: {
    A: ['A', 'B', 'C', 'D', 'E'],
    B: ['A', 'B', 'C', 'D', 'E'],
    C: ['A', 'B', 'C', 'D', 'E'],
    D: ['A', 'B', 'C', 'D', 'E'],
    E: ['A', 'B', 'C', 'D', 'E'],
  },

  // Denver — all concourses connected by underground train
  DEN: {
    A: ['A', 'B', 'C'],
    B: ['A', 'B', 'C'],
    C: ['A', 'B', 'C'],
  },

  // JFK — terminals not connected airside; same-terminal only
  JFK: {
    '1': ['1'],
    '2': ['2'],
    '3': ['3'],
    '4': ['4'],
    '5': ['5'],
    '6': ['6'],
    '7': ['7'],
    '8': ['8'],
  },

  // San Francisco — all terminals connected by AirTrain
  SFO: {
    '1':  ['1', '2', '3', 'I'],
    '2':  ['1', '2', '3', 'I'],
    '3':  ['1', '2', '3', 'I'],
    'I':  ['1', '2', '3', 'I'],
  },

  // Seattle — main terminal + satellite connected by underground train
  SEA: {
    'Main':      ['Main', 'Satellite'],
    'Satellite': ['Main', 'Satellite'],
    'N':         ['Main', 'Satellite'],
    'S':         ['Main', 'Satellite'],
  },

  // Las Vegas — T1 and T3 are separate buildings
  LAS: {
    '1': ['1'],
    '3': ['3'],
    'D': ['D'],
    'E': ['E'],
  },

  // Orlando — A/B/C connected by tram inside security
  MCO: {
    A: ['A', 'B', 'C'],
    B: ['A', 'B', 'C'],
    C: ['A', 'B', 'C'],
  },
}

// Returns the list of terminals reachable from a given terminal at a given airport.
// Falls back to same-terminal-only if airport or terminal is not in the map.
export function getReachableTerminals(airportIata: string, terminal: string): string[] {
  const airportMap = REACHABILITY[airportIata.toUpperCase()]
  if (!airportMap) return [terminal]

  const normalized = terminal.toUpperCase().trim()
  return airportMap[normalized] ?? [normalized]
}
