import { useEffect, useState } from 'react'
import {
  View, Text, Pressable,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { listEvents, type Event } from '../../../lib/events'
import { BackButton } from '../../../components/BackButton'
import { Screen, GlassInput, GlassButton, GlassCard } from '../../../components/ui'

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

        <Text style={[type.headline, styles.headline]}>Flying to an event?</Text>

        <GlassInput
          label="EVENT NAME"
          containerStyle={styles.searchBlock}
          value={query}
          onChangeText={(v) => { setQuery(v); setSelectedId(null); setSelectedName('') }}
          placeholder="Consensus 2026, ICML…"
          maxLength={80}
          autoCorrect={false}
        />

        <View style={styles.list}>
          {filtered.map(ev => {
            const selected = selectedId === ev.id
            return (
              <Pressable
                key={ev.id}
                onPress={() => pick(ev.id, ev.name)}
                style={({ pressed }) => [pressed && !selected && { opacity: 0.85 }]}
              >
                <GlassCard
                  rounded="lg"
                  padding={14}
                  tint={selected ? 'sky' : 'none'}
                  strong={selected}
                  style={styles.row}
                >
                  <Text style={styles.rowLabel}>{ev.name}</Text>
                  <Text style={styles.rowTag}>{ev.dates_label} · {ev.city.toUpperCase()}</Text>
                </GlassCard>
              </Pressable>
            )
          })}

          {/* Skip lives at the end of the list — "pick an event, or skip". */}
          <Pressable
            onPress={() => continueWith('', '')}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <GlassCard rounded="lg" padding={14} style={styles.row}>
              <Text style={styles.rowLabelSkip}>Not attending an event</Text>
            </GlassCard>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <GlassButton
          label="ATTACH EVENT"
          onPress={() => continueWith(selectedId ?? '', attachedName)}
          disabled={!attachedName}
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

  searchBlock: { marginTop: 12 },

  list: { gap: 10, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.text,
  },
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
  },
})
