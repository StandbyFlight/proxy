import Ably from 'ably'
import { supabase } from './supabase'

let _client: Ably.Realtime | null = null

export function getAblyClient(userId: string): Ably.Realtime {
  if (!_client) {
    _client = new Ably.Realtime({
      clientId: userId,

      authCallback: async (_tokenParams, callback) => {
        try {
          let { data: { session }, error: sessionError } = await supabase.auth.getSession()

          if (sessionError) throw sessionError

          // Session may be null if AsyncStorage hasn't finished loading or the
          // token expired — try a refresh before giving up.
          if (!session?.access_token) {
            const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
            if (refreshErr) throw refreshErr
            session = refreshed.session
          }

          if (!session?.access_token) {
            throw new Error('No Supabase session available for Ably auth')
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