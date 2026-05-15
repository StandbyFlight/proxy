const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { flight_iata, flight_date } = await req.json()
    if (!flight_iata) {
      return new Response(JSON.stringify({ error: 'flight_iata required' }), { status: 400, headers: CORS })
    }

    const key = Deno.env.get('AVIATIONSTACK_KEY')
    if (!key) {
      return new Response(JSON.stringify({ error: 'AVIATIONSTACK_KEY not set' }), { status: 500, headers: CORS })
    }

    let url = `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${flight_iata.toUpperCase()}`
    if (flight_date) url += `&flight_date=${flight_date}`

    const res = await fetch(url)
    const json = await res.json()

    return new Response(JSON.stringify(json), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
