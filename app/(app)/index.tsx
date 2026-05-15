import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { getAblyClient, userChannelName } from '../../lib/ably'
import { takePendingSession } from '../../lib/pendingMatch'
import { haptics } from '../../lib/haptics'
import { ManifestBoard } from '../../components/ManifestBoard'
import { InputFlipCell } from '../../components/InputFlipCell'
import { primaryIataForCity } from '../../lib/cities'
import type Ably from 'ably'

type ScreenState = 'searching' | 'curiosity' | 'exhausted' | 'waiting_match'

interface CuriosityData {
  match_id: string
  winning_signal: string | null
  flight_iata: string
  origin_iata: string
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const declinedMatchIds = useRef(new Set<string>())

  const [firstName, setFirstName] = useState('')
  const [iata, setIata] = useState('···')
  const [flightIata, setFlightIata] = useState<string | null>(null)
  const [state, setState] = useState<ScreenState>('searching')
  const [curiosity, setCuriosity] = useState<CuriosityData | null>(null)
  const [waitingMatchId, setWaitingMatchId] = useState<string | null>(null)
  const [clockLabel, setClockLabel] = useState(formatClock(new Date()))
  // Session record kept around so the curiosity timer can re-invoke match-sessions
  // after 90s of waiting. Mirrors the body shape that intent.tsx hands off.
  const [matcherBody, setMatcherBody] = useState<Record<string, unknown> | null>(null)

  // Live clock for the eyebrow — ticks every 30s so the minute stays current.
  useEffect(() => {
    const id = setInterval(() => setClockLabel(formatClock(new Date())), 30_000)
    return () => clearInterval(id)
  }, [])

  // Load profile basics for the manifest row, and gate on an active session.
  // Runs on every focus so the board reflects a newly-entered flight without
  // requiring a full app restart.
  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const { data: profile } = await supabase
        .from('users')
        .select('first_name, base_city')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (profile?.first_name) setFirstName(profile.first_name)
      if (profile?.base_city) setIata(primaryIataForCity(profile.base_city))

      // Get most recent session (active or expired) — needed for match recovery.
      // Using a separate query without expiry filter so we can surface a pending
      // match even if the session's departure time already passed.
      const nowIso = new Date().toISOString()
      const [{ data: recentSession }, { data: activeSession }] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, expires_at, flights(flight_iata)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('id, user_id, flight_id, origin_iata, destination_iata, departure_time, terminal, connection_intent, travel_purpose, event_id, flights(flight_iata)')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return

      // Recover any match — check before the session-expiry gate so a match
      // that fired just as the departure time passed isn't silently dropped.
      if (recentSession) {
        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id, status, session_id_a')
          .or(`session_id_a.eq.${recentSession.id},session_id_b.eq.${recentSession.id}`)
          .in('status', ['pending', 'pending_a', 'pending_b', 'mutual'])
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (existingMatch) {
          console.log('[home] focus: recovering match', existingMatch.id, 'status=', existingMatch.status)
          const flight = recentSession.flights as { flight_iata: string } | { flight_iata: string }[] | null
          const fIata = Array.isArray(flight) ? flight[0]?.flight_iata : flight?.flight_iata
          if (fIata) setFlightIata(fIata)
          if (existingMatch.status === 'mutual') {
            setWaitingMatchId(null)
            router.replace({ pathname: '/(app)/meetup', params: { match_id: existingMatch.id } })
            return
          }
          // Check whether the current user already accepted (pending_b means A accepted,
          // pending_a means B accepted). If so, stay on home with a pending indicator
          // rather than forcing them back to the match screen.
          const iAmA = existingMatch.session_id_a === recentSession.id
          const iAlreadyAccepted =
            (iAmA && existingMatch.status === 'pending_b') ||
            (!iAmA && existingMatch.status === 'pending_a')
          if (iAlreadyAccepted) {
            setWaitingMatchId(existingMatch.id)
            setState('waiting_match')
            return
          }
          setWaitingMatchId(null)
          router.push({ pathname: '/(app)/match', params: { match_id: existingMatch.id } })
          return
        }
        setWaitingMatchId(null)
      }

