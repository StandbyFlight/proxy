import { useState } from 'react'
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
import { getAblyClient, flightChannelName } from '../../lib/ably'

const INTENTS = [
  { key: 'professional', label: 'Professional', desc: 'Career-adjacent connections' },
  { key: 'social', label: 'Social', desc: 'Travel companions, shared interests' },
  { key: 'open', label: 'Open to anything', desc: 'Let the app decide' },
] as const

const PURPOSES = [
  { key: 'conference', label: 'Conference / industry event' },
  { key: 'work_trip', label: 'Work trip' },
  { key: 'solo_travel', label: 'Solo travel / leisure' },
  { key: 'relocating', label: 'Relocating' },
  { key: 'other', label: 'Other' },
] as const

type Intent = typeof INTENTS[number]['key']
type Purpose = typeof PURPOSES[number]['key']

export default function IntentScreen() {
  const params = useLocalSearchParams<{
    flight_id: string
    flight_iata: string
    origin_iata: string
    destination_iata: string
    destination_city: string
    departure_time: string
    gate: string
    terminal: string
  }>()

  const [intent, setIntent] = useState<Intent | null>(null)
  const [purpose, setPurpose] = useState<Purpose | null>(null)
  const [eventId, setEventId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const showPurpose = intent === 'professional' || intent === 'social'
  const showEventField = purpose === 'conference'
  const canContinue = intent !== null && (!showPurpose || purpose !== null)

  async function proceed() {
    if (!canContinue) return
    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { error: sessionErr } = await supabase.from('sessions').insert({
        user_id: session.user.id,
        flight_id: params.flight_id,
        origin_iata: params.origin_iata || null,
        destination_iata: params.destination_iata || null,
        departure_time: params.departure_time || null,
        terminal: params.terminal || null,
        gate: params.gate || null,
        connection_intent: intent!,
        travel_purpose: purpose ?? null,
        event_id: eventId.trim() || null,
        expires_at: params.departure_time
          ? new Date(params.departure_time).toISOString()
          : null,
      })

      if (sessionErr) throw sessionErr

      const departureDate = params.departure_time
        ? params.departure_time.split('T')[0]
        : new Date().toISOString().split('T')[0]

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(flightChannelName(params.flight_iata, departureDate))
      await channel.presence.enter({
        intent: intent!,
        travel_purpose: purpose ?? null,
        checked_in_at: new Date().toISOString(),
      })

      haptics.success()
      router.replace('/(app)/')
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
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={12}
          style={styles.back}
        >
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.eyebrow}>Session</Text>
        <Text style={styles.headline}>What are you{'\n'}open to?</Text>

        {params.flight_iata ? (
          <Text style={styles.flightTag}>
            {params.flight_iata}
            {params.origin_iata && params.destination_iata
              ? `  ·  ${params.origin_iata} to ${params.destination_iata}`
              : ''}
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Connection type</Text>
          {INTENTS.map(item => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.option,
                intent === item.key && styles.optionSelected,
                pressed && intent !== item.key && { opacity: 0.7 },
              ]}
              onPress={() => { haptics.selection(); setIntent(item.key); setPurpose(null) }}
            >
              <Text style={[styles.optionLabel, intent === item.key && styles.optionLabelSelected]}>
                {item.label}
              </Text>
              <Text style={[styles.optionDesc, intent === item.key && styles.optionDescSelected]}>
                {item.desc}
              </Text>
            </Pressable>
          ))}
        </View>

        {showPurpose && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What brings you here?</Text>
            {PURPOSES.map(item => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.option,
                  purpose === item.key && styles.optionSelected,
                  pressed && purpose !== item.key && { opacity: 0.7 },
                ]}
                onPress={() => { haptics.selection(); setPurpose(item.key); setEventId('') }}
              >
                <Text style={[styles.optionLabel, purpose === item.key && styles.optionLabelSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {showEventField && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Which event?{'  '}
              <Text style={styles.optional}>optional but helps a lot</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Consensus 2026, ICML"
              placeholderTextColor={colors.subtle}
              value={eventId}
              onChangeText={setEventId}
              autoCorrect={false}
            />
          </View>
        )}

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
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.primaryBtnText}>Find someone</Text>
          }
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 20 },
  back: { marginBottom: 4 },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  flightTag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.subtle,
    marginTop: -8,
  },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.subtle,
    marginBottom: 2,
  },
  optional: {
    fontFamily: fonts.serifItalic,
    fontSize: 12,
    letterSpacing: 0,
    textTransform: 'none',
    color: colors.subtle,
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
  error: {
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
