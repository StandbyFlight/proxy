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

const SLOTS = [
  { key: 'before', label: 'Before boarding', desc: 'Near your gate, ~45 min before departure' },
  { key: 'after', label: 'After landing', desc: 'Baggage claim, ~20 min after arrival' },
]

function getMeetingLocationHint(
  myTerminal: string | null,
  theirTerminal: string | null,
): string {
  if (!myTerminal && !theirTerminal) return 'Meet at the main departures level'
  if (myTerminal && !theirTerminal) return `Near Terminal ${myTerminal} — confirm with them`
  if (!myTerminal && theirTerminal) return `Near Terminal ${theirTerminal} — confirm with them`
  if (myTerminal === theirTerminal) return `Terminal ${myTerminal} — you're in the same terminal`
  return `You're in Terminal ${myTerminal}, they're in Terminal ${theirTerminal} — check the airport map for the connector`
}

export default function MeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [wearing, setWearing] = useState('')
  const [slot, setSlot] = useState<string | null>(null)
  const [iAmA, setIAmA] = useState<boolean | null>(null)
  const [departureTime, setDepartureTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Partner context — revealed after mutual acceptance
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [partnerDestination, setPartnerDestination] = useState<string | null>(null)
  const [myTerminal, setMyTerminal] = useState<string | null>(null)
  const [theirTerminal, setTheirTerminal] = useState<string | null>(null)
  const [pointOfConnection, setPointOfConnection] = useState<string | null>(null)

  const router = useRouter()
  const insets = useSafeAreaInsets()

  const canConfirm = wearing.trim().length > 0 && slot !== null

  useEffect(() => {
    async function loadSide() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .select(`
          session_id_a, session_id_b,
          point_of_connection,
          session_a:sessions!session_id_a(
            user_id, departure_time, terminal, destination_iata,
            users!user_id(first_name)
          ),
          session_b:sessions!session_id_b(
            user_id, departure_time, terminal, destination_iata,
            users!user_id(first_name)
          )
        `)
        .eq('id', match_id)
        .single()

      if (matchErr) {
        console.error('[meetup] loadSide error:', matchErr)
        return
      }
      if (!match) return

      const sessionA = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
      const sessionB = Array.isArray(match.session_b) ? match.session_b[0] : match.session_b

      const amA = sessionA?.user_id === session.user.id
      setIAmA(amA)

      const mySession = amA ? sessionA : sessionB
      const theirSession = amA ? sessionB : sessionA

      const theirUser = theirSession?.users
        ? (Array.isArray(theirSession.users) ? theirSession.users[0] : theirSession.users)
        : null

      setDepartureTime(mySession?.departure_time ?? null)
      setMyTerminal(mySession?.terminal ?? null)
      setTheirTerminal(theirSession?.terminal ?? null)
      setPartnerName(theirUser?.first_name ?? null)
      setPartnerDestination(theirSession?.destination_iata ?? null)
      setPointOfConnection(match.point_of_connection ?? null)

      console.log('[meetup] loaded: partnerName=', theirUser?.first_name, 'myTerminal=', mySession?.terminal, 'theirTerminal=', theirSession?.terminal)
    }
    loadSide()
  }, [match_id])

  async function confirm() {
    if (!canConfirm || iAmA === null) return
    setSaving(true)
    setError('')

    try {
      // Compute a concrete meetup_time from the slot + departure so the
      // post-meetup prompt cron has a timestamp to schedule against.
      let meetup_time: string | null = null
      if (slot && departureTime) {
        const dep = new Date(departureTime)
        if (slot === 'before') {
          // Meet 45 min before the gate closes.
          meetup_time = new Date(dep.getTime() - 45 * 60 * 1000).toISOString()
        } else {
          // 'after' — rough estimate: ~2 hrs post-departure for landing + deplaning.
          meetup_time = new Date(dep.getTime() + 2 * 60 * 60 * 1000).toISOString()
        }
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
      console.error('[meetup] confirm error:', err)
      haptics.error()
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const meetingHint = getMeetingLocationHint(myTerminal, theirTerminal)

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
        <Text style={styles.headline}>Let's set{'\n'}a time.</Text>

        {/* Partner context — shown once name is known (mutual match) */}
        {partnerName ? (
          <View style={styles.partnerCard}>
            <Text style={styles.partnerName}>{partnerName}</Text>
            {partnerDestination ? (
              <Text style={styles.partnerDest}>Flying to {partnerDestination}</Text>
            ) : null}
            {pointOfConnection ? (
              <Text style={styles.partnerConnection}>{pointOfConnection}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Meeting location suggestion */}
        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>SUGGESTED MEETING POINT</Text>
          <Text style={styles.locationHint}>{meetingHint}</Text>
        </View>

        <Text style={styles.subhead}>Help them find you, pick a window.</Text>

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

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>When do you want to meet?</Text>
          {SLOTS.map(s => (
            <Pressable
              key={s.key}
              style={({ pressed }) => [
                styles.option,
                slot === s.key && styles.optionSelected,
                pressed && slot !== s.key && { opacity: 0.7 },
              ]}
              onPress={() => { haptics.selection(); setSlot(s.key) }}
            >
              <Text style={[styles.optionLabel, slot === s.key && styles.optionLabelSelected]}>
                {s.label}
              </Text>
              <Text style={[styles.optionDesc, slot === s.key && styles.optionDescSelected]}>
                {s.desc}
              </Text>
            </Pressable>
          ))}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: { fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, letterSpacing: 1.4 },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  subhead: { ...type.subhead, color: colors.subtle, marginTop: -4 },

  partnerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  partnerName: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.2,
  },
  partnerDest: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  partnerConnection: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
    marginTop: 4,
  },

  locationCard: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 14,
    gap: 4,
  },
  locationLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.subtle,
  },
  locationHint: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.4,
    lineHeight: 19,
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
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    backgroundColor: colors.surface,
    gap: 4,
  },
  optionSelected: { borderColor: colors.text, backgroundColor: colors.text },
  optionLabel: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.2,
  },
  optionLabelSelected: { color: colors.bg },
  optionDesc: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
  },
  optionDescSelected: { color: 'rgba(249,248,246,0.7)' },
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
