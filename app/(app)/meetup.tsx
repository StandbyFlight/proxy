import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, radius, shadow } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { passDate, passTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { resolveMeetupDestination } from '../../lib/airportPois'
import {
  requestForegroundLocationPermission,
  startMatchLocationSharing,
  stopMatchLocationSharing,
  subscribeToMatchLiveLocations,
  type LiveLocationHandle,
  type LiveLocationRow,
} from '../../lib/liveLocation'
import { Feather } from '@expo/vector-icons'
import { BackButton } from '../../components/BackButton'
import { BoardingPass } from '../../components/BoardingPass'
import { MeetupMap } from '../../components/MeetupMap'
import { GradientBackground, GlassButton, GlassCard } from '../../components/ui'

// The confirmed-match screen. Both users land here at the same time once both
// accept. Shows: the app-assigned meeting location, each side's identifying
// info (collected at accept, before this screen renders), and the other
// person's pass. This screen stays reachable (Match tab → match/room → here)
// for the whole session — leaving it never cancels the match.

type TheirInfo = {
  firstName: string
  wearing: string | null
  flightIata: string | null
  originIata: string | null
  destinationIata: string | null
  gate: string | null
  terminal: string | null
  departureTime: string | null
}

export default function MeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()

  const [iAmA, setIAmA] = useState<boolean | null>(null)
  const [pointOfConnection, setPointOfConnection] = useState<string | null>(null)
  const [assignedLocation, setAssignedLocation] = useState<string | null>(null)
  const [myWearing, setMyWearing] = useState<string | null>(null)
  const [wearingDraft, setWearingDraft] = useState('')
  const [their, setTheir] = useState<TheirInfo | null>(null)
  const [myGate, setMyGate] = useState<string | null>(null)
  const [myDeparture, setMyDeparture] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Unread-badge state (additive, isolated to this screen). `hasUnread` drives
  // the red dot on the MESSAGES button; `lastPartnerAt` is the newest partner
  // message timestamp we know about, used to advance the AsyncStorage marker.
  const [hasUnread, setHasUnread] = useState(false)
  const [lastPartnerAt, setLastPartnerAt] = useState<string | null>(null)

  // Live-location + map integration (additive, isolated to this screen).
  const [mapDestination, setMapDestination] =
    useState<{ name: string; latitude: number; longitude: number } | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [arrivalText, setArrivalText] = useState<string | null>(null)
  const [showUser, setShowUser] = useState(false)
  const [partnerLocation, setPartnerLocation] =
    useState<{ latitude: number; longitude: number } | null>(null)
  const shareHandleRef = useRef<LiveLocationHandle | null>(null)
  const meRef = useRef<string | null>(null)

  const router = useRouter()
  const insets = useSafeAreaInsets()

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) { setLoading(false); return }
      meRef.current = session.user.id

      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select(`
          point_of_connection, suggested_meetup_location,
          wearing_a, wearing_b,
          session_id_a, session_id_b,
          session_a:sessions!session_id_a(
            user_id, departure_time, origin_iata, destination_iata, gate, terminal,
            flights(flight_iata),
            users!user_id(first_name)
          ),
          session_b:sessions!session_id_b(
            user_id, departure_time, origin_iata, destination_iata, gate, terminal,
            flights(flight_iata),
            users!user_id(first_name)
          )
        `)
        .eq('id', match_id)
        .single()

      if (cancelled) return
      if (matchErr || !match) { setLoading(false); return }

      const sessionA = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
      const sessionB = Array.isArray(match.session_b) ? match.session_b[0] : match.session_b
      const amA = sessionA?.user_id === session.user.id
      const mySession = amA ? sessionA : sessionB
      const theirSession = amA ? sessionB : sessionA

      const theirFlight = theirSession?.flights
        ? (Array.isArray(theirSession.flights) ? theirSession.flights[0] : theirSession.flights)
        : null
      const theirUser = theirSession?.users
        ? (Array.isArray(theirSession.users) ? theirSession.users[0] : theirSession.users)
        : null

      setIAmA(amA)
      setPointOfConnection(match.point_of_connection ?? null)
      setAssignedLocation(match.suggested_meetup_location ?? null)
      setMyWearing((amA ? match.wearing_a : match.wearing_b) ?? null)
      setMyGate(mySession?.gate ?? null)
      setMyDeparture(mySession?.departure_time ?? null)
      setTheir({
        firstName: theirUser?.first_name ?? 'Them',
        wearing: (amA ? match.wearing_b : match.wearing_a) ?? null,
        flightIata: theirFlight?.flight_iata ?? null,
        originIata: theirSession?.origin_iata ?? null,
        destinationIata: theirSession?.destination_iata ?? null,
        gate: theirSession?.gate ?? null,
        terminal: theirSession?.terminal ?? null,
        departureTime: theirSession?.departure_time ?? null,
      })

      // Resolve the map/live-location destination from the assigned meetup
      // location + the shared origin airport. Single-airport (RDU-style) matches
      // share the origin, so origin_iata identifies the airport for both sides.
      // resolveMeetupDestination is read-only and never throws.
      const airportIata = theirSession?.origin_iata ?? mySession?.origin_iata ?? null
      const resolved = await resolveMeetupDestination({
        suggestedMeetupLocation: match.suggested_meetup_location ?? null,
        airportIata,
      })
      if (!cancelled) {
        setMapDestination(
          resolved
            ? { name: resolved.name, latitude: resolved.latitude, longitude: resolved.longitude }
            : null
        )
      }

      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [match_id]))

  // Unread badge (additive, read-only). Finds the newest message from the
  // partner and compares it against an AsyncStorage "seen" marker; also listens
  // for realtime INSERTs. Never blocks render; all queries are guarded.
  useEffect(() => {
    let cancelled = false
    let me: string | null = null

    async function checkUnread() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || cancelled) return
        me = session.user.id
        const { data: latest } = await supabase
          .from('messages')
          .select('sender_id, sent_at')
          .eq('match_id', match_id)
          .neq('sender_id', me)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cancelled || !latest) return
        setLastPartnerAt(latest.sent_at)
        const seen = await AsyncStorage.getItem(`chat-seen-${match_id}`)
        if (cancelled) return
        if (!seen || new Date(latest.sent_at) > new Date(seen)) {
          setHasUnread(true)
        }
      } catch {
        // Non-fatal: a missing badge should never break the screen.
      }
    }
    checkUnread()

    const channel = supabase
      .channel(`meetup-messages-${match_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match_id}` },
        (payload) => {
          const msg = payload.new as { sender_id: string; sent_at: string }
          if (me && msg.sender_id !== me) {
            setLastPartnerAt(msg.sent_at)
            setHasUnread(true)
          }
        }
      )
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [match_id])

  // Live-location arrival status (additive, read-only subscription). Derives a
  // status string from the two rows' `arrived` flags; self vs partner is decided
  // by the cached auth id. Never writes match state.
  useEffect(() => {
    const unsubscribe = subscribeToMatchLiveLocations(match_id, (rows: LiveLocationRow[]) => {
      const me = meRef.current
      const mine = me ? rows.find((r) => r.user_id === me) ?? null : null
      const partner = me ? rows.find((r) => r.user_id !== me) ?? null : rows[0] ?? null

      // Drive the embedded map's partner marker: show it only while the other
      // user is actively sharing (i.e. has a live row).
      setPartnerLocation(
        partner ? { latitude: partner.latitude, longitude: partner.longitude } : null
      )

      const iArrived = mine?.arrived === true
      const theyArrived = partner?.arrived === true

      if (iArrived && theyArrived) {
        setArrivalText('Both of you have arrived — sharing stopped')
      } else if (iArrived && !theyArrived) {
        setArrivalText(`Waiting for ${their?.firstName ?? 'them'} to arrive`)
      } else if (iArrived) {
        setArrivalText('You’ve arrived')
      } else {
        setArrivalText(null)
      }
    })
    return () => { unsubscribe() }
  }, [match_id, their?.firstName])

  // Request foreground location once so the embedded map can render the user's
  // own position dot. Non-blocking; denial just leaves the map without it.
  useEffect(() => {
    let cancelled = false
    requestForegroundLocationPermission()
      .then((granted) => { if (!cancelled) setShowUser(granted) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Mark the thread seen, clear the dot, then open the existing chat route.
  function openMessages() {
    haptics.buttonTap()
    const seenAt = lastPartnerAt ?? new Date().toISOString()
    AsyncStorage.setItem(`chat-seen-${match_id}`, seenAt).catch(() => {})
    setHasUnread(false)
    router.push({ pathname: '/(app)/chat', params: { match_id } })
  }

  // Start live sharing. startMatchLocationSharing self-guards on mutual status
  // and location permission, returning null if either fails.
  async function startSharing() {
    if (isSharing || shareHandleRef.current) return
    haptics.buttonTap()
    const handle = await startMatchLocationSharing({
      matchId: match_id,
      destination: mapDestination
        ? { latitude: mapDestination.latitude, longitude: mapDestination.longitude }
        : null,
    })
    if (!handle) {
      setError('Couldn’t start location sharing.')
      return
    }
    shareHandleRef.current = handle
    setIsSharing(true)
  }

  // Stop live sharing (OFF toggle + STOP SHARING button).
  async function stopSharing() {
    haptics.selection()
    const handle = shareHandleRef.current
    shareHandleRef.current = null
    setIsSharing(false)
    if (handle) await handle.stop()
    else await stopMatchLocationSharing(match_id)
  }

  function toggleSharing() {
    if (isSharing) { void stopSharing() } else { void startSharing() }
  }

  // Recovery path: matches made before wearing was collected at accept time
  // (or whose write failed) can still fill it in here.
  async function saveWearing() {
    const value = wearingDraft.trim()
    if (!value || iAmA === null) return
    haptics.selection()
    const update = iAmA ? { wearing_a: value } : { wearing_b: value }
    const { error: wearingErr } = await supabase
      .from('matches').update(update).eq('id', match_id)
    if (wearingErr) {
      setError('Could not save. Try again.')
      return
    }
    setMyWearing(value)
  }

  function cancelMatch() {
    Alert.alert('Cancel this match?', 'They’ll be released back to searching.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel match',
        style: 'destructive',
        onPress: async () => {
          haptics.selection()
          await supabase.from('matches').update({ status: 'declined' }).eq('id', match_id)
          // Tear down our own live-location row when we cancel (does not touch
          // match logic — the status write above is unchanged).
          if (shareHandleRef.current) await shareHandleRef.current.stop()
          else await stopMatchLocationSharing(match_id)
          shareHandleRef.current = null
          router.replace('/(app)/match/searching')
        },
      },
    ])
  }

  if (loading || !their || iAmA === null) {
    return (
      <GradientBackground>
        <View style={[styles.root, styles.center]}>
          <ActivityIndicator color={colors.subtle} />
        </View>
      </GradientBackground>
    )
  }

  // Fallback directive when the matcher didn't assign a location (legacy
  // matches): the later-departing person walks to the other's gate.
  let whereToMeet = assignedLocation
  if (!whereToMeet) {
    const myDep = myDeparture ? new Date(myDeparture) : null
    const theirDep = their.departureTime ? new Date(their.departureTime) : null
    const iWalk = myDep && theirDep ? myDep > theirDep : iAmA
    whereToMeet = iWalk
      ? (their.gate ? `Gate ${their.gate}` : `${their.firstName}'s gate`)
      : (myGate ? `Gate ${myGate}` : 'Your gate')
  }

  // Curated spots are stored as "<name> — <walking guidance>" (see
  // supabase/functions/_shared/meetupLocations.ts). Split for display;
  // legacy single-line values render unchanged.
  const dashIdx = whereToMeet.indexOf(' — ')
  const spotName = dashIdx > 0 ? whereToMeet.slice(0, dashIdx) : whereToMeet
  const spotGuidance = dashIdx > 0 ? whereToMeet.slice(dashIdx + 3) : null

  function openInMaps() {
    haptics.buttonTap()
    const airport = their?.originIata ? `${their.originIata} airport` : 'airport'
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spotName} ${airport}`)}`
    Linking.openURL(url).catch(() => {})
  }

  const theirPassDate = their.departureTime ? passDate(their.departureTime) : null
  const theirPassTime = their.departureTime ? passTime(their.departureTime) : null

  return (
    <GradientBackground>
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton />

        {pointOfConnection ? (
          <Text style={[type.headline, styles.poc]}>{pointOfConnection}</Text>
        ) : null}

        {/* ── Boarding pass: the other person's pass (shared component, same
            style as History for consistency) ── */}
        <BoardingPass
          classLabel="MEETUP PASS"
          passenger={their.firstName}
          origin={their.originIata}
          destination={their.destinationIata}
          flight={their.flightIata}
          date={theirPassDate}
          time={theirPassTime}
          gate={their.gate}
          terminal={their.terminal}
          status="MATCHED"
        />

        {/* ── Suggested meet spot ── */}
        <GlassCard rounded="lg" tint="sky">
          <Text style={styles.infoValue}>{spotName}</Text>
          {spotGuidance ? (
            <Text style={[styles.infoBody, styles.infoBodyGap]}>
              Meet near {spotGuidance} — a central place for both of you.
            </Text>
          ) : null}
          {arrivalText ? (
            <Text style={[styles.arrivalText, styles.infoBodyGap]}>{arrivalText}</Text>
          ) : null}
        </GlassCard>

        {/* ── Embedded meetup map ── */}
        {mapDestination ? (
          <View style={styles.mapCard}>
            <MeetupMap
              destination={{
                latitude: mapDestination.latitude,
                longitude: mapDestination.longitude,
                name: mapDestination.name,
              }}
              partnerLocation={partnerLocation}
              showUser={showUser}
            />
          </View>
        ) : (
          <View style={[styles.infoBox, styles.mapFallback]}>
            <Text style={styles.infoBody}>Map preview isn’t available for this spot yet.</Text>
          </View>
        )}

        {/* ── Live-location sharing: primary-style button below the map ── */}
        <GlassButton
          label={isSharing ? 'STOP SHARING LOCATION' : 'SHARE LIVE LOCATION'}
          variant={isSharing ? 'secondary' : 'primary'}
          onPress={toggleSharing}
          style={styles.shareBtn}
        />

        {/* ── Actions: open in maps + open the logistics thread ── */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={openInMaps}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="map-pin" size={18} color={colors.black} />
            <Text style={styles.actionBtnText}>OPEN IN MAPS</Text>
          </Pressable>
          <Pressable
            onPress={openMessages}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.actionGlyphWrap}>
              <Feather name="message-square" size={18} color={colors.black} />
              {hasUnread ? <View style={styles.unreadDot} /> : null}
            </View>
            <Text style={styles.actionBtnText}>MESSAGES</Text>
          </Pressable>
        </View>

        {/* ── How each of you is recognized — underlined text fields ── */}
        <View style={styles.wearingField}>
          <Text style={styles.boxLabel}>THEY'RE WEARING</Text>
          <Text style={styles.wearingValue}>{their.wearing || '—'}</Text>
        </View>
        <View style={styles.wearingField}>
          <Text style={styles.boxLabel}>YOU'RE WEARING</Text>
          {myWearing ? (
            <Text style={styles.wearingValue}>{myWearing}</Text>
          ) : (
            <TextInput
              style={styles.wearingValue}
              placeholder="Navy puffer…"
              placeholderTextColor={colors.subtle}
              value={wearingDraft}
              onChangeText={setWearingDraft}
              onSubmitEditing={saveWearing}
              onBlur={saveWearing}
              returnKeyType="done"
              maxLength={80}
              selectionColor={colors.accent}
            />
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <GlassButton
          label="LOG HOW IT WENT"
          variant="primary"
          onPress={() => router.push({ pathname: '/(app)/post-meetup', params: { match_id } })}
        />

        <GlassButton
          label="CANCEL"
          variant="ghost"
          onPress={cancelMatch}
        />
      </View>
    </View>
    </GradientBackground>
  )
}



const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner: { paddingHorizontal: 20, gap: 16 },
  infoBodyGap: { marginTop: 6 },

  poc: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },

  boxLabel: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },

  // ── Embedded meetup map ──
  mapCard: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  mapFallback: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Share live location — full-width glass button (style override) ──
  shareBtn: {},

  // ── Info box (map fallback) ──
  infoBox: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
    borderRadius: radius.lg,
    padding: 16,
    gap: 6,
    backgroundColor: colors.glassWhite,
  },

  // ── Action row: two equal glass pill buttons with glyphs ──
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: colors.glassWhiteStrong,
    ...shadow.sm,
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  actionGlyphWrap: {
    position: 'relative',
  },
  // Arrival status line inside the meet-spot infoBox.
  arrivalText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.accent,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  infoValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.text,
  },
  infoBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  inlineLink: { alignSelf: 'flex-start', paddingTop: 2 },
  inlineLinkText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  // Underlined text field (label + value with a thin bottom rule) — replaces
  // the old black-boxed "wearing" rows.
  wearingField: {
    gap: 5,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wearingValue: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    paddingVertical: 2,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderHair,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
  },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  savedText: {
    fontFamily: fonts.body,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.text,
    textAlign: 'center',
  },
  // Log how it went — red accent, compact, sharp corners, centered.
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 0,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.white,
  },
  // Cancel — minimal, centered beneath the main button.
  cancelBtn: { alignSelf: 'center', paddingVertical: 6 },
  cancelBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
})
