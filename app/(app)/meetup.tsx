import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { BoardingPass } from '../../components/BoardingPass'

type TheirInfo = {
  firstName: string
  flightIata: string | null
  originIata: string | null
  destinationIata: string | null
  gate: string | null
  terminal: string | null
  departureTime: string | null
}

export default function MeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()

  const [wearing, setWearing] = useState('')
  const [iAmA, setIAmA] = useState<boolean | null>(null)
  const [pointOfConnection, setPointOfConnection] = useState<string | null>(null)
  const [their, setTheir] = useState<TheirInfo | null>(null)
  const [myGate, setMyGate] = useState<string | null>(null)
  const [myDeparture, setMyDeparture] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const insets = useSafeAreaInsets()

  const canConfirm = wearing.trim().length > 0

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select(`
          point_of_connection,
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
      setMyGate(mySession?.gate ?? null)
      setMyDeparture(mySession?.departure_time ?? null)
      setTheir({
        firstName: theirUser?.first_name ?? 'Them',
        flightIata: theirFlight?.flight_iata ?? null,
        originIata: theirSession?.origin_iata ?? null,
        destinationIata: theirSession?.destination_iata ?? null,
        gate: theirSession?.gate ?? null,
        terminal: theirSession?.terminal ?? null,
        departureTime: theirSession?.departure_time ?? null,
      })
      setLoading(false)
    }
    load()
  }, [match_id])

  async function confirm() {
    if (!canConfirm || iAmA === null) return
    setSaving(true)
    setError('')

    try {
      // Anchor the post-meetup prompt to 45 min before the earlier departure.
      // The "after landing" slot is gone (matched users may be flying to
      // different cities), so meetup naturally happens pre-boarding.
      const myDep = myDeparture ? new Date(myDeparture) : null
      const theirDep = their?.departureTime ? new Date(their.departureTime) : null
      let meetup_time: string | null = null
      if (myDep && theirDep) {
        const earlier = myDep < theirDep ? myDep : theirDep
        meetup_time = new Date(earlier.getTime() - 45 * 60 * 1000).toISOString()
      } else if (myDep) {
        meetup_time = new Date(myDep.getTime() - 45 * 60 * 1000).toISOString()
      }

      const update = iAmA
        ? { wearing_a: wearing.trim(), meetup_time }
        : { wearing_b: wearing.trim(), meetup_time }

      const { error: updateErr } = await supabase
        .from('matches')
        .update(update)
        .eq('id', match_id)

      if (updateErr) throw updateErr

      haptics.success()
      router.replace({ pathname: '/(app)/post-meetup', params: { match_id } })
    } catch (err: any) {
      haptics.error()
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !their || iAmA === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.subtle} />
      </View>
    )
  }

  // Deterministic walk rule: the person with the LATER flight walks to the
  // other person's gate. The earlier-departing person stays near their own
  // gate so they don't miss boarding. Ties broken by iAmA so both sides agree.
  const myDep = myDeparture ? new Date(myDeparture) : null
  const theirDep = their.departureTime ? new Date(their.departureTime) : null
  let iWalk: boolean
  if (myDep && theirDep) {
    if (myDep.getTime() === theirDep.getTime()) iWalk = iAmA
    else iWalk = myDep > theirDep
  } else {
    iWalk = iAmA
  }

  let directive: string
  let directiveSub: string | null = null
  if (iWalk) {
    if (their.gate) {
      directive = `Head to Gate ${their.gate}.`
      directiveSub = `Their flight leaves first. Meet them there.`
    } else {
      directive = `Find ${their.firstName} at their gate.`
      directiveSub = `Their flight leaves first.`
    }
  } else {
    if (myGate) {
      directive = `${their.firstName} is coming to Gate ${myGate}.`
      directiveSub = `Your flight leaves first. Stay put.`
    } else {
      directive = `${their.firstName} is coming to you.`
      directiveSub = `Your flight leaves first.`
    }
  }

  const theirPassDate = their.departureTime ? passDate(their.departureTime) : null
  const theirPassTime = their.departureTime ? passTime(their.departureTime) : null

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => { haptics.buttonTap(); router.replace('/(app)/') }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Meetup</Text>

        {pointOfConnection ? (
          <View style={styles.pocWrap}>
            <Text style={styles.pocLabel}>WHY YOU MATCHED</Text>
            <Text style={styles.pocText}>{pointOfConnection}</Text>
          </View>
        ) : null}

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
          compact
        />

        <View style={styles.directiveWrap}>
          <Text style={styles.directiveLabel}>WHERE TO MEET</Text>
          <Text style={styles.directiveText}>{directive}</Text>
          {directiveSub ? <Text style={styles.directiveSub}>{directiveSub}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What are you wearing?</Text>
          <TextInput
            style={styles.input}
            placeholder="Navy puffer, red backpack"
            placeholderTextColor={colors.subtle}
            value={wearing}
            onChangeText={setWearing}
            maxLength={80}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!canConfirm || saving) && styles.primaryBtnDisabled,
            pressed && canConfirm && { opacity: 0.85 },
          ]}
          onPress={() => { haptics.buttonTap(); confirm() }}
          disabled={!canConfirm || saving}
        >
          {saving
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.primaryBtnText}>Confirm meetup</Text>
          }
        </Pressable>
      </View>
    </View>
  )
}

function passDate(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

function passTime(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 22 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: { fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, letterSpacing: 1.4 },

  eyebrow: { ...type.eyebrow, color: colors.subtle },

  pocWrap: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 14,
    gap: 4,
  },
  pocLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.subtle,
  },
  pocText: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },

  directiveWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 6,
  },
  directiveLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  directiveText: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  directiveSub: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.subtle,
    lineHeight: 18,
  },

  section: { gap: 12 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  input: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  errorText: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.error,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10,10,10,0.08)',
    backgroundColor: colors.bg,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bg,
  },
})
