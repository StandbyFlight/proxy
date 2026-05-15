import Ably from 'ably'
import { supabase } from './supabase'

let _client: Ably.Realtime | null = null

// Uses server-issued short-lived tokens so the root API key is never shipped
// in the app bundle. The ably-auth edge function scopes the token to only the
// channels this user needs.
export function getAblyClient(userId: string): Ably.Realtime {
  if (!_client) {
    _client = new Ably.Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          const { data, error } = await supabase.functions.invoke('ably-auth')
          if (error) throw error
          callback(null, data)
        } catch (e) {
          callback(e instanceof Error ? e.message : String(e), null as unknown as Ably.TokenDetails)
        }
      },
      clientId: userId,
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
