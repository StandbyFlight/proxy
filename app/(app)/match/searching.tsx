import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, userChannelName } from '../../../lib/ably'
import { takePendingSession } from '../../../lib/pendingMatch'
import { haptics } from '../../../lib/haptics'
import { ManifestBoard } from '../../../components/ManifestBoard'
import { primaryIataForCity } from '../../../lib/cities'
import type Ably from 'ably'

// This is the "actively searching" leaf — Ably presence is live, the matcher
// has been pinged, and we're waiting for it to write a match row. Home used to
// own this behavior; it now lives here so Home can be a quiet status hub.

type ScreenState = 'searching' | 'curiosity' | 'exhausted' | 'no-session'

interface CuriosityData {
  match_id: string
  winning_signal: string | null
  flight_iata: string
  origin_iata: string
}

export default function SearchingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const declinedMatchIds = useRef(new Set<string>())

  const [firstName, setFirstName] = useState('')
  const [iata, setIata] = useState('···')
  const [flightIata, setFlightIata] = useState<string | null>(null)
  const [state, setState] = useState<ScreenState>('searching')
  const [curiosity, setCuriosity] = useState<CuriosityData | null>(null)
  const [clockLabel, setClockLabel] = useState(formatClock(new Date()))
  const [matcherBody, setMatcherBody] = useState<Record<string, unknown> | null>(null)

  // Live clock for the eyebrow.
  useEffect(() => {
    const id = setInterval(() => setClockLabel(formatClock(new Date())), 30_000)
    return () => clearInterval(id)
  }, [])

  // Resolve profile + active session on focus. If there's an existing pending
  // or mutual match for this session, deep-link to match/room — the user
  // shouldn't be sitting in the searching loop when a match already exists.
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

      const nowIso = new Date().toISOString()
      const { data: activeSession } = await supabase
        .from('sessions')
        .select('id, user_id, flight_id, origin_iata, destination_iata, departure_time, terminal, connection_intent, travel_purpose, event_id, flights(flight_iata)')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      if (!activeSession) { setState('no-session'); return }

      const fl = activeSession.flights as { flight_iata: string } | { flight_iata: string }[] | null
      const fIata = Array.isArray(fl) ? fl[0]?.flight_iata : fl?.flight_iata
      if (fIata) setFlightIata(fIata)

      // If a pending/mutual match already exists for this session, send the
      // user to match/room and let it forward to the correct leaf.
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id, status')
        .or(`session_id_a.eq.${activeSession.id},session_id_b.eq.${activeSession.id}`)
        .in('status', ['pending', 'pending_a', 'pending_b', 'mutual'])
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (existingMatch) {
        router.replace({ pathname: '/(app)/match/room', params: { match_id: existingMatch.id } })
        return
      }

      // Keep the body around so the curiosity timer can re-invoke match-sessions.
      const { flights: _flights, ...rest } = activeSession as Record<string, unknown> & {
        flights?: unknown
      }
      setMatcherBody(rest)
    }
    load()
    return () => { cancelled = true }
  }, []))

  // Ably subscriptions for the user channel. Match.created → deep-link to the
  // decision card. Curiosity.match → surface the "I'M IN / KEEP WAITING" panel
  // without leaving the screen. Pool exhausted → switch to the quiet state.
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
        console.log('[searching] match.created → match screen', match_id)
        router.push({ pathname: '/(app)/match', params: { match_id } })
      })

      channel.subscribe('curiosity.match', (msg) => {
        const data = msg.data as {
          match_id: string
          winning_signal: string | null
          flight_iata?: string
          origin_iata?: string
        }
        console.log('[searching] curiosity.match', data)
        if (declinedMatchIds.current.has(data.match_id)) return
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
        console.log('[searching] pool.exhausted')
        setState('exhausted')
        setCuriosity(null)
      })

      // Subscriptions are live — safe to fire matching now. takePendingSession
      // is set by intent.tsx after it creates the session row, so the matcher
      // call sees a guaranteed-active session.
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

  // Curiosity-mode probe: after 15s of plain searching, ask the matcher to
  // surface someone the user wasn't explicitly looking for. Backend enforces
  // the same 15s wait on the partner side, so a stale fire is harmless.
  useEffect(() => {
    if (state !== 'searching' || !matcherBody) return
    const timer = setTimeout(() => {
      supabase.functions
        .invoke('match-sessions', { body: { ...matcherBody, curiosity_mode: true } })
        .catch(() => {})
    }, 15_000)
    return () => clearTimeout(timer)
  }, [state, matcherBody])

  useEffect(() => {
    if (state !== 'searching' || !matcherBody) return

    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const nowIso = new Date().toISOString()
      const { data: activeSession } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!activeSession) return

      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id, status')
        .or(`session_id_a.eq.${activeSession.id},session_id_b.eq.${activeSession.id}`)
        .in('status', ['pending', 'pending_a', 'pending_b', 'mutual'])
        .limit(1)
        .maybeSingle()

      if (existingMatch) {
        clearInterval(interval)
        router.replace({
          pathname: '/(app)/match/room',
          params: { match_id: existingMatch.id }
        })
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [state, matcherBody])

  function dismissCuriosity() {
    if (!curiosity) return
    haptics.selection()
    const matchId = curiosity.match_id
    declinedMatchIds.current.add(matchId)
    setCuriosity(null)
    setState('searching')
  }

  function openMatch() {
    if (!curiosity) return
    haptics.buttonTap()
    router.push({ pathname: '/(app)/match', params: { match_id: curiosity.match_id } })
  }

  if (state === 'no-session') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.body}>
          <Text style={[type.eyebrow, styles.eyebrow]}>NO SESSION</Text>
          <Text style={[type.headline, styles.headline]}>You're not in a session.</Text>
          <Text style={[type.subhead, styles.subhead]}>
            Start one from Session and we'll surface someone here when there's a fit.
          </Text>
          <Pressable
            onPress={() => { haptics.buttonTap(); router.replace('/(app)/flight') }}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.triangleOnRed}>{'▶'}</Text>
            <Text style={styles.primaryBtnText}>START A SESSION</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const eyebrowLabel =
    state === 'exhausted' ? `THE GATE · ${clockLabel}`
      : state === 'curiosity' ? `CURIOSITY · ${clockLabel}`
      : `LISTENING · ${clockLabel}`

  const headline =
    state === 'exhausted' ? "We looked, nobody yet."
      : state === 'curiosity' ? 'Be open to someone unexpected.'
      : "Finding the person you would've walked past."

  const subhead =
    state === 'exhausted'
      ? 'No new people are online right now. Check back later, more show up as their flights approach.'
      : null

  const manifestStatus = state === 'exhausted' ? 'gate-quiet' : 'standby'

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrowLabel}</Text>
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{headline}</Text>
        {subhead ? <Text style={[type.subhead, styles.subhead]}>{subhead}</Text> : null}

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

        {state === 'curiosity' && curiosity ? (
          <View style={styles.curiosityPanel}>
            <Text style={[type.subhead, styles.curiosityLine]}>
              We haven't found someone who fits your criteria, but you never know who you'll meet.
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
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topRow: { alignItems: 'flex-start' },
  eyebrow: { color: colors.subtle },
  body: { flex: 1, justifyContent: 'center', gap: 20 },
  headline: { color: colors.text },
  subhead: { color: colors.subtle, marginTop: -8 },
  boardWrap: { marginTop: 8 },
  curiosityPanel: { marginTop: 8, gap: 14 },
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
  triangle: { fontSize: 9, color: colors.bg },
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
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
})
