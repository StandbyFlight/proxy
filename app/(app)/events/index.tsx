import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, Pressable, TextInput,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { listEvents, type Event } from '../../../lib/events'

// Events browser — data-driven from the events table (lib/events.ts).
// Attaching an event narrows who you match with; it is context on the normal
// matching flow, not a separate mode.

export default function EventsIndex() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[type.headline, styles.headline]}>Worth flying for.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Attach one to your session to match with people heading there.
        </Text>

        <View style={styles.searchBlock}>
          <TextInput
            style={styles.fieldInput}
            value={query}
            onChangeText={setQuery}
            placeholder="SXSW, Berkeley, AI…"
            placeholderTextColor={colors.subtle}
            autoCorrect={false}
            selectionColor={colors.accent}
          />
        </View>

        {events === null ? (
          <View style={styles.loader}><ActivityIndicator color={colors.subtle} /></View>
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
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{ev.name}</Text>
                  <Text style={styles.rowMeta}>
                    {ev.dates_label}  ·  {ev.city.toUpperCase()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 16 },
  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -4 },

  searchBlock: { marginTop: 8 },
  fieldInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },

  loader: { alignItems: 'center', paddingVertical: 32 },
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

  list: { gap: 8, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowMain: { flex: 1, gap: 4 },
  rowName: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 17,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text,
    opacity: 0.6,
  },
})
