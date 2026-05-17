import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'

// Step 4 of session setup: attach a known event (conference, demo day, etc.)
// or skip. Attaching forks into the group track per group_plan §"session/event";
// no event continues to availability for solo matching.

// Curated list — at MVP this is a hardcoded handful of high-signal events.
// Real event search backed by an /events table is deferred (see app_plan §20).
const SUGGESTED_EVENTS: { id: string; name: string; tag: string }[] = [
  { id: 'yc-startup-school-2026', name: 'YC AI Startup School',  tag: 'JUL · SF' },
  { id: 'consensus-2026',         name: 'Consensus',              tag: 'MAY · AUSTIN' },
  { id: 'sxsw-2026',              name: 'SXSW',                   tag: 'MAR · AUSTIN' },
  { id: 'aihackathon-berkeley',   name: 'AI Hackathon @ Berkeley', tag: 'JUN · BERKELEY' },
]

export default function EventScreen() {
  const params = useLocalSearchParams<Record<string, string>>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')

  const filtered = SUGGESTED_EVENTS.filter(e =>
    !query || e.name.toLowerCase().includes(query.toLowerCase())
  )

  function pick(id: string, name: string) {
    haptics.selection()
    setSelectedId(id)
    setSelectedName(name)
    setQuery(name)
  }

  function attach() {
    if (!selectedId && !query.trim()) return
    haptics.buttonTap()
    router.push({
      pathname: '/(app)/group/forming',
      params: {
        ...params,
        event_id: selectedId ?? '',
        event_name: selectedName || query.trim(),
      },
    })
  }

  function skip() {
    haptics.selection()
    router.push({
      pathname: '/(app)/session/availability',
      params,
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
          <Text style={[type.eyebrow, styles.eyebrow]}>SESSION · 04 / 04</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Going somewhere{'\n'}with a crowd?</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Attach an event and we'll seat you at a small table with others heading there too.
        </Text>

        <View style={styles.searchBlock}>
          <Text style={styles.sectionLabel}>EVENT NAME</Text>
          <TextInput
            style={styles.fieldInput}
            value={query}
            onChangeText={(v) => { setQuery(v); setSelectedId(null) }}
            placeholder="Consensus 2026, ICML…"
            placeholderTextColor={colors.subtle}
            maxLength={80}
            autoCorrect={false}
            selectionColor={colors.accent}
          />
        </View>

        {filtered.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUGGESTED</Text>
            <View style={styles.list}>
              {filtered.map(ev => {
                const selected = selectedId === ev.id
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => pick(ev.id, ev.name)}
                    style={({ pressed }) => [
                      styles.row,
                      selected && styles.rowSelected,
                      pressed && !selected && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                      {ev.name}
                    </Text>
                    <Text style={[styles.rowTag, selected && styles.rowTagSelected]}>
                      {ev.tag}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}

        <Text style={styles.note}>
          Tables seat up to 8. You'll be matched with the next 7 people headed to the same place.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={skip}
          hitSlop={14}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.skipText}>NO EVENT</Text>
        </Pressable>

        <Pressable
          onPress={attach}
          disabled={!selectedId && !query.trim()}
          style={({ pressed }) => [
            styles.primaryBtn,
            !selectedId && !query.trim() && styles.primaryBtnDisabled,
            pressed && (selectedId || query.trim()) && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.triangleOnRed}>{'▶'}</Text>
          <Text style={styles.primaryBtnText}>ATTACH</Text>
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

  searchBlock: { gap: 8, marginTop: 12 },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },

  fieldInput: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 6,
    letterSpacing: 0.6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.25)',
  },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(10,10,10,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowSelected: { borderColor: colors.text, backgroundColor: colors.text },
  rowLabel: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  rowLabelSelected: { color: colors.bg },
  rowTag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  rowTagSelected: { color: 'rgba(249,248,246,0.7)' },

  note: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.subtle,
    lineHeight: 19,
    marginTop: 8,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.08)',
    backgroundColor: colors.bg,
  },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  skipText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 140,
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
