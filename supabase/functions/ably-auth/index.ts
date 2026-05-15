import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ABLY_KEY = Deno.env.get('ABLY_KEY')!

Deno.serve(async (req) => {
  // Verify the caller has a valid Supabase session.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Issue a short-lived Ably token scoped to only the channels this user needs:
  // their own notification channel and presence on any flight channel.
  const [keyId, keySecret] = ABLY_KEY.split(':')
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
    return new Response(JSON.stringify({ error: `Ably token request failed: ${text}` }), { status: 502 })
  }

  const token = await tokenRes.json()
  return new Response(JSON.stringify(token), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
