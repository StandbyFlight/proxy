import { useCallback, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { passDate, passTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { completeMatchAndSession } from '../../lib/session'
import { BackButton } from '../../components/BackButton'

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
  const [mySessionId, setMySessionId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pointOfConnection, setPointOfConnection] = useState<string | null>(null)
  const [assignedLocation, setAssignedLocation] = useState<string | null>(null)
  const [myWearing, setMyWearing] = useState<string | null>(null)
  const [wearingDraft, setWearingDraft] = useState('')
  const [their, setTheir] = useState<TheirInfo | null>(null)
  const [myGate, setMyGate] = useState<string | null>(null)
  const [myDeparture, setMyDeparture] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const insets = useSafeAreaInsets()

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) { setLoading(false); return }

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
      setMySessionId((amA ? match.session_id_a : match.session_id_b) ?? null)
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
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [match_id]))

  async function confirm() {
    if (iAmA === null || saving) return
    setSaving(true)
    setError('')

    try {
      // Anchor the post-meetup prompt to 45 min before the earlier departure —
      // matched users may fly to different cities, so meetup happens pre-boarding.
      const myDep = myDeparture ? new Date(myDeparture) : null
      const theirDep = their?.departureTime ? new Date(their.departureTime) : null
      let meetup_time: string | null = null
      if (myDep && theirDep) {
        const earlier = myDep < theirDep ? myDep : theirDep
        meetup_time = new Date(earlier.getTime() - 45 * 60 * 1000).toISOString()
      } else if (myDep) {
        meetup_time = new Date(myDep.getTime() - 45 * 60 * 1000).toISOString()
      }

      const { error: updateErr } = await supabase
        .from('matches')
        .update({ meetup_time })
        .eq('id', match_id)

      if (updateErr) throw updateErr

      // Move the match mutual → completed and the session → completed. This is
      // the terminal transition: getActiveMatch returns null afterwards, so the
      // user is no longer looped back into the active meetup flow forever.
      if (mySessionId) {
        await completeMatchAndSession(match_id, mySessionId)
      }

      haptics.success()
      setSaved(true)
      // Land in history, where the completed pass now lives.
      setTimeout(() => router.replace('/(app)/history'), 900)
    } catch (err: any) {
      haptics.error()
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
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
          router.replace('/(app)/match/searching')
        },
      },
    ])
  }

  if (loading || !their || iAmA === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.subtle} />
      </View>
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
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton />

        <Text style={[type.eyebrow, styles.eyebrow]}>MATCHED · {their.firstName.toUpperCase()}</Text>

        {pointOfConnection ? (
          <Text style={[type.headline, styles.poc]}>{pointOfConnection}</Text>
        ) : null}

        {/* ── Boarding-pass ticket: the other person's pass ── */}
        <View style={styles.ticket}>
          <View style={styles.ticketHeader}>
            <Text style={styles.ticketHeaderLabel}>BOARDING PASS</Text>
            <Text style={styles.ticketWordmark}>STANDBY</Text>
          </View>

          <View style={styles.ticketBody}>
            {/* Punched perforation strip down the left edge */}
            <View style={styles.perforation} pointerEvents="none">
              {Array.from({ length: 14 }).map((_, i) => (
                <View key={i} style={styles.perfDot} />
              ))}
            </View>

            <View style={styles.ticketBox}>
              <Text style={styles.boxLabel}>NAME OF PASSENGER</Text>
              <Text style={styles.boxValue} numberOfLines={1}>
                {their.firstName ? their.firstName.toUpperCase() : '——'}
              </Text>
            </View>

            <View style={styles.ticketRow}>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>FROM</Text>
                <Text style={styles.boxValueLg} numberOfLines={1}>{their.originIata || '——'}</Text>
              </View>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>TO</Text>
                <Text style={styles.boxValueLg} numberOfLines={1}>{their.destinationIata || '——'}</Text>
              </View>
            </View>

            <View style={styles.ticketRow}>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>FLIGHT</Text>
                <Text style={styles.boxValue} numberOfLines={1}>{their.flightIata || '——'}</Text>
              </View>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>DATE</Text>
                <Text style={styles.boxValue} numberOfLines={1}>{theirPassDate || '——'}</Text>
              </View>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>TIME</Text>
                <Text style={styles.boxValue} numberOfLines={1}>{theirPassTime || '——'}</Text>
              </View>
            </View>

            <View style={styles.ticketRow}>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>GATE</Text>
                <Text style={styles.boxValue} numberOfLines={1}>{their.gate || '——'}</Text>
              </View>
              <View style={[styles.ticketBox, styles.rowBox]}>
                <Text style={styles.boxLabel}>TERM</Text>
                <Text style={styles.boxValue} numberOfLines={1}>{their.terminal || '——'}</Text>
              </View>
            </View>

            <Text style={styles.ticketBarcode}>
              SBY · {their.flightIata || '····'}{their.originIata ? ` · ${their.originIata}` : ''}
            </Text>

            <Text style={styles.ticketStamp}>STANDBY · CLEARED</Text>
          </View>
        </View>

        {/* ── Suggested meet spot ── */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>SUGGESTED MEET SPOT</Text>
          <Text style={styles.infoValue}>{spotName}</Text>
          {spotGuidance ? (
            <Text style={styles.infoBody}>
              Meet near {spotGuidance} — a central place for both of you.
            </Text>
          ) : null}
          <Pressable
            onPress={openInMaps}
            hitSlop={10}
            style={({ pressed }) => [styles.inlineLink, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.inlineLinkText}>OPEN IN MAPS</Text>
          </Pressable>
        </View>

        {/* ── How each of you is recognized ── */}
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>THEY'RE WEARING</Text>
          <Text style={styles.infoBody}>{their.wearing || '—'}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>YOU'RE WEARING</Text>
          {myWearing ? (
            <Text style={styles.infoBody}>{myWearing}</Text>
          ) : (
            <TextInput
              style={styles.wearingInput}
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
        <View style={styles.footerLinks}>
          <Pressable
            onPress={() => { haptics.buttonTap(); router.push({ pathname: '/(app)/chat', params: { match_id } }) }}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.linkBtnText}>MESSAGES</Text>
          </Pressable>
          <Pressable
            onPress={() => { haptics.buttonTap(); router.push({ pathname: '/(app)/post-meetup', params: { match_id } }) }}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.linkBtnText}>LOG HOW IT WENT</Text>
          </Pressable>
        </View>

        {saved ? (
          <Text style={styles.savedText}>Meetup saved to history.</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (saving || saved) && styles.primaryBtnDisabled,
            pressed && !saving && !saved && { opacity: 0.85 },
          ]}
          onPress={() => { haptics.buttonTap(); confirm() }}
          disabled={saving || saved}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.primaryBtnText}>{saved ? 'Saved' : 'Confirm meetup'}</Text>
          }
        </Pressable>

        <Pressable
          onPress={cancelMatch}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </Pressable>
      </View>
    </View>
  )
}



