import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Server-side field validation. Model output is never trusted directly —
// every date/time/IATA field is checked for shape and consistency before it
// reaches the client, so a mis-read pass can't corrupt session dates.
function sanitize(parsed: Record<string, unknown>, todayISO: string) {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const iata = (v: unknown) => {
    const s = str(v)
    return s && /^[A-Za-z]{3}$/.test(s) ? s.toUpperCase() : null
  }
  const isoDate = (v: unknown) => {
    const s = str(v)
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) return null
    return s
  }
  const hhmm = (v: unknown) => {
    const s = str(v)
    if (!s) return null
    const m = s.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h > 23 || min > 59) return null
    return `${String(h).padStart(2, '0')}:${m[2]}`
  }

  // Boarding passes rarely print the year; a mis-inferred past year is the
  // classic corruption. Past dates are dropped here (client falls back to
  // today and asks the user to confirm).
  let departureDate = isoDate(parsed.departure_date)
  if (departureDate && departureDate < todayISO) departureDate = null

  const departureTime = hhmm(parsed.departure_time)
  let boardingTime = hhmm(parsed.boarding_time)
  // Consistency: boarding must precede departure. If it doesn't, the model
  // swapped or mis-read a field — drop boarding rather than store a lie.
  if (boardingTime && departureTime && boardingTime >= departureTime) {
    boardingTime = null
  }

  let arrivalDate = isoDate(parsed.arrival_date)
  // Arrival can't be before departure.
  if (arrivalDate && departureDate && arrivalDate < departureDate) arrivalDate = null

  const flightRaw = str(parsed.flight_number)
  const flightNumber =
    flightRaw && /^[A-Za-z0-9]{2}\s?\d{1,4}[A-Za-z]?$/.test(flightRaw)
      ? flightRaw.replace(/\s+/g, '').toUpperCase()
      : null

  return {
    flight_number: flightNumber,
    origin: iata(parsed.origin),
    destination: iata(parsed.destination),
    departure_date: departureDate,
    departure_time: departureTime,
    boarding_time: boardingTime,
    arrival_date: arrivalDate,
    terminal: str(parsed.terminal),
    gate: str(parsed.gate),
    passenger_name: str(parsed.passenger_name),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { image_base64, media_type = 'image/jpeg' } = await req.json()

    const todayISO = new Date().toISOString().split('T')[0]

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type, data: image_base64 },
            },
            {
              type: 'text',
              text: `Today's date is ${todayISO}. Extract the following from this boarding pass image. Boarding passes often omit the year — if the year is not printed, infer it from today's date (the flight must be on or after today). Use null for anything not printed. Return ONLY valid JSON with no explanation or markdown:
{
  "flight_number": "carrier code + flight number, e.g. AA1234",
  "origin": "3-letter IATA departure airport code, e.g. JFK",
  "destination": "3-letter IATA arrival airport code, e.g. SFO",
  "departure_date": "YYYY-MM-DD format",
  "departure_time": "HH:MM in 24-hour format, e.g. 14:35",
  "boarding_time": "HH:MM in 24-hour format, or null if not shown",
  "arrival_date": "YYYY-MM-DD arrival date if printed, else null",
  "terminal": "departure terminal or null if not shown",
  "gate": "departure gate or null if not shown",
  "passenger_name": "as printed on the pass"
}`,
            },
          ],
        },
      ],
    })

    const raw = (message.content[0] as Anthropic.TextBlock).text.trim()
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)

    return new Response(JSON.stringify(sanitize(parsed, todayISO)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
