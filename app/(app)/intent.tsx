import { useState } from 'react'
import {
  View, Text, Pressable,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { createSession } from '../../lib/session'
import { BackButton } from '../../components/BackButton'

// Step 4 of session setup. Three options, nothing else. Creating the session
// here goes through lib/session.createSession — the new session is inserted
// first, then the previous one is archived into history (never deleted).

const INTENTS = [
  { key: 'professional', label: 'Professional' },
  { key: 'social', label: 'Social' },
  { key: 'open', label: 'Open to anything' },
] as const

type Intent = typeof INTENTS[number]['key']

export default function IntentScreen() {
  const params = useLocalSearchParams<{
    flight_id: string
    flight_iata: string
    origin_iata: string
    destination_iata: string
    departure_time: string
    gate: string
    terminal: string
    lounge: string
    event_id: string
    event_name: string
  }>()

  const [intent, setIntent] = useState<Intent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const canContinue = intent !== null

  async function proceed() {
    if (!canContinue || loading) return
    setLoading(true)
    setError('')

    try {
      // Events are matched by normalized key — a picked event uses its id, a
      // typed-in one uses its name.
      const eventKey = (params.event_id || params.event_name || '').trim() || null

      // The searching screen reads the active session from the DB itself —
      // no hand-off state; the DB is the single source of truth.
      await createSession({
        flight_id: params.flight_id,
        origin_iata: params.origin_iata || null,
        destination_iata: params.destination_iata || null,
        departure_time: params.departure_time || null,
        terminal: params.terminal || null,
        gate: params.gate || null,
        lounge: params.lounge || null,
        connection_intent: intent!,
        event_id: eventKey,
      })

      haptics.success()
      router.push({ pathname: '/(app)/session/availability', params })
    } catch (err: any) {
      haptics.error()
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <BackButton fallback="/(app)/flight" />
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>What are you{'\n'}open to?</Text>

        <View style={styles.section}>
          {INTENTS.map(item => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.option,
                intent === item.key && styles.optionSelected,
                pressed && intent !== item.key && { opacity: 0.7 },
              ]}
              onPress={() => { haptics.selection(); setIntent(item.key) }}
            >
              <Text style={styles.optionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (!canContinue || loading) && styles.primaryBtnDisabled,
            pressed && canContinue && { opacity: 0.85 },
          ]}
          onPress={() => { haptics.buttonTap(); proceed() }}
          disabled={!canContinue || loading}
        >
          {loading
            ? <ActivityIndicator color={colors.onAccent} />
            : <Text style={styles.primaryBtnText}>Continue</Text>
          }
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },
  headline: { color: colors.text, marginTop: 4 },
  section: { gap: 10, marginTop: 8 },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    padding: 18,
  },
  optionSelected: { backgroundColor: colors.periwinkle },
  optionLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 17,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.bg,
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
