import { useCallback, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { passDate, passTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { BoardingPass } from '../../components/BoardingPass'
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

      haptics.success()
      // Confirming locks it in; the match stays reachable from the Match tab
      // and "how it went" is logged afterwards via the link below.
      router.replace('/(app)/')
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

        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>WHERE TO MEET</Text>
          <Text style={styles.locationValue}>{whereToMeet}</Text>
        </View>

        <View style={styles.wearingRow}>
          <View style={styles.wearingCell}>
            <Text style={styles.wearingLabel}>THEY'RE WEARING</Text>
            <Text style={styles.wearingValue}>{their.wearing || '—'}</Text>
          </View>
          <View style={styles.wearingCell}>
            <Text style={styles.wearingLabel}>YOU'RE WEARING</Text>
            {myWearing ? (
              <Text style={styles.wearingValue}>{myWearing}</Text>
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
        </View>

        <BoardingPass
          airline="STANDBY"
          classLabel="THEIR PASS"
          passenger={their.firstName}
          origin={their.originIata}
          destination={their.destinationIata}
          flight={their.flightIata}
          date={theirPassDate}
          time={theirPassTime}
          gate={their.gate}
          terminal={their.terminal}
          status="MATCHED"
          compact
        />

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
          <Pressable
            onPress={cancelMatch}
            style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.linkBtnText}>CANCEL</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            saving && styles.primaryBtnDisabled,
            pressed && !saving && { opacity: 0.85 },
          ]}
          onPress={() => { haptics.buttonTap(); confirm() }}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.onAccent} />
            : <Text style={styles.primaryBtnText}>Confirm meetup</Text>
          }
        </Pressable>
      </View>
    </View>
  )
}



const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 18 },

  eyebrow: { color: colors.subtle },

  poc: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },

  locationCard: {
    backgroundColor: colors.periwinkle,
    borderRadius: 4,
    padding: 16,
    gap: 6,
  },
  locationLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.text,
    opacity: 0.6,
  },
  locationValue: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.text,
  },

  wearingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wearingCell: {
    flex: 1,
    backgroundColor: colors.periwinkle,
    borderRadius: 4,
    padding: 12,
    gap: 4,
  },
  wearingLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.text,
    opacity: 0.6,
  },
  wearingValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  wearingInput: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 2,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
    backgroundColor: colors.bg,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.onAccent,
  },
})
