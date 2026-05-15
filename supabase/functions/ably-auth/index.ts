import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const ABLY_KEY = Deno.env.get('ABLY_KEY')
  if (!ABLY_KEY) {
    console.error('ably-auth: ABLY_KEY secret is not set')
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing ABLY_KEY' }), { status: 500 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('ably-auth: auth check failed:', authError?.message ?? 'no user')
    return new Response(JSON.stringify({ error: 'Unauthorized', detail: authError?.message }), { status: 401 })
  }

  const colonIdx = ABLY_KEY.indexOf(':')
  const keyId = ABLY_KEY.slice(0, colonIdx)
  const keySecret = ABLY_KEY.slice(colonIdx + 1)

  // Ably requires a signed TokenRequest — timestamp, nonce, and HMAC mac are mandatory.
  const ttl = 3_600_000
  const timestamp = Date.now()
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const capability = JSON.stringify({
    [`user:${user.id}`]: ['subscribe', 'publish'],
    'flight:*': ['presence', 'subscribe'],
  })

  // HMAC-SHA256: sign keyName\nttl\ncapability\nclientId\ntimestamp\nnonce\n
  const signText = `${keyId}\n${ttl}\n${capability}\n${user.id}\n${timestamp}\n${nonce}\n`
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signText))
  const mac = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))

  const tokenRes = await fetch(`https://rest.ably.io/keys/${keyId}/requestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyName: keyId, clientId: user.id, timestamp, nonce, ttl, capability, mac }),
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