// Warm taupe ticket stock — a neutral surface, not one of the four accents, so
// the boarding pass reads as printed card against the white page.
const TICKET_STOCK = '#C9C3B6'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  inner: { paddingHorizontal: 20, gap: 16 },

  eyebrow: { color: colors.subtle },

  poc: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },

  // ── Boarding-pass ticket ──
  ticket: {
    backgroundColor: TICKET_STOCK,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  ticketHeader: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  ticketHeaderLabel: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.white,
  },
  ticketWordmark: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1,
    color: colors.white,
  },
  ticketBody: {
    position: 'relative',
    paddingTop: 16,
    paddingBottom: 14,
    paddingRight: 16,
    paddingLeft: 20,
    gap: 12,
  },
  perforation: {
    position: 'absolute',
    left: 3,
    top: 12,
    bottom: 12,
    width: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  perfDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg,
  },
  ticketBox: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  ticketRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rowBox: { flex: 1 },
  boxLabel: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  boxValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.black,
  },
  boxValueLg: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.black,
  },
  ticketBarcode: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    color: colors.subtle,
    marginTop: 4,
  },
  ticketStamp: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 172,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 4,
    color: colors.accent,
    opacity: 0.22,
    transform: [{ rotate: '-15deg' }],
  },

  // ── Outlined info boxes (meet spot + identification) ──
  infoBox: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 14,
    gap: 6,
    backgroundColor: colors.surface,
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
  wearingInput: {
    fontFamily: fonts.body,
    fontSize: 15,
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
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
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
  // Confirm meetup — the app's blue token, large / rounded / full-width.
  primaryBtn: {
    backgroundColor: colors.periwinkle,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 10,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.6,
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
