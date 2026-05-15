import Ably from 'ably'
import { supabase } from './supabase'

let _client: Ably.Realtime | null = null

export function getAblyClient(userId: string): Ably.Realtime {
  if (!_client) {
    _client = new Ably.Realtime({
      clientId: userId,

      authCallback: async (_tokenParams, callback) => {
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession()

          if (sessionError) {
            throw sessionError
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
            // data may contain the error body even on non-2xx
            console.error('Ably auth edge function error:', error.message, 'body:', JSON.stringify(data))
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