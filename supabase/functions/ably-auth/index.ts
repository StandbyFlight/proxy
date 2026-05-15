import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const ABLY_KEY = Deno.env.get('ABLY_KEY')
  if (!ABLY_KEY) {
    console.error('ably-auth: ABLY_KEY secret is not set')
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing ABLY_KEY' }), { status: 500 })
  }

  // Verify the caller has a valid Supabase session.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('ably-auth: auth check failed:', authError?.message)
    return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), { status: 401 })
  }

  // Issue a short-lived Ably token scoped to only the channels this user needs:
  // their own notification channel and presence on any flight channel.
  const colonIdx = ABLY_KEY.indexOf(':')
  const keyId = ABLY_KEY.slice(0, colonIdx)
  const keySecret = ABLY_KEY.slice(colonIdx + 1)
  const credentials = btoa(`${keyId}:${keySecret}`)

  const tokenRes = await fetch(`https://rest.ably.io/keys/${keyId}/requestToken`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: user.id,
      capability: JSON.stringify({
        [`user:${user.id}`]: ['subscribe', 'publish'],
        'flight:*': ['presence', 'subscribe'],
      }),
      ttl: 3_600_000, // 1 hour in ms
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    console.error('ably-auth: Ably token request failed:', tokenRes.status, text)
    return new Response(JSON.stringify({ error: `Ably token request failed (${tokenRes.status}): ${text}` }), { status: 502 })
  }

  const token = await tokenRes.json()
  return new Response(JSON.stringify(token), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
