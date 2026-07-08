import { useMemo, useState } from 'react'
import {
  View, Text, Pressable,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { REACHABILITY } from '../../../lib/airports'
import { BackButton } from '../../../components/BackButton'
import { Screen, GlassInput, GlassButton, Badge } from '../../../components/ui'

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
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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
                    style={({ pressed }) => [pressed && !selected && { opacity: 0.7 }]}
                  >
                    <Badge label={t} tone="glass" selected={selected} style={styles.chip} />
                  </Pressable>
                )
              })}
            </View>
          ) : null}
          {terminalOptions.length === 0 || (terminal && !terminalOptions.includes(terminal)) ? (
            <GlassInput
              containerStyle={styles.field}
              value={terminal}
              onChangeText={(v) => setTerminal(v.toUpperCase())}
              placeholder="T1"
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            GATE / LOUNGE
          </Text>
          <GlassInput
            containerStyle={styles.field}
            value={spot}
            onChangeText={setSpot}
            placeholder="B42, or Sky Club"
            maxLength={32}
            autoCorrect={false}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <GlassButton
          label="CONTINUE"
          onPress={proceed}
          disabled={!canContinue}
          haptic={false}
          variant="primary"
          size="lg"
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 24, gap: 16 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: { width: 64 },

  headline: { color: colors.text, marginTop: 4 },

  section: { gap: 10, marginTop: 12 },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 48,
    justifyContent: 'center',
  },

  field: { marginTop: 2 },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
})
