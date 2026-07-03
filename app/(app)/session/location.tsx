import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, TextInput,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { REACHABILITY } from '../../../lib/airports'
import { BackButton } from '../../../components/BackButton'

// Step 2 of session setup. The location model is exactly two entries:
//   TERMINAL     — determines who can walk over to you in time
//   GATE/LOUNGE  — the more specific spot (a gate code or a named lounge)
// This question lives only in the live flight-session flow — never onboarding.

// A short alphanumeric like "B42" is a gate; anything longer is a lounge name.
function looksLikeGate(v: string): boolean {
  return /^[A-Za-z]?\d{1,3}[A-Za-z]?$/.test(v.trim()) && v.trim().length <= 4
}

export default function LocationScreen() {
  const params = useLocalSearchParams<{
    flight_id: string
    flight_iata: string
    origin_iata: string
    destination_iata: string
    departure_time: string
    gate: string
    terminal: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [terminal, setTerminal] = useState((params.terminal ?? '').toUpperCase())
  const [spot, setSpot] = useState((params.gate ?? '').toUpperCase())

  const terminalOptions = useMemo(() => {
    const map = REACHABILITY[(params.origin_iata ?? '').toUpperCase()]
    if (!map) return [] as string[]
    return Object.keys(map)
  }, [params.origin_iata])

  const canContinue = terminal.trim().length > 0

  function proceed() {
    if (!canContinue) return
    haptics.buttonTap()
    const trimmed = spot.trim()
    const gate = trimmed && looksLikeGate(trimmed) ? trimmed.toUpperCase() : (params.gate ?? '')
    const lounge = trimmed && !looksLikeGate(trimmed) ? trimmed : ''
    router.push({
      pathname: '/(app)/session/event',
      params: {
        ...params,
        terminal: terminal.trim().toUpperCase(),
        gate,
        lounge,
      },
    })
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <BackButton />
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Where are you now?</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TERMINAL</Text>
          {terminalOptions.length > 0 ? (
            <View style={styles.chips}>
              {terminalOptions.map(t => {
                const selected = terminal === t
                return (
                  <Pressable
                    key={t}
                    onPress={() => { haptics.selection(); setTerminal(t) }}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && !selected && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {t}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}
          {terminalOptions.length === 0 || (terminal && !terminalOptions.includes(terminal)) ? (
            <TextInput
              style={styles.fieldInput}
              value={terminal}
              onChangeText={(v) => setTerminal(v.toUpperCase())}
              placeholder="T1"
              placeholderTextColor={colors.subtle}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
              selectionColor={colors.accent}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            GATE / LOUNGE
          </Text>
          <TextInput
            style={styles.fieldInput}
            value={spot}
            onChangeText={setSpot}
            placeholder="B42, or Sky Club"
            placeholderTextColor={colors.subtle}
            maxLength={32}
            autoCorrect={false}
            selectionColor={colors.accent}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={proceed}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.primaryBtn,
            !canContinue && styles.primaryBtnDisabled,
            pressed && canContinue && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>CONTINUE</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 16 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },

  section: { gap: 10, marginTop: 12 },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  optional: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'none',
    color: colors.subtle,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 48,
    alignItems: 'center',
    borderRadius: 3,
  },
  chipSelected: { backgroundColor: colors.periwinkle },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text,
  },
  chipTextSelected: { color: colors.text, fontWeight: '700' },

  fieldInput: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 6,
    letterSpacing: 0.6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 14,
  },
  primaryBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.onAccent,
  },
})
