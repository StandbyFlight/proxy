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

export default function MeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [wearing, setWearing] = useState('')
  const [slot, setSlot] = useState<string | null>(null)
  const [iAmA, setIAmA] = useState<boolean | null>(null)
  const [departureTime, setDepartureTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const canConfirm = wearing.trim().length > 0 && slot !== null

  useEffect(() => {
    async function loadSide() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: match } = await supabase
        .from('matches')
        .select(`
          session_id_a,
          session_a:sessions!session_id_a(user_id, departure_time)
        `)
        .eq('id', match_id)
        .single()

      if (!match) return
      const sessionA = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
      const amA = sessionA?.user_id === session.user.id
      setIAmA(amA)
      // Departure time is used to compute the meetup_time timestamp.
      setDepartureTime(sessionA?.departure_time ?? null)
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
      haptics.error()
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>Meetup</Text>
        <Text style={styles.headline}>Let's set{'\n'}a time.</Text>
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
  inner: { paddingHorizontal: 24, gap: 24 },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  subhead: { ...type.subhead, color: colors.subtle, marginTop: 2 },
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