      if (!activeSession) { router.replace('/(app)/flight'); return }
      const flight = activeSession.flights as { flight_iata: string } | { flight_iata: string }[] | null
      const fIata = Array.isArray(flight) ? flight[0]?.flight_iata : flight?.flight_iata
      if (fIata) setFlightIata(fIata)

      // Capture the body the curiosity timer will need. Strip the embedded
      // flights relation since the edge function looks up flight_iata itself.
      const { flights: _flights, ...rest } = activeSession as Record<string, unknown> & {
        flights?: unknown
      }
      setMatcherBody(rest)
    }
    load()
    return () => { cancelled = true }
  }, []))

  // Ably subscriptions for match events.
  useEffect(() => {
    let cancelled = false

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(userChannelName(session.user.id))
      channelRef.current = channel

      channel.subscribe('match.created', (msg) => {
        const { match_id } = msg.data as { match_id: string }
        console.log('[home] Ably match.created → navigating to match', match_id)
        router.push({ pathname: '/(app)/match', params: { match_id } })
      })

      channel.subscribe('curiosity.match', (msg) => {
        const data = msg.data as {
          match_id: string
          winning_signal: string | null
          flight_iata?: string
          origin_iata?: string
        }
        console.log('[home] Ably curiosity.match received:', data)
        if (declinedMatchIds.current.has(data.match_id)) {
          console.log('[home] curiosity match already declined — ignoring')
          return
        }
        setCuriosity({
          match_id: data.match_id,
          winning_signal: data.winning_signal,
          flight_iata: data.flight_iata ?? '',
          origin_iata: data.origin_iata ?? '···',
        })
        setState('curiosity')
        haptics.standbyStamp()
      })

      channel.subscribe('pool.exhausted', () => {
        console.log('[home] Ably pool.exhausted')
        setState('exhausted')
        setCuriosity(null)
      })

      // Subscriptions are live — safe to fire matching now.
      const pending = takePendingSession()
      if (pending) {
        setMatcherBody(pending)
        supabase.functions.invoke('match-sessions', { body: pending }).catch(() => {})
      }
    }

    subscribe()

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [])

  // Realtime subscription for a match the current user has already accepted.
  // Active only when on the home screen (not match.tsx) after navigating back.
  // Catches the mutual event without requiring the user to stay on match.tsx.
  useEffect(() => {
    if (!waitingMatchId) return
    const channel = supabase
      .channel(`home-match-${waitingMatchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${waitingMatchId}` },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status
          console.log('[home] waiting match status update:', newStatus)
          if (newStatus === 'mutual') {
            const matchId = waitingMatchId
            haptics.standbyStamp()
            setWaitingMatchId(null)
            setState('searching')
            router.replace({ pathname: '/(app)/meetup', params: { match_id: matchId } })
          } else if (newStatus === 'declined') {
            setWaitingMatchId(null)
            setState('searching')
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [waitingMatchId])

  // Curiosity-mode probe: after 15 seconds in 'searching' state, ask the matcher
  // to find someone the user might not have originally been looking for. The
  // backend separately enforces that *both* users have waited 15s, so this is
  // safe to fire even if the partner just walked up. Re-arms whenever state
  // returns to 'searching' (e.g. after a curiosity match is declined).
  useEffect(() => {
    if (state !== 'searching' || !matcherBody) return
    const timer = setTimeout(() => {
      supabase.functions
        .invoke('match-sessions', { body: { ...matcherBody, curiosity_mode: true } })
        .catch(() => {})
    }, 15_000)
    return () => clearTimeout(timer)
  }, [state, matcherBody])

  async function dismissCuriosity() {
    if (!curiosity) return
    haptics.selection()
    const matchId = curiosity.match_id
    console.log('[home] dismissCuriosity (KEEP WAITING) match_id=', matchId)
    declinedMatchIds.current.add(matchId)
    setCuriosity(null)
    setState('searching')
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'declined' })
        .eq('id', matchId)
      if (error) console.error('[home] dismissCuriosity decline error:', error)
    } catch (e) {
      console.error('[home] dismissCuriosity threw:', e)
    }
  }

  function openMatch() {
    if (!curiosity) return
    haptics.buttonTap()
    console.log('[home] openMatch (I\'M IN) → match screen, match_id=', curiosity.match_id)
    router.push({ pathname: '/(app)/match', params: { match_id: curiosity.match_id } })
  }

  const eyebrowLabel =
    state === 'exhausted'
      ? `THE GATE · ${clockLabel}`
      : state === 'curiosity'
        ? `CURIOSITY · ${clockLabel}`
        : state === 'waiting_match'
          ? `STANDBY · ${clockLabel}`
          : `LISTENING · ${clockLabel}`

  const headline =
    state === 'exhausted'
      ? "We looked, nobody yet."
      : state === 'curiosity'
        ? 'Be open to someone unexpected.'
        : state === 'waiting_match'
          ? "They're deciding now."
          : "Finding the person you would've walked past."

  const subhead =
    state === 'exhausted'
      ? 'No new people are online right now — check back later, more show up as their flights approach.'
      : null

  const manifestStatus = state === 'exhausted' ? 'gate-quiet' : 'standby'

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      {/* Top chrome — gear icon top-right. */}
      <View style={styles.topRow}>
        <View style={styles.eyebrowWrap}>
          {state !== 'searching' ? (
            <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrowLabel}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.push('/(app)/profile') }}
          hitSlop={14}
          style={({ pressed }) => [styles.passengerBadge, pressed && { opacity: 0.5 }]}
        >
          <InputFlipCell
            char={(firstName[0] || ' ').toUpperCase()}
            cellSize={28}
            cellWidth={22}
          />
        </Pressable>
      </View>

      {/* Body — manifest board centered. */}
      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{headline}</Text>
        {subhead ? (
          <Text style={[type.subhead, styles.subhead]}>{subhead}</Text>
        ) : null}

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName={firstName || 'YOU'}
            iata={iata}
            flightIata={flightIata}
            mode="static"
            status={manifestStatus}
            stranger={
              state === 'curiosity' && curiosity
                ? {
                    flightIata: curiosity.flight_iata || '────',
                    originIata: curiosity.origin_iata || '···',
                  }
                : null
            }
          />
        </View>

        {/* Curiosity panel: serendipity line + I'M IN / KEEP WAITING. */}
        {state === 'curiosity' && curiosity ? (
          <View style={styles.curiosityPanel}>
            <Text style={[type.subhead, styles.curiosityLine]}>
              We haven't found someone who fits your criteria — but you never know who you'll meet.
            </Text>
            <View style={styles.curiosityActions}>
              <Pressable
                onPress={openMatch}
                style={({ pressed }) => [styles.meetBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.triangle}>{'▶'}</Text>
                <Text style={styles.meetBtnText}>I'M IN</Text>
              </Pressable>
              <Pressable
                onPress={dismissCuriosity}
                hitSlop={14}
                style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.5 }]}
              >
                <Text style={styles.dismissText}>KEEP WAITING</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom — pending match banner when waiting, otherwise change flight. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {waitingMatchId ? (
          <Pressable
            onPress={() => { haptics.buttonTap(); router.push({ pathname: '/(app)/match', params: { match_id: waitingMatchId } }) }}
            style={({ pressed }) => [styles.pendingBannerBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.pendingBannerTriangle}>{'▶'}</Text>
            <Text style={styles.pendingBannerText}>MATCH PENDING — TAP TO VIEW</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { haptics.buttonTap(); router.push('/(app)/flight') }}
            style={({ pressed }) => [styles.changeFlightBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.changeFlightText}>CHANGE FLIGHT</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function formatClock(d: Date): string {
  let h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${suffix}`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowWrap: { flex: 1 },
  eyebrow: { color: colors.subtle },
  passengerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  headline: { color: colors.text },
  subhead: { color: colors.subtle, marginTop: -8 },
  boardWrap: { marginTop: 8 },
  curiosityPanel: {
    marginTop: 8,
    gap: 14,
  },
  curiosityLine: { color: colors.text },
  curiosityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  meetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  triangle: {
    fontSize: 9,
    color: colors.bg,
  },
  meetBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  dismissBtn: { paddingVertical: 6 },
  dismissText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  footer: {
    paddingTop: 12,
    alignItems: 'center',
  },
  changeFlightBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeFlightText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  pendingBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    width: '100%',
  },
  pendingBannerTriangle: {
    fontSize: 9,
    color: colors.accent,
  },
  pendingBannerText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.accent,
  },
})
