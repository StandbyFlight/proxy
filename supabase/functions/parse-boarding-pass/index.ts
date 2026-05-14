import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { image_base64, media_type = 'image/jpeg' } = await req.json()

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
              text: `Extract the following from this boarding pass image. Return ONLY valid JSON with no explanation or markdown:
{
  "flight_number": "carrier code + flight number, e.g. AA1234",
  "origin": "3-letter IATA departure airport code, e.g. JFK",
  "destination": "3-letter IATA arrival airport code, e.g. SFO",
  "departure_date": "YYYY-MM-DD format",
  "departure_time": "HH:MM in 24-hour format, e.g. 14:35",
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
