import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { getSessionHistory, type HistoryEntry } from '../../lib/session'
import { passDate } from '../../lib/format'

// Session History — every past and upcoming travel session as a distinct
// entry: flight, route, date, outcome. Starting a new flight archives the old
// session here; nothing is ever overwritten or deleted.

const OUTCOME_LABEL: Record<HistoryEntry['outcome'], string> = {
  live: 'LIVE',
  met: 'MET',
  matched: 'MATCHED',
  no_match: '—',
}

export default function History() {
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<HistoryEntry[] | null>(null)

  useFocusEffect(useCallback(() => {
    let cancelled = false
    getSessionHistory()
      .then(data => { if (!cancelled) setRows(data) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, []))

  const upcoming = (rows ?? []).filter(r => r.upcoming || r.outcome === 'live')
  const past = (rows ?? []).filter(r => !r.upcoming && r.outcome !== 'live')

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={[type.headline, styles.headline]}>Where you've been.</Text>

        {rows === null ? (
          <View style={styles.loader}><ActivityIndicator color={colors.subtle} /></View>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>Your first session will show up here.</Text>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <Section title="UPCOMING & LIVE" rows={upcoming} />
            ) : null}
            {past.length > 0 ? (
              <Section title="PAST" rows={past} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Section({ title, rows }: { title: string; rows: HistoryEntry[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.list}>
        {rows.map(r => (
          <View key={r.id} style={[styles.card, r.outcome === 'live' && styles.cardLive]}>
            <View style={styles.cardMain}>
              <Text style={styles.cardRoute}>
                {(r.origin_iata ?? '···').toUpperCase()}
                {r.destination_iata ? ` → ${r.destination_iata.toUpperCase()}` : ''}
              </Text>
              <Text style={styles.cardMeta}>
                {r.flight_iata ?? '—'}{r.departure_time ? `  ·  ${passDate(r.departure_time)}` : ''}
              </Text>
            </View>
            <Text style={[
              styles.cardOutcome,
              r.outcome === 'live' && styles.cardOutcomeLive,
              r.outcome === 'met' && styles.cardOutcomeMet,
            ]}>
              {OUTCOME_LABEL[r.outcome]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 14 },
  headline: { color: colors.text, marginTop: 4 },

  loader: { alignItems: 'center', paddingVertical: 32 },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.subtle,
    marginTop: 24,
  },

  section: { gap: 10, marginTop: 10 },
  sectionLabel: {
    ...type.sectionTitle,
    color: colors.text,
  },
  list: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardLive: { backgroundColor: colors.periwinkle },
  cardMain: { gap: 4 },
  cardRoute: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text,
  },
  cardMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text,
    opacity: 0.6,
  },
  cardOutcome: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text,
    opacity: 0.6,
  },
  cardOutcomeLive: { color: colors.accent, opacity: 1, fontWeight: '700' },
  cardOutcomeMet: { opacity: 1, fontWeight: '700' },
})
