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

// Step 2 of session setup: confirm which terminal you're sitting in, and
// optionally name a lounge. The matcher uses terminal as a reachability filter
// (see lib/airports.ts) — a wrong terminal at LAX cuts your pool in half.

export default function LocationScreen() {
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
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [terminal, setTerminal] = useState((params.terminal ?? '').toUpperCase())
  const [lounge, setLounge] = useState('')

  const terminalOptions = useMemo(() => {
    const map = REACHABILITY[(params.origin_iata ?? '').toUpperCase()]
    if (!map) return [] as string[]
    return Object.keys(map)
  }, [params.origin_iata])

  const canContinue = terminal.trim().length > 0

  function proceed() {
    if (!canContinue) return
    haptics.buttonTap()
    router.push({
      pathname: '/(app)/session/event',
      params: {
        ...params,
        terminal: terminal.trim().toUpperCase(),
        lounge: lounge.trim() || '',
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
          <Pressable
            onPress={() => { haptics.buttonTap(); router.back() }}
            hitSlop={14}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.triangleSubtle}>{'◀'}</Text>
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
          <Text style={[type.eyebrow, styles.eyebrow]}>SESSION · 02 / 04</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Where are you now?</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Your terminal sets who can walk over to you in time.
        </Text>

        {params.origin_iata ? (
          <Text style={styles.tag}>{params.origin_iata}{params.flight_iata ? `  ·  ${params.flight_iata}` : ''}</Text>
        ) : null}

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
          ) : (
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
          )}
          {terminalOptions.length > 0 ? (
            <Text style={styles.hint}>Or type it in if it's not listed.</Text>
          ) : null}
          {terminalOptions.length > 0 && terminal && !terminalOptions.includes(terminal) ? (
            <TextInput
              style={[styles.fieldInput, { marginTop: 8 }]}
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
            LOUNGE  <Text style={styles.optional}>optional</Text>
          </Text>
          <TextInput
            style={styles.fieldInput}
            value={lounge}
            onChangeText={setLounge}
            placeholder="Centurion, Sky Club, Polaris…"
            placeholderTextColor={colors.subtle}
            maxLength={32}
            autoCapitalize="words"
            autoCorrect={false}
            selectionColor={colors.accent}
          />
          <Text style={styles.hint}>If you're settled somewhere, we'll suggest meeting there.</Text>
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
          <Text style={styles.triangleOnRed}>{'▶'}</Text>
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
    marginTop: -4,
  },

  section: { gap: 10, marginTop: 12 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  optional: {
    fontFamily: fonts.serifItalic,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'none',
    color: colors.subtle,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(10,10,10,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 48,
    alignItems: 'center',
  },
  chipSelected: { borderColor: colors.text, backgroundColor: colors.text },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text,
  },
  chipTextSelected: { color: colors.bg },

  fieldInput: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 6,
    letterSpacing: 0.6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.25)',
  },
  hint: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.subtle,
    lineHeight: 18,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.08)',
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
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
})
