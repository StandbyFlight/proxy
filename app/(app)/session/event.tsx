import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { listEvents, type Event } from '../../../lib/events'
import { BackButton } from '../../../components/BackButton'

// Step 3 of session setup: optionally attach an event. An attached event is
// additive context on the normal matching flow (a strong matching signal) —
// it is NOT a separate mode. The flow reads "pick an event, or skip":
// "Not attending an event" is the last row of the list, not a competing CTA.

export default function EventScreen() {
  const params = useLocalSearchParams<Record<string, string>>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // Pre-select an event carried in from the Events tab.
  const [query, setQuery] = useState(params.event_name ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(params.event_id || null)
  const [selectedName, setSelectedName] = useState<string>(params.event_name ?? '')
  const [events, setEvents] = useState<Event[]>([])

  // Suggested events come from the events table (lib/events.ts), searched
  // server-side as the user types. A typed name that matches nothing still
  // attaches as a custom event.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      listEvents(selectedName && query === selectedName ? '' : query)
        .then(rows => { if (!cancelled) setEvents(rows) })
        .catch(() => { if (!cancelled) setEvents([]) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, selectedName])

  const filtered = events

  const attachedName = selectedName || query.trim()

  function pick(id: string, name: string) {
    haptics.selection()
    setSelectedId(id)
    setSelectedName(name)
    setQuery(name)
  }

  function continueWith(eventId: string, eventName: string) {
    haptics.buttonTap()
    router.push({
      pathname: '/(app)/intent',
      params: {
        ...params,
        event_id: eventId,
        event_name: eventName,
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
          <Text style={[type.eyebrow, styles.eyebrow]}>SESSION · 03 / 04</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Flying to an event?</Text>

        <View style={styles.searchBlock}>
          <Text style={styles.sectionLabel}>EVENT NAME</Text>
          <TextInput
            style={styles.fieldInput}
            value={query}
            onChangeText={(v) => { setQuery(v); setSelectedId(null); setSelectedName('') }}
            placeholder="Consensus 2026, ICML…"
            placeholderTextColor={colors.subtle}
            maxLength={80}
            autoCorrect={false}
            selectionColor={colors.accent}
          />
        </View>

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
                <Text style={styles.rowTag}>{ev.dates_label} · {ev.city.toUpperCase()}</Text>
              </Pressable>
            )
          })}

          {/* Skip lives at the end of the list — "pick an event, or skip". */}
          <Pressable
            onPress={() => continueWith('', '')}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.rowLabelSkip}>Not attending an event</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={() => continueWith(selectedId ?? '', attachedName)}
          disabled={!attachedName}
          style={({ pressed }) => [
            styles.primaryBtn,
            !attachedName && styles.primaryBtnDisabled,
            pressed && !!attachedName && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.triangleOnRed}>{'▶'}</Text>
          <Text style={styles.primaryBtnText}>ATTACH EVENT</Text>
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

  searchBlock: { gap: 8, marginTop: 12 },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },

  fieldInput: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 6,
    letterSpacing: 0.6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },

  list: { gap: 8, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowSelected: { backgroundColor: colors.periwinkle },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.text,
  },
  rowLabelSelected: { color: colors.text },
  rowLabelSkip: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.subtle,
  },
  rowTag: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.subtle,
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
  triangleOnRed: { fontSize: 10, color: colors.onAccent, includeFontPadding: false },
})
