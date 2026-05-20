import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { FlipBoard } from '../../components/FlipBoard'
import { BoardingPass } from '../../components/BoardingPass'
import { StandbyStamp } from '../../components/StandbyStamp'

// Match status state machine:
//   pending    — created, both users notified, neither has responded
//   pending_b  — user A accepted; waiting for user B to decide
//   pending_a  — user B accepted; waiting for user A to decide
//   mutual     — both accepted; proceed to meetup
//   declined   — at least one user declined

const REVEAL_CELL_SIZE = 22
const MAX_CHARS_PER_LINE = 14
const PER_CELL_STAGGER_MS = 70
const PER_LINE_DELAY_MS = 260
const FIRST_LINE_OFFSET_MS = 500

type MatchData = {
  id: string
  status: string
  pointOfConnection: string | null
  theirIntent: string
  theirPurpose: string | null
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

const PURPOSE_LABEL: Record<string, string> = {
  conference: 'a conference',
  work_trip: 'a work trip',
  solo_travel: 'solo travel',
  relocating: 'relocating',
  other: 'travel',
}

const INTENT_LABEL: Record<string, string> = {
  professional: 'professional connections',
  social: 'social connections',
  open: 'anything',
}

function buildOneReason(match: MatchData): string {
  if (match.pointOfConnection) return match.pointOfConnection
  const intentStr = INTENT_LABEL[match.theirIntent] ?? 'something new'
  const purposeStr = match.theirPurpose ? PURPOSE_LABEL[match.theirPurpose] : null
  const destStr = match.destinationIata ? ` to ${match.destinationIata}` : ''
  if (purposeStr) return `someone heading${destStr} for ${purposeStr}`
  return `someone open to ${intentStr}`
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
  const [error, setError] = useState('')
  const [respondError, setRespondError] = useState('')
  const [acting, setActing] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    console.log('[match] screen mounted, match_id=', match_id)
    loadMatch()
  }, [match_id])

  // Realtime subscription: fires only while in the 'waiting' phase.
  // Watches the match row for the other user's response.
  useEffect(() => {
    if (phase !== 'waiting' || !match) return

    const channel = supabase
      .channel(`match-status-${match.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status
          console.log('[match] realtime status update:', newStatus)
          console.log('[match realtime]', { newStatus, match_id: match.id })
          if (newStatus === 'mutual') {
            haptics.standbyStamp()
            router.replace({ pathname: '/(app)/meetup', params: { match_id: match.id } })
          } else if (newStatus === 'declined') {
            // Other side declined — release back to searching
            Alert.alert('They passed — looking for someone else')
            router.replace('/(app)/match/searching')
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
            user_id, connection_intent, travel_purpose, destination_iata,
            origin_iata, departure_time, gate, terminal,
            flights(flight_iata)
          ),
          session_b:sessions!session_id_b(
            user_id, connection_intent, travel_purpose, destination_iata,
            origin_iata, departure_time, gate, terminal,
            flights(flight_iata)
          )
        `)
        .eq('id', match_id)
        .single()

      if (matchErr) throw matchErr

      console.log('[match] loaded match status=', data.status, 'id=', data.id)

      // If already declined, don't show the deciding UI — go back silently.
      if (data.status === 'declined') {
        console.log('[match] match already declined — returning home')
        router.replace('/(app)/')
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
        theirPurpose: theirSession?.travel_purpose ?? null,
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

      // If the match was already mutually accepted (e.g. deep-linking back to this
      // screen), go straight to meetup rather than showing it again.
      if (data.status === 'mutual') {
        router.replace({ pathname: '/(app)/meetup', params: { match_id: data.id } })
        return
      }

      // If the other side already said yes before we loaded, go to waiting
      // so our Realtime subscription can catch the mutual update.
      const myPendingStatus = iAmA ? 'pending_b' : 'pending_a'
      if (data.status === myPendingStatus) {
        setPhase('waiting')
      } else {
        setPhase('deciding')
      }
    } catch (err: any) {
      console.error('[match] loadMatch error:', err)
      setError(err.message ?? 'Could not load match.')
      setPhase('error')
    }
  }

  async function respond(interested: boolean) {
    if (!match || acting) return
    console.log('[match respond]', { accept: interested, match_id: match.id, phase })
    setActing(true)
    setRespondError('')

    console.log('[match] respond interested=', interested, 'match=', match.id, 'iAmA=', match.iAmA)

    try {
      if (!interested) {
        haptics.selection()
        const { error: declineErr } = await supabase
          .from('matches').update({ status: 'declined' }).eq('id', match.id)
        if (declineErr) {
          console.error('[match] decline error:', declineErr)
          // Still navigate away — match is stale regardless
        }
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
        router.replace('/(app)/')
        return
      }

      haptics.success()

      // Two-sided accept:
      //   If I'm A: move pending → pending_b (B still needs to say yes)
      //   If I'm B: move pending → pending_a (A still needs to say yes)
      // If the other side already accepted (pending_a / pending_b flipped),
      // we move directly to mutual.
      const myPendingStatus = match.iAmA ? 'pending_b' : 'pending_a'
      const theirPendingStatus = match.iAmA ? 'pending_a' : 'pending_b'

      // Conditional update: only succeeds if status is still 'pending'.
      const { data: updated, error: updateErr } = await supabase
        .from('matches')
        .update({ status: myPendingStatus })
        .eq('id', match.id)
        .eq('status', 'pending')
        .select('id')

      console.log('[match] conditional accept update: data=', updated, 'error=', updateErr)

      if (updateErr) {
        // Hard error (e.g. network, RLS) — show inline error, don't navigate away.
        console.error('[match] accept update error:', updateErr)
        setRespondError('Could not accept. Please try again.')
        setActing(false)
        return
      }

      if (updated && updated.length > 0) {
        // I was first to accept — wait for the other side.
        setActing(false)
        setPhase('waiting')
        return
      }

      // The status was no longer 'pending' when I tried. Read current state.
      const { data: current, error: readErr } = await supabase
        .from('matches')
        .select('status')
        .eq('id', match.id)
        .single()

      console.log('[match] re-read status=', current?.status, 'readErr=', readErr)

      if (current?.status === theirPendingStatus) {
        // Other side already said yes — lock in as mutual.
        const { error: mutualErr } = await supabase
          .from('matches').update({ status: 'mutual' }).eq('id', match.id)
        if (mutualErr) {
          console.error('[match] mutual update error:', mutualErr)
          setRespondError('Could not confirm mutual match. Please try again.')
          setActing(false)
          return
        }
        haptics.standbyStamp()
        router.replace({ pathname: '/(app)/match/mutual', params: { match_id: match.id } })
      } else if (current?.status === 'pending') {
        // Update returned empty AND status is still pending → silent RLS/permission failure.
        console.error('[match] accept failed silently — status still pending (possible RLS issue)')
        setRespondError('Could not accept. Please try again.')
        setActing(false)
      } else {
        // Match was declined or expired — go back without re-pushing.
        console.log('[match] match no longer actionable, status=', current?.status)
        router.replace('/(app)/')
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
        <Pressable
          onPress={() => router.replace('/(app)/')}
          hitSlop={14}
          style={styles.backBtn}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
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
        <Pressable
          onPress={() => { haptics.buttonTap(); router.replace('/(app)/') }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={styles.topRow}>
          <Text style={[type.eyebrow, styles.eyebrow]}>MATCH · WAITING</Text>
        </View>
        <View style={styles.waitBody}>
          <Text style={[type.subhead, styles.waitSubhead]}>
            You said yes.{'\n'}Waiting for them to stamp theirs.
          </Text>

          <View style={styles.waitPassWrap}>
            <BoardingPass
              airline="STANDBY"
              classLabel="MEETUP PASS · PENDING"
              passenger={null}
              origin={match.theirOriginIata}
              destination={match.destinationIata}
              flight={match.theirFlightIata}
              date={theirDate}
              time={theirTime}
              gate={match.theirGate}
              terminal={match.theirTerminal}
              seat={null}
              stampSlot={<StandbyStamp label="PENDING" delayMs={400} angle={-12} />}
            />
          </View>

          <Text style={styles.privacyNote}>
            YOU'LL BE NOTIFIED THE MOMENT THEY RESPOND.
          </Text>
        </View>
      </View>
    )
  }

  // phase === 'deciding'
  const reason = buildOneReason(match)
  const lines = wrapLines(reason, MAX_CHARS_PER_LINE)

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Text style={[type.eyebrow, styles.eyebrow]}>MATCH · 01</Text>
      </View>

      <View style={styles.body}>
        <Text style={[type.subhead, styles.subhead]}>
          one reason to get to know each other.
        </Text>

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

        {respondError ? (
          <Text style={styles.respondErrorText}>{respondError}</Text>
        ) : null}

        <Text style={styles.privacyNote}>
          THEIR NAME STAYS HIDDEN UNTIL YOU BOTH SAY YES.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={() => respond(false)}
          disabled={acting}
          hitSlop={14}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>

        <Pressable
          onPress={() => respond(true)}
          disabled={acting}
          style={({ pressed }) => [
            styles.meetBtn,
            pressed && { opacity: 0.85 },
            acting && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.meetTriangle}>{'▶'}</Text>
          <Text style={styles.meetText}>MEET THEM</Text>
        </Pressable>
      </View>
    </View>
  )
}

function passDate(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

function passTime(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
    gap: 28,
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
  // alignItems: 'center' centers the FlipBoard deterministically from frame 1,
  // eliminating the left-snap-then-center glitch caused by FlipBoard's own
  // alignSelf: 'flex-start' interacting with an unconstrained parent width.
  lineWrap: {
    alignItems: 'center',
    width: '100%',
  },
  privacyNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: 8,
  },
  respondErrorText: {
    fontFamily: fonts.mono,
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
    fontFamily: fonts.mono,
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
  meetTriangle: {
    fontSize: 10,
    color: colors.bg,
    includeFontPadding: false,
  },
  meetText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: {
    fontSize: 10,
    color: colors.subtle,
    includeFontPadding: false,
  },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  errorLine: { color: colors.text, textAlign: 'center' },
})
