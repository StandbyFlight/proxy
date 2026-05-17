import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'

// Past sessions list. Per group_plan §"profile/history": airport · date ·
// session type only — no names, no match details. Matches are intentionally
// not surfaced; the connection lived in the moment.

type Row = {
  id: string
  origin: string | null
  date: string | null
  intent: string | null
  flight: string | null
}

const INTENT_LABEL: Record<string, string> = {
  professional: 'PROFESSIONAL',
  social: 'SOCIAL',
  open: 'OPEN',
}

export default function History() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [rows, setRows] = useState<Row[] | null>(null)

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data } = await supabase
        .from('sessions')
        .select('id, origin_iata, departure_time, connection_intent, flights(flight_iata)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(40)
      if (cancelled) return
      const out: Row[] = (data ?? []).map(s => {
        const fl = s.flights as { flight_iata?: string } | { flight_iata?: string }[] | null
        const fIata = Array.isArray(fl) ? fl[0]?.flight_iata : fl?.flight_iata
        return {
          id: s.id,
          origin: (s as { origin_iata?: string }).origin_iata ?? null,
          date: (s as { departure_time?: string }).departure_time
            ? formatDate((s as { departure_time?: string }).departure_time!)
            : null,
          intent: (s as { connection_intent?: string }).connection_intent ?? null,
          flight: fIata ?? null,
        }
      })
      setRows(out)
    }
    load()
    return () => { cancelled = true }
  }, []))

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
          <Text style={[type.eyebrow, styles.eyebrow]}>SESSION HISTORY</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Where you've been.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Flights, not faces. The people you met aren't kept here — that's by design.
        </Text>

        {rows === null ? (
          <View style={styles.loader}><ActivityIndicator color={colors.subtle} /></View>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>
            Nothing yet. Your first session will show up here.
          </Text>
        ) : (
          <View style={styles.list}>
            <View style={styles.headerRow}>
              <Text style={[styles.headerCell, { flex: 1 }]}>AIRPORT</Text>
              <Text style={[styles.headerCell, { flex: 1.4 }]}>DATE</Text>
              <Text style={[styles.headerCell, { flex: 1.2 }]}>FLIGHT</Text>
              <Text style={[styles.headerCell, { flex: 1.3, textAlign: 'right' }]}>INTENT</Text>
            </View>
            {rows.map(r => (
              <View key={r.id} style={styles.row}>
                <Text style={[styles.cell, { flex: 1 }]}>{r.origin ?? '—'}</Text>
                <Text style={[styles.cell, { flex: 1.4 }]}>{r.date ?? '—'}</Text>
                <Text style={[styles.cell, { flex: 1.2 }]}>{r.flight ?? '—'}</Text>
                <Text style={[styles.cell, { flex: 1.3, textAlign: 'right' }]}>
                  {r.intent ? (INTENT_LABEL[r.intent] ?? r.intent.toUpperCase()) : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function formatDate(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: { fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, letterSpacing: 1.4 },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },

  loader: { alignItems: 'center', paddingVertical: 32 },
  empty: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    color: colors.subtle,
    marginTop: 24,
  },

  list: { marginTop: 14 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.18)',
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerCell: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  cell: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text,
  },
})
