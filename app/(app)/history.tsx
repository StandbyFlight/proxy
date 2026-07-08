import { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert,
  Animated, PanResponder,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { colors, radius, blur, shadow } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import {
  getSessionHistory, archiveSession, deleteSession, type HistoryEntry,
} from '../../lib/session'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { passDate, passTime } from '../../lib/format'
import { BoardingPass } from '../../components/BoardingPass'
import { GradientBackground } from '../../components/ui'

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
    <GradientBackground>
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
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
          >
            <BlurView intensity={blur.subtle} tint={blur.tint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.addBtnFill]} pointerEvents="none" />
            <View style={styles.addBtnBorder} pointerEvents="none" />
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
    </GradientBackground>
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

// Width of each revealed action button, and how far past a full reveal a
// release fires delete outright (iOS voice-memo-style full swipe).
const ACTION_W = 84
const FULL_SWIPE_EXTRA = 72

// A single history card with iOS-style swipe-to-delete. Swiping left drags the
// pass over to reveal the DELETE (and ARCHIVE, for live sessions) actions that
// sit behind it; a hard full swipe deletes directly. Built on core RN
// Animated + PanResponder so no gesture-handler native dep is needed, and the
// horizontal-only gesture check lets vertical scrolling pass through to the
// enclosing ScrollView.
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
  const showArchive = entry.status === 'active'
  const revealW = (showArchive ? ACTION_W : 0) + ACTION_W

  const translateX = useRef(new Animated.Value(0)).current
  const offset = useRef(0)        // resting position: 0 (closed) or -revealW
  const opened = useRef(false)

  const settle = useCallback((to: number) => {
    offset.current = to
    opened.current = to !== 0
    Animated.spring(translateX, {
      toValue: to, useNativeDriver: true, bounciness: 0, speed: 20,
    }).start()
  }, [translateX])
  const open = useCallback(() => { haptics.selection(); settle(-revealW) }, [settle, revealW])
  const close = useCallback(() => settle(0), [settle])

  const pan = useRef(
    PanResponder.create({
      // Claim the gesture only for clearly-horizontal drags, so a vertical
      // scroll still reaches the ScrollView.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        let x = offset.current + g.dx
        if (x > 0) x = 0                                   // never past closed
        const min = -(revealW + FULL_SWIPE_EXTRA + 32)     // small overshoot
        if (x < min) x = min
        translateX.setValue(x)
      },
      onPanResponderRelease: (_, g) => {
        const x = offset.current + g.dx
        if (x <= -(revealW + FULL_SWIPE_EXTRA)) {          // full swipe → delete
          close()
          onDelete(entry)
          return
        }
        if (x < -revealW / 2 || g.vx < -0.35) open()
        else close()
      },
      onPanResponderTerminate: () => close(),
    }),
  ).current

  // Tapping a swiped-open card just closes it; otherwise it reopens the flow.
  function handlePress() {
    if (opened.current) { close(); return }
    if (openable) onOpen(entry)
  }

  return (
    <View style={styles.cardWrap}>
      {/* Actions revealed behind the pass when it's dragged left. */}
      <View style={styles.actionsBehind} pointerEvents="box-none">
        {showArchive ? (
          <Pressable
            onPress={() => { close(); onArchive(entry) }}
            style={[styles.swipeAction, styles.archiveAction]}
          >
            <Text style={styles.swipeActionText}>ARCHIVE</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => { close(); onDelete(entry) }}
          style={[styles.swipeAction, styles.deleteAction]}
        >
          <Text style={styles.swipeActionText}>DELETE</Text>
        </Pressable>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...pan.panHandlers}
      >
        <Pressable
          onPress={handlePress}
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
      </Animated.View>
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
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  addBtnFill: {
    backgroundColor: colors.glassWhiteStrong,
  },
  addBtnBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
  },
  addBtnText: {
    fontFamily: fonts.regular,
    fontSize: 24,
    lineHeight: 24,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: colors.scarlet,
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

  cardWrap: { position: 'relative' },
  // Sits behind the pass; buttons are right-aligned so they emerge as the pass
  // slides left. overflow/radius match the card so nothing pokes past corners.
  actionsBehind: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  swipeAction: {
    width: ACTION_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveAction: { backgroundColor: colors.subtle },
  deleteAction: { backgroundColor: colors.scarlet },
  swipeActionText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.onAccent,
  },
})
