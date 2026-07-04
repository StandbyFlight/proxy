import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { passDate, passTime } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { FlipBoard } from '../../components/FlipBoard'
import { BoardingPass } from '../../components/BoardingPass'
import { StandbyStamp } from '../../components/StandbyStamp'
import { BackButton } from '../../components/BackButton'

// Match status state machine:
//   pending    — created, both users pushed the Accept/Decline card at once
//   pending_b  — user A accepted; waiting for user B to decide
//   pending_a  — user B accepted; waiting for user A to decide
//   mutual     — both accepted; both land on the confirmed-match screen
//   declined   — at least one user declined; the other side is released
//
// Identifying info ("what are you wearing") is collected here, at accept time,
// so the confirmed-match screen can render both sides' info immediately.
// Waiting uses realtime + a polling fallback — nobody gets stuck if a
// realtime event drops.

const REVEAL_CELL_SIZE = 22
const MAX_CHARS_PER_LINE = 14
const PER_CELL_STAGGER_MS = 70
const PER_LINE_DELAY_MS = 260
const FIRST_LINE_OFFSET_MS = 500
const WAIT_POLL_MS = 3_000

type MatchData = {
  id: string
  status: string
  pointOfConnection: string | null
  theirIntent: string
  destinationIata: string | null
  theirFlightIata: string | null
  theirOriginIata: string | null
  theirDepartureTime: string | null
  theirGate: string | null
  theirTerminal: string | null
  iAmA: boolean
  mySessionId: string
  theirSessionId: string
}

type Phase = 'loading' | 'deciding' | 'waiting' | 'error'

const INTENT_LABEL: Record<string, string> = {
  professional: 'professional connections',
  social: 'social connections',
  open: 'anything',
}

function buildOneReason(match: MatchData): string {
  if (match.pointOfConnection) return match.pointOfConnection
  const intentStr = INTENT_LABEL[match.theirIntent] ?? 'something new'
  const destStr = match.destinationIata ? ` heading to ${match.destinationIata}` : ''
  return `someone${destStr} open to ${intentStr}`
}

function wrapLines(text: string, maxLen: number): string[] {
  const words = text.toUpperCase().replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (!current) { current = w; continue }
    if (current.length + 1 + w.length <= maxLen) current += ' ' + w
    else { lines.push(current); current = w }
  }
  if (current) lines.push(current)
  return lines
}

