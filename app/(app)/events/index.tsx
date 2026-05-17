import { useState } from 'react'
import {
  View, Text, Pressable, TextInput,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'

// Events browser — Events tab destination. Events as a standalone product
// surface are deferred per app_plan §20 (event membership is currently used
// only as a matching signal inside the airport pool), so this screen is a
// preview list of high-signal upcoming events. Honest about that framing.

type Event = {
  id: string
  name: string
  dates: string
  city: string
  attending_at_airport: number
}

const EVENTS: Event[] = [
  { id: 'yc-startup-school-2026', name: 'YC AI Startup School', dates: 'JUL 25',     city: 'San Francisco', attending_at_airport: 14 },
  { id: 'consensus-2026',         name: 'Consensus',            dates: 'MAY 19–22',  city: 'Austin',        attending_at_airport: 9 },
  { id: 'sxsw-2026',              name: 'SXSW',                 dates: 'MAR 12–22',  city: 'Austin',        attending_at_airport: 27 },
  { id: 'aihackathon-berkeley',   name: 'AI Hackathon @ Berkeley', dates: 'JUN 20', city: 'Berkeley',      attending_at_airport: 6 },
  { id: 'web-summit-2026',        name: 'Web Summit',           dates: 'NOV 9–12',   city: 'Lisbon',        attending_at_airport: 3 },
]

export default function EventsIndex() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const filtered = EVENTS.filter(e =>
    !query || e.name.toLowerCase().includes(query.toLowerCase()) || e.city.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[type.eyebrow, styles.eyebrow]}>EVENTS</Text>
        <Text style={[type.headline, styles.headline]}>Worth flying for.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Conferences, hackathons, and meetups people we know are flying to. Attaching one to your session seats you at a small table with everyone else heading there.
        </Text>

        <View style={styles.searchBlock}>
          <Text style={styles.sectionLabel}>SEARCH</Text>
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

        <View style={styles.list}>
          {filtered.map(ev => (
            <Pressable
              key={ev.id}
              onPress={() => { haptics.selection(); router.push(`/(app)/events/${ev.id}`) }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{ev.name}</Text>
                <Text style={styles.rowMeta}>
                  {ev.dates}  ·  {ev.city.toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowCount}>
                <Text style={styles.rowCountNum}>{ev.attending_at_airport}</Text>
                <Text style={styles.rowCountLabel}>NEARBY</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.placeholderBlock}>
          <Text style={styles.placeholderLabel}>HEADS UP</Text>
          <Text style={styles.placeholderBody}>
            This list is hand-picked while the events backend ships. If your event isn't here, name it in the session flow — it still flags you as a match.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 16 },
  eyebrow: { color: colors.subtle },
  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -4 },

  searchBlock: { gap: 8, marginTop: 8 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  fieldInput: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 6,
    letterSpacing: 0.6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.25)',
  },

  list: { gap: 0, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
  },
  rowMain: { flex: 1, gap: 4 },
  rowName: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  rowCount: { alignItems: 'flex-end', gap: 2 },
  rowCountNum: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: 0.6,
  },
  rowCountLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.subtle,
  },

  placeholderBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 14,
    marginTop: 12,
    gap: 6,
  },
  placeholderLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  placeholderBody: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
  },
})
