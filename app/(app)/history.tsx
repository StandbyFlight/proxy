import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import {
  getSessionHistory, archiveSession, deleteSession, type HistoryEntry,
} from '../../lib/session'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { passDate, passTime } from '../../lib/format'
import { BoardingPass } from '../../components/BoardingPass'

// Session History — every past and upcoming travel session as a boarding-pass
// card: route, date/time, and a status readout derived from status + outcome.
// The "+" adds a new pass (scan a flight); tapping a live card reopens its
// flow scoped to that session. Nothing is ever hard-deleted (delete is soft).

// Derive the human status readout shown on the pass from the raw session
// status and the match outcome. Terminal states (completed/archived) win over
// the live outcome; otherwise the outcome tells us where the session is.
function statusLabel(e: HistoryEntry): string {
  if (e.status === 'completed') return 'MEETUP · COMPLETE'
  if (e.status === 'archived') return 'ARCHIVED'
  switch (e.outcome) {
    case 'met': return 'MEETUP'
    case 'matched': return 'MATCHED'
    case 'live': return 'SEARCHING'
    default: return 'EXPIRED'
  }
}

// Only live (active) sessions reopen their flow. Completed/archived/expired
// sessions are read-only history.
function isOpenable(e: HistoryEntry): boolean {
  return e.status === 'active'
}

export default function History() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [rows, setRows] = useState<HistoryEntry[] | null>(null)
  const [firstName, setFirstName] = useState('')

  const refetch = useCallback(async () => {
    try {
      const data = await getSessionHistory()
      setRows(data)
    } catch {
      setRows([])
    }
  }, [])

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && !cancelled) {
        const { data: profile } = await supabase
          .from('users').select('first_name').eq('id', session.user.id).maybeSingle()
        if (!cancelled && profile?.first_name) setFirstName(profile.first_name)
      }
      try {
        const data = await getSessionHistory()
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) setRows([])
      }
    }
    load()
    return () => { cancelled = true }
  }, []))

  function addPass() {
    haptics.buttonTap()
    router.push('/(app)/flight')
  }

  // Reopen a live session's flow scoped to that session. Searching resolves
  // the current match state (via getActiveMatch) and forwards to the room /
  // meetup, so one destination covers searching, matched, and mutual.
  function openCard(e: HistoryEntry) {
    if (!isOpenable(e)) return
    haptics.buttonTap()
    router.push({ pathname: '/(app)/match/searching', params: { session_id: e.id } })
  }

  function confirmArchive(e: HistoryEntry) {
    haptics.selection()
    Alert.alert(
      'Archive this pass?',
      'It moves to your past sessions and any live match is released.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => { await archiveSession(e.id); await refetch() },
        },
      ],
    )
  }

  function confirmDelete(e: HistoryEntry) {
    haptics.selection()
    Alert.alert(
      'Delete this pass?',
      "It's removed from your history. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => { await deleteSession(e.id); await refetch() },
        },
      ],
    )
  }

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
        <View style={styles.headerRow}>
          <Text style={[type.headline, styles.headline]}>Where you've been.</Text>
          <Pressable
            onPress={addPass}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Add a pass"
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.addBtnText}>+</Text>
          </Pressable>
        </View>

        {rows === null ? (
          <View style={styles.loader}><ActivityIndicator color={colors.subtle} /></View>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>Your first session will show up here.</Text>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <Section
                title="UPCOMING & LIVE"
                rows={upcoming}
                firstName={firstName}
                onOpen={openCard}
                onArchive={confirmArchive}
                onDelete={confirmDelete}
              />
            ) : null}
            {past.length > 0 ? (
              <Section
                title="PAST"
                rows={past}
                firstName={firstName}
                onOpen={openCard}
                onArchive={confirmArchive}
                onDelete={confirmDelete}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Section({
  title, rows, firstName, onOpen, onArchive, onDelete,
}: {
  title: string
  rows: HistoryEntry[]
  firstName: string
  onOpen: (e: HistoryEntry) => void
  onArchive: (e: HistoryEntry) => void
  onDelete: (e: HistoryEntry) => void
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.list}>
        {rows.map(e => (
          <PassCard
            key={e.id}
            entry={e}
            firstName={firstName}
            onOpen={onOpen}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ))}
      </View>
    </View>
  )
}

function PassCard({
  entry, firstName, onOpen, onArchive, onDelete,
}: {
  entry: HistoryEntry
  firstName: string
  onOpen: (e: HistoryEntry) => void
  onArchive: (e: HistoryEntry) => void
  onDelete: (e: HistoryEntry) => void
}) {
  const openable = isOpenable(entry)
  return (
    <View style={styles.cardWrap}>
      <Pressable
        disabled={!openable}
        onPress={() => onOpen(entry)}
        style={({ pressed }) => [pressed && openable && { opacity: 0.9 }]}
      >
        <BoardingPass
          classLabel="SESSION PASS"
          passenger={firstName || null}
          origin={entry.origin_iata}
          destination={entry.destination_iata}
          flight={entry.flight_iata}
          date={entry.departure_time ? passDate(entry.departure_time) : null}
          time={entry.departure_time ? passTime(entry.departure_time) : null}
          gate={null}
          terminal={null}
          status={statusLabel(entry)}
          compact
        />
      </Pressable>
      <View style={styles.actionRow}>
        {entry.status === 'active' ? (
          <Pressable onPress={() => onArchive(entry)} hitSlop={8}>
            <Text style={styles.actionText}>ARCHIVE</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onDelete(entry)} hitSlop={8}>
          <Text style={[styles.actionText, styles.deleteText]}>DELETE</Text>
        </Pressable>
      </View>
    </View>
  )
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 14 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headline: { color: colors.text, flexShrink: 1, paddingRight: 12 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: fonts.body,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
  },

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
  list: { gap: 16 },

  cardWrap: { gap: 8 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
    paddingRight: 2,
  },
  actionText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  deleteText: { color: colors.accent },
})
