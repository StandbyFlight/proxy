import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { supabase } from '../../../lib/supabase'
import {
  requestForegroundLocationPermission,
  subscribeToMatchLiveLocations,
  type LiveLocationRow,
} from '../../../lib/liveLocation'
import Mapbox from '@rnmapbox/maps'
import { BackButton } from '../../../components/BackButton'
import { MeetupMap } from '../../../components/MeetupMap'

// Set the public Mapbox access token once at module load. The secret DOWNLOAD
// token (build-time SDK fetch) lives in app.json's @rnmapbox/maps plugin.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN
if (MAPBOX_TOKEN) Mapbox.setAccessToken(MAPBOX_TOKEN)

// Mapbox meetup-navigation screen. Orchestration only — all @rnmapbox/maps JSX
// lives in <MeetupMap>. This screen NEVER touches match logic: it only reads the
// destination passed in as params and subscribes to the (opt-in) live-location
// rows to draw the partner marker. It renders for an already-mutual match; the
// live-location layer self-guards server-side.

type LatLng = { latitude: number; longitude: number }

export default function MatchMapScreen() {
  const { match_id, destinationName, destinationLat, destinationLng } =
    useLocalSearchParams<{
      match_id: string
      destinationName?: string
      destinationLat?: string
      destinationLng?: string
    }>()

  const insets = useSafeAreaInsets()

  // Parse destination coords; empty / NaN means "coordinates unavailable".
  const lat = parseFloat(destinationLat ?? '')
  const lng = parseFloat(destinationLng ?? '')
  const hasDestination = Number.isFinite(lat) && Number.isFinite(lng)

  const [showUser, setShowUser] = useState(false)
  const [partnerLocation, setPartnerLocation] = useState<LatLng | null>(null)
  const meRef = useRef<string | null>(null)

  // Request foreground permission once. Only after it's granted do we render the
  // current-user marker; denial leaves the map on the destination pin alone.
  useEffect(() => {
    let cancelled = false
    requestForegroundLocationPermission()
      .then((granted) => { if (!cancelled) setShowUser(granted) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Cache the auth user id so the live-location callback can tell self apart
  // from the partner without re-reading the session on every change.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) meRef.current = data.session?.user?.id ?? null
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Partner marker: only shown when the OTHER user has an active live-location
  // row (i.e. they opted into sharing). No row → no partner pin.
  useEffect(() => {
    if (!match_id) return
    const unsubscribe = subscribeToMatchLiveLocations(match_id, (rows: LiveLocationRow[]) => {
      const me = meRef.current
      const partner = me ? rows.find((r) => r.user_id !== me) : rows[0]
      setPartnerLocation(
        partner ? { latitude: partner.latitude, longitude: partner.longitude } : null
      )
    })
    return () => { unsubscribe() }
  }, [match_id])

  async function enableLocation() {
    const granted = await requestForegroundLocationPermission()
    setShowUser(granted)
  }

  // Fallback: no usable destination coordinates for this meetup.
  if (!hasDestination) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 14 }]}>
        <View style={styles.fallbackBack}><BackButton /></View>
        <Text style={[type.headline, styles.fallbackTitle]}>MAP UNAVAILABLE</Text>
        <Text style={styles.fallbackBody}>
          {destinationName
            ? `We couldn't place "${destinationName}" on the map yet.`
            : 'This meetup spot isn’t on the map yet.'}
        </Text>
        <Text style={styles.fallbackBody}>
          Use OPEN IN MAPS on the meetup screen for directions.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <MeetupMap
        destination={{ latitude: lat, longitude: lng, name: destinationName }}
        partnerLocation={partnerLocation}
        showUser={showUser}
      />

      {/* Floating back control over the map. */}
      <View style={[styles.overlayTop, { top: insets.top + 8 }]}>
        <View style={styles.overlayCard}>
          <BackButton />
        </View>
      </View>

      {/* Prompt to enable location if permission wasn't granted. */}
      {!showUser ? (
        <View style={[styles.overlayBottom, { bottom: insets.bottom + 20 }]}>
          <Pressable
            onPress={enableLocation}
            style={({ pressed }) => [styles.enableBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.enableBtnText}>ENABLE LOCATION</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },

  fallbackBack: { position: 'absolute', top: 0, left: 20 },
  fallbackTitle: { color: colors.text, textAlign: 'center' },
  fallbackBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.subtle,
    textAlign: 'center',
  },

  overlayTop: { position: 'absolute', left: 16 },
  overlayCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingRight: 16,
  },

  overlayBottom: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  enableBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  enableBtnText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.white,
  },
})
