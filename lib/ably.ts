import Ably from 'ably'

let _client: Ably.Realtime | null = null

export function getAblyClient(userId: string): Ably.Realtime {
  if (!_client) {
    _client = new Ably.Realtime({
      key: process.env.EXPO_PUBLIC_ABLY_KEY!,
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
