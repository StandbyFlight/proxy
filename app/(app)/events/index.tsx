import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable,
  StyleSheet,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { colors, radius } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { listEvents, type Event } from '../../../lib/events'
import { Screen, GlassCard, GlassInput, LoadingState } from '../../../components/ui'

// Events browser — data-driven from the events table (lib/events.ts).
// Attaching an event narrows who you match with; it is context on the normal
// matching flow, not a separate mode.

export default function EventsIndex() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<Event[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback((term: string) => {
    listEvents(term)
      .then(setEvents)
      .catch(() => setError('Could not load events. Pull back later.'))
  }, [])

  useFocusEffect(useCallback(() => { load(query) }, []))

  // Debounced server-side search as the user types.
  useEffect(() => {
    const t = setTimeout(() => load(query), 250)
    return () => clearTimeout(t)
  }, [query, load])

  return (
    <Screen scroll contentContainerStyle={styles.inner}>
      <Text style={[type.headline, styles.headline]}>Worth flying for.</Text>

      <GlassInput
        containerStyle={styles.searchBlock}
        value={query}
        onChangeText={setQuery}
        placeholder="SXSW, Berkeley, AI…"
        autoCorrect={false}
      />

      {events === null ? (
        <LoadingState style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : events.length === 0 ? (
        <Text style={styles.empty}>No events match that search.</Text>
      ) : (
        <View style={styles.list}>
          {events.map(ev => (
            <Pressable
              key={ev.id}
              onPress={() => { haptics.selection(); router.push(`/(app)/events/${ev.id}`) }}
              style={({ pressed }) => pressed && { opacity: 0.85 }}
            >
              <GlassCard rounded="lg" padding={16}>
                <View style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1}>{ev.name}</Text>
                  <View style={styles.badges}>
                    <Text style={[styles.badge, styles.cityBadge]} numberOfLines={1}>{ev.city}</Text>
                    <Text style={[styles.badge, styles.dateBadge]} numberOfLines={1}>{ev.dates_label}</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  inner: { gap: 16 },
  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -4 },

  searchBlock: { marginTop: 8 },

  loader: { minHeight: 120, flex: 0, paddingVertical: 32 },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.subtle,
    marginTop: 16,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    marginTop: 16,
  },

  list: { gap: 14, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 8, // extra breathing room so the name isn't tight to the edge
  },
  rowName: {
    flexShrink: 1,
    fontFamily: fonts.bold, // Zalando Sans SemiExpanded
    fontSize: 19,
    letterSpacing: -0.2,
    color: colors.text,
  },
  // City + date pills, stacked and pinned to the right edge of the card.
  badges: {
    gap: 6,
    alignItems: 'flex-end',
  },
  badge: {
    fontFamily: fonts.semibold, // Zalando Sans SemiExpanded
    fontSize: 13,
    color: colors.charcoal,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cityBadge: { backgroundColor: colors.skyBlue },
  dateBadge: { backgroundColor: '#E38079' }, // soft coral-red
})