export default function MatchScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [wearing, setWearing] = useState('')
  const [error, setError] = useState('')
  const [respondError, setRespondError] = useState('')
  const [acting, setActing] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    loadMatch()
  }, [match_id])

  function goToConfirmed(matchId: string) {
    haptics.standbyStamp()
    router.replace({ pathname: '/(app)/meetup', params: { match_id: matchId } })
  }

  function releasedToSearching() {
    Alert.alert('They passed', "We're already looking for someone else.")
    router.replace('/(app)/match/searching')
  }

  // While deciding or waiting: realtime subscription plus a polling fallback.
  // A dropped realtime event can never strand this user, and if the other
  // side declines while this user is still deciding, they're released
  // immediately instead of discovering it on tap.
  useEffect(() => {
    if ((phase !== 'waiting' && phase !== 'deciding') || !match) return

    const channel = supabase
      .channel(`match-status-${match.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status
          if (newStatus === 'mutual') goToConfirmed(match.id)
          else if (newStatus === 'declined') releasedToSearching()
        }
      )
      .subscribe()

    const poll = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('matches').select('status').eq('id', match.id).single()
        if (data?.status === 'mutual') goToConfirmed(match.id)
        else if (data?.status === 'declined') releasedToSearching()
      } catch { /* transient — next tick retries */ }
    }, WAIT_POLL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [phase, match?.id])

  async function loadMatch() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error: matchErr } = await supabase
        .from('matches')
        .select(`
          id, status, point_of_connection,
          session_id_a, session_id_b,
          session_a:sessions!session_id_a(
            user_id, connection_intent, destination_iata,
            origin_iata, departure_time, gate, terminal,
            flights(flight_iata)
          ),
          session_b:sessions!session_id_b(
            user_id, connection_intent, destination_iata,
            origin_iata, departure_time, gate, terminal,
            flights(flight_iata)
          )
        `)
        .eq('id', match_id)
        .single()

      if (matchErr) throw matchErr

      if (data.status === 'declined') {
        router.replace('/(app)/match/searching')
        return
      }

      const sessionA = Array.isArray(data.session_a) ? data.session_a[0] : data.session_a
      const sessionB = Array.isArray(data.session_b) ? data.session_b[0] : data.session_b
      const iAmA = sessionA?.user_id === session.user.id
      const theirSession = iAmA ? sessionB : sessionA

      const theirFlightRec = theirSession?.flights
        ? (Array.isArray(theirSession.flights) ? theirSession.flights[0] : theirSession.flights)
        : null

      setMatch({
        id: data.id,
        status: data.status,
        pointOfConnection: data.point_of_connection ?? null,
        theirIntent: theirSession?.connection_intent ?? 'open',
        destinationIata: theirSession?.destination_iata ?? null,
        theirFlightIata: (theirFlightRec as { flight_iata?: string } | null)?.flight_iata ?? null,
        theirOriginIata: theirSession?.origin_iata ?? null,
        theirDepartureTime: theirSession?.departure_time ?? null,
        theirGate: theirSession?.gate ?? null,
        theirTerminal: theirSession?.terminal ?? null,
        iAmA,
        mySessionId: iAmA ? data.session_id_a : data.session_id_b,
        theirSessionId: iAmA ? data.session_id_b : data.session_id_a,
      })

      // Deep-linking back to an already-mutual match → confirmed screen.
      if (data.status === 'mutual') {
        router.replace({ pathname: '/(app)/meetup', params: { match_id: data.id } })
        return
      }

      // If the other side already said yes before we loaded and I have too
      // (my pending status), wait; otherwise decide.
      const myPendingStatus = iAmA ? 'pending_b' : 'pending_a'
      setPhase(data.status === myPendingStatus ? 'waiting' : 'deciding')
    } catch (err: any) {
      console.error('[match] loadMatch error:', err)
      setError(err.message ?? 'Could not load match.')
      setPhase('error')
    }
  }

  async function respond(interested: boolean) {
    if (!match || acting) return
    setActing(true)
    setRespondError('')

    try {
      if (!interested) {
        haptics.selection()
        const { error: declineErr } = await supabase
          .from('matches').update({ status: 'declined' }).eq('id', match.id)
        if (declineErr) console.error('[match] decline error:', declineErr)
        // Decrement declines_remaining so the session gate can enforce the cap.
        try {
          const { data: sess } = await supabase
            .from('sessions')
            .select('declines_remaining')
            .eq('id', match.mySessionId)
            .single()
          if (sess && sess.declines_remaining > 0) {
            await supabase.from('sessions')
              .update({ declines_remaining: sess.declines_remaining - 1 })
              .eq('id', match.mySessionId)
          }
        } catch (e) {
          console.warn('[match] declines_remaining update failed (non-fatal):', e)
        }
        // Declining returns to standby/searching — the session stays live.
        router.replace('/(app)/match/searching')
        return
      }

      haptics.success()

      // Store my identifying info with the accept, so the confirmed screen can
      // render both sides' info the moment it appears. supabase-js reports
      // failures via `error`, not exceptions — losing this write silently
      // would strip the meetup screen of the info we just required.
      const wearingUpdate = match.iAmA
        ? { wearing_a: wearing.trim() }
        : { wearing_b: wearing.trim() }
      const { error: wearingErr } = await supabase
        .from('matches').update(wearingUpdate).eq('id', match.id)
      if (wearingErr) {
        console.error('[match] wearing update error:', wearingErr)
        setRespondError('Could not save. Please try again.')
        setActing(false)
        return
      }

      const myPendingStatus = match.iAmA ? 'pending_b' : 'pending_a'
      const theirPendingStatus = match.iAmA ? 'pending_a' : 'pending_b'

      // Conditional update: only succeeds if status is still 'pending'.
      const { data: updated, error: updateErr } = await supabase
        .from('matches')
        .update({ status: myPendingStatus })
        .eq('id', match.id)
        .eq('status', 'pending')
        .select('id')

      if (updateErr) {
        console.error('[match] accept update error:', updateErr)
        setRespondError('Could not accept. Please try again.')
        setActing(false)
        return
      }

      if (updated && updated.length > 0) {
        // First to accept — wait for the other side (realtime + poll).
        setActing(false)
        setPhase('waiting')
        return
      }

      // Status was no longer 'pending'. Read the current state.
      const { data: current } = await supabase
        .from('matches')
        .select('status')
        .eq('id', match.id)
        .single()

      if (current?.status === theirPendingStatus) {
        // Other side already said yes — lock in as mutual. Conditional on the
        // status still being theirs: an unguarded update here could resurrect
        // a match that was declined in the race window.
        const { data: promoted, error: mutualErr } = await supabase
          .from('matches')
          .update({ status: 'mutual' })
          .eq('id', match.id)
          .eq('status', theirPendingStatus)
          .select('id')
        if (mutualErr) {
          console.error('[match] mutual update error:', mutualErr)
          setRespondError('Could not confirm the match. Please try again.')
          setActing(false)
          return
        }
        if (!promoted || promoted.length === 0) {
          // Status moved again (declined) between read and write.
          router.replace('/(app)/match/searching')
          return
        }
        goToConfirmed(match.id)
      } else if (current?.status === 'pending') {
        console.error('[match] accept failed silently — status still pending (possible RLS issue)')
        setRespondError('Could not accept. Please try again.')
        setActing(false)
      } else if (current?.status === 'mutual') {
        goToConfirmed(match.id)
      } else {
        // Declined or expired — back to searching.
        router.replace('/(app)/match/searching')
      }
    } catch (err: any) {
      console.error('[match] respond threw:', err)
      setRespondError(err.message ?? 'Something went wrong. Please try again.')
      setActing(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <FlipBoard label="STANDBY" cellSize={32} initialFlipMs={900} staggerMs={120} />
      </View>
    )
  }

  if (phase === 'error' || !match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <BackButton />
        <View style={styles.body}>
          <Text style={[type.subhead, styles.errorLine]}>
            {error || 'Could not load match.'}
          </Text>
        </View>
      </View>
    )
  }

  if (phase === 'waiting') {
    const theirDate = match.theirDepartureTime ? passDate(match.theirDepartureTime) : null
    const theirTime = match.theirDepartureTime ? passTime(match.theirDepartureTime) : null

    return (
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <BackButton />
        <View style={styles.waitBody}>
          <Text style={[type.subhead, styles.waitSubhead]}>
            You said yes. Waiting for them.
          </Text>

          <View style={styles.waitPassWrap}>
            <BoardingPass
              airline="STANDBY"
              classLabel="MEETUP PASS"
              passenger={null}
              origin={match.theirOriginIata}
              destination={match.destinationIata}
              flight={match.theirFlightIata}
              date={theirDate}
              time={theirTime}
              gate={match.theirGate}
              terminal={match.theirTerminal}
              status="PENDING"
              stampSlot={<StandbyStamp label="PENDING" delayMs={400} angle={-12} />}
            />
          </View>
        </View>
      </View>
    )
  }

  // phase === 'deciding'
  const reason = buildOneReason(match)
  const lines = wrapLines(reason, MAX_CHARS_PER_LINE)
  const canAccept = wearing.trim().length > 0 && !acting

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.body}>
        <View style={styles.reveal}>
          {lines.map((line, idx) => (
            <View key={`l-${idx}-${line}`} style={styles.lineWrap}>
              <FlipBoard
                label={line}
                cellSize={REVEAL_CELL_SIZE}
                staggerMs={PER_CELL_STAGGER_MS}
                initialFlipMs={
                  FIRST_LINE_OFFSET_MS +
                  idx * (MAX_CHARS_PER_LINE * PER_CELL_STAGGER_MS + PER_LINE_DELAY_MS)
                }
              />
            </View>
          ))}
        </View>

        <View style={styles.wearingBlock}>
          <Text style={styles.wearingLabel}>WHAT ARE YOU WEARING?</Text>
          <TextInput
            style={styles.wearingInput}
            placeholder="Navy puffer, red backpack"
            placeholderTextColor={colors.subtle}
            value={wearing}
            onChangeText={setWearing}
            maxLength={80}
            selectionColor={colors.accent}
          />
        </View>

        {respondError ? (
          <Text style={styles.respondErrorText}>{respondError}</Text>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={() => respond(false)}
          disabled={acting}
          hitSlop={14}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.skipText}>DECLINE MATCH</Text>
        </Pressable>

        <Pressable
          onPress={() => respond(true)}
          disabled={!canAccept}
          style={({ pressed }) => [
            styles.meetBtn,
            pressed && { opacity: 0.85 },
            !canAccept && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.meetText}>MEET THEM</Text>
        </Pressable>
      </View>
    </View>
  )
}



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topRow: { alignItems: 'center' },
  eyebrow: { color: colors.subtle },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  subhead: {
    color: colors.subtle,
    textAlign: 'center',
  },
  waitSubhead: {
    color: colors.text,
    textAlign: 'center',
  },
  waitBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 4,
  },
  waitPassWrap: {
    alignSelf: 'stretch',
  },
  reveal: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 4,
  },
  // width: '100%' ensures the parent always fills the full reveal width so
  // alignItems: 'center' centers the FlipBoard deterministically from frame 1.
  lineWrap: {
    alignItems: 'center',
    width: '100%',
  },
  wearingBlock: {
    alignSelf: 'stretch',
    gap: 8,
  },
  wearingLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  wearingInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },
  privacyNote: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: 8,
  },
  respondErrorText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.error,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  meetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 160,
  },
  meetText: {
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  errorLine: { color: colors.text, textAlign: 'center' },
})
