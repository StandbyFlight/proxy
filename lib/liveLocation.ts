import * as Location from 'expo-location'
import { supabase } from './supabase'

/**
 * Live location sharing for a MUTUAL match.
 *
 * Design rules (enforced throughout this module):
 * - Sharing only ever runs for a match whose `matches.status === 'mutual'`.
 * - Sharing is opt-in: it only starts via `startMatchLocationSharing`, which self-guards.
 * - `expires_at` is written on EVERY upsert so stale rows self-expire server-side.
 * - We only ever upsert the single latest row per user (onConflict match_id,user_id);
 *   we never append location history / route paths.
 * - Sharing stops automatically when both users have arrived, or when the match
 *   is no longer mutual.
 */

/** A row of the `match_live_locations` table. */
export type LiveLocationRow = {
  match_id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  arrived: boolean
  updated_at: string
  expires_at: string
}

/** Handle returned by `startMatchLocationSharing` to stop an active share. */
export type LiveLocationHandle = {
  matchId: string
  /** Stops the watch subscription and deletes this user's row. */
  stop: () => Promise<void>
}

/** Default TTL (seconds) applied to `expires_at` on every write. */
const DEFAULT_TTL_SECONDS = 120

/** Default arrival radius (meters) for destination proximity. */
const DEFAULT_ARRIVAL_RADIUS_METERS = 75

/**
 * Request foreground location permission.
 * @returns true only if granted. Never throws.
 */
export async function requestForegroundLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

/**
 * Reads `matches.status` and reports whether the match is mutual.
 * Never throws — returns false on any error.
 */
export async function isMatchMutual(matchId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('status')
      .eq('id', matchId)
      .single()
    if (error || !data) return false
    return data.status === 'mutual'
  } catch {
    return false
  }
}

/**
 * Upsert this user's single latest live-location row.
 * Always refreshes `updated_at` and `expires_at`. Never throws.
 * No-op if there is no authenticated user.
 */
export async function upsertLiveLocation(params: {
  matchId: string
  latitude: number
  longitude: number
  accuracy?: number | null
  arrived?: boolean
  ttlSeconds?: number
}): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return

    const now = Date.now()
    const ttlSeconds = params.ttlSeconds ?? DEFAULT_TTL_SECONDS

    const row: LiveLocationRow = {
      match_id: params.matchId,
      user_id: userId,
      latitude: params.latitude,
      longitude: params.longitude,
      accuracy: params.accuracy ?? null,
      arrived: params.arrived ?? false,
      updated_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
    }

    await supabase
      .from('match_live_locations')
      .upsert(row, { onConflict: 'match_id,user_id' })
  } catch {
    // swallow — location sharing must never crash the caller
  }
}

/**
 * Start sharing live location for a mutual match.
 * Self-guards: returns null unless the match is mutual AND permission is granted.
 */
export async function startMatchLocationSharing(params: {
  matchId: string
  destination?: { latitude: number; longitude: number } | null
  arrivalRadiusMeters?: number
  onUpdate?: (loc: { latitude: number; longitude: number; accuracy: number | null }) => void
  onError?: (e: unknown) => void
}): Promise<LiveLocationHandle | null> {
  const { matchId, destination, arrivalRadiusMeters, onUpdate, onError } = params

  // GUARD 1: only share for a mutual match.
  if (!(await isMatchMutual(matchId))) return null

  // GUARD 2: only share with granted foreground permission.
  if (!(await requestForegroundLocationPermission())) return null

  let subscription: Location.LocationSubscription | null = null
  let stopped = false

  const stop = async (): Promise<void> => {
    if (stopped) return
    stopped = true
    try {
      subscription?.remove()
    } catch {
      // ignore
    }
    subscription = null
    await stopMatchLocationSharing(matchId)
  }

  try {
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10, // meters
        timeInterval: 5000, // ms
      },
      async (position) => {
        if (stopped) return
        try {
          // Re-check mutual status on each fix; stop if it changed.
          if (!(await isMatchMutual(matchId))) {
            await stop()
            return
          }

          const latitude = position.coords.latitude
          const longitude = position.coords.longitude
          const accuracy = position.coords.accuracy ?? null

          await upsertLiveLocation({ matchId, latitude, longitude, accuracy })
          onUpdate?.({ latitude, longitude, accuracy })

          if (destination) {
            await markArrivedIfWithinDestinationRadius({
              matchId,
              latitude,
              longitude,
              destination,
              radiusMeters: arrivalRadiusMeters,
            })
            const bothArrived = await stopSharingIfBothArrived(matchId)
            if (bothArrived) await stop()
          }
        } catch (e) {
          onError?.(e)
        }
      }
    )
  } catch (e) {
    onError?.(e)
    return null
  }

  return { matchId, stop }
}

/**
 * Manual stop + cleanup: delete this user's row for the match. Never throws.
 */
export async function stopMatchLocationSharing(matchId: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return

    await supabase
      .from('match_live_locations')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', userId)
  } catch {
    // swallow
  }
}

/**
 * Subscribe to all live-location rows for a match.
 * Performs an initial select, then re-selects on any realtime change.
 * @returns an unsubscribe function that removes the channel.
 */
export function subscribeToMatchLiveLocations(
  matchId: string,
  onChange: (rows: LiveLocationRow[]) => void
): () => void {
  const refresh = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('match_live_locations')
        .select('*')
        .eq('match_id', matchId)
      if (error || !data) return
      onChange(data as LiveLocationRow[])
    } catch {
      // swallow
    }
  }

  // Initial load.
  void refresh()

  const channel = supabase
    .channel(`live-loc-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT / UPDATE / DELETE
        schema: 'public',
        table: 'match_live_locations',
        filter: `match_id=eq.${matchId}`,
      },
      () => {
        void refresh()
      }
    )
    .subscribe()

  return () => {
    try {
      void supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

/**
 * Mark this user as arrived if within `radiusMeters` of the destination.
 * Preserves the current lat/lng on the arrival write.
 * @returns true if within radius (and marked arrived), false otherwise.
 */
export async function markArrivedIfWithinDestinationRadius(params: {
  matchId: string
  latitude: number
  longitude: number
  destination: { latitude: number; longitude: number }
  radiusMeters?: number
}): Promise<boolean> {
  const radius = params.radiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS
  const distance = haversineMeters(
    params.latitude,
    params.longitude,
    params.destination.latitude,
    params.destination.longitude
  )

  if (distance <= radius) {
    await upsertLiveLocation({
      matchId: params.matchId,
      latitude: params.latitude,
      longitude: params.longitude,
      arrived: true,
    })
    return true
  }
  return false
}

/**
 * If exactly two rows exist for the match and BOTH have arrived,
 * stop this user's own sharing (delete this user's row).
 * @returns true if both arrived (and we stopped), false otherwise.
 */
export async function stopSharingIfBothArrived(matchId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('match_live_locations')
      .select('*')
      .eq('match_id', matchId)
    if (error || !data) return false

    const rows = data as LiveLocationRow[]
    if (rows.length === 2 && rows.every((r) => r.arrived === true)) {
      await stopMatchLocationSharing(matchId)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Haversine great-circle distance in meters between two lat/lng points.
 */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
