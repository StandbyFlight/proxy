import Ably from 'ably'
import { supabase } from './supabase'

// Ably lifecycle rules:
//  - Never initialize before Supabase auth has a valid session. connectAbly()
//    is the safe entry point: it checks the session first and no-ops (with a
//    single clean warning) when logged out.
//  - The token authCallback re-checks the session on every (re)auth, so a
//    token renewal after sign-out fails fast with a non-retriable error
//    instead of hammering the ably-auth edge function with unauthorized calls.
//  - disconnectAbly() is called on SIGNED_OUT (see app/_layout.tsx).

let _client: Ably.Realtime | null = null

// Initialize (or return) the Ably client for the current authenticated user.
// Returns null — without calling the edge function — when there is no session.
export async function connectAbly(): Promise<Ably.Realtime | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    console.warn('Skipping Ably init: no auth session')
    return null
  }
  return getAblyClient(session.user.id)
}

export function getAblyClient(userId: string): Ably.Realtime {
  if (!_client) {
    _client = new Ably.Realtime({
      clientId: userId,

      authCallback: async (_tokenParams, callback) => {
        try {
          const { data: { session } } = await supabase.auth.getSession()

          if (!session?.access_token) {
            // Not an exceptional state — the user is simply logged out.
            // 403 is non-retriable for Ably, so it won't loop on this.
            console.warn('Skipping Ably auth: no Supabase session')
            callback(
              { code: 40100, statusCode: 403, message: 'No Supabase session' } as Ably.ErrorInfo,
              null as unknown as Ably.TokenDetails
            )
            return
          }

          const { data, error } = await supabase.functions.invoke('ably-auth', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          })

          if (error) {
            // Read the actual response body from the FunctionsHttpError context
            let errorBody: unknown = data
            const ctx = (error as unknown as { context?: Response }).context
            if (ctx instanceof Response) {
              try { errorBody = await ctx.clone().json() } catch (_) {
                try { errorBody = await ctx.clone().text() } catch (_) {}
              }
            }
            console.error('Ably auth edge function error:', error.message, 'body:', JSON.stringify(errorBody))
            throw error
          }

          callback(null, data as Ably.TokenDetails)
        } catch (e) {
          console.error('Ably auth failed:', e)
          callback(
            e instanceof Error ? e.message : String(e),
            null as unknown as Ably.TokenDetails
          )
        }
      },
    })
  }

  return _client
}

export function disconnectAbly() {
  _client?.close()
  _client = null
}

export function flightChannelName(flightIata: string, departureDate: string) {
  return `flight:${flightIata}:${departureDate}`
}

export function userChannelName(userId: string) {
  return `user:${userId}`
}
