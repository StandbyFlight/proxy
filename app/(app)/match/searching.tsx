import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, userChannelName } from '../../../lib/ably'
import { takePendingSession } from '../../../lib/pendingMatch'
import { getActiveSession, getActiveMatch } from '../../../lib/session'
import { haptics } from '../../../lib/haptics'
import { ManifestBoard } from '../../../components/ManifestBoard'
import { primaryIataForCity } from '../../../lib/cities'
import type Ably from 'ably'

// The "actively searching" leaf. Standby keeps searching for the whole life of
// the session: "We looked, nobody yet" is a status, not a dead end — the
// matcher is re-invoked on an interval and the match poll keeps running until
// the session actually expires. Re-invoking is idempotent per session (the
// matcher excludes already-matched pairs), so repeat fires are harmless.

type ScreenState = 'searching' | 'curiosity' | 'exhausted' | 'no-session'

const REMATCH_INTERVAL_MS = 45_000
const MATCH_POLL_MS = 4_000
const CURIOSITY_DELAY_MS = 15_000

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
  const [matcherBody, setMatcherBody] = useState<Record<string, unknown> | null>(null)

  // Resolve profile + active session on focus. If a match already exists for
  // this session, deep-link to match/room — the user shouldn't sit in the
  // searching loop when a match is live.
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

      const activeSession = await getActiveSession()
      if (cancelled) return
      if (!activeSession) { setState('no-session'); return }
      if (activeSession.flight_iata) setFlightIata(activeSession.flight_iata)

      const existingMatch = await getActiveMatch(activeSession.id)
      if (cancelled) return
      if (existingMatch) {
        router.replace({ pathname: '/(app)/match/room', params: { match_id: existingMatch.id } })
        return
      }

      // The matcher body is derived from the session row itself — searching is
      // idempotent per session, regardless of boarding-pass contents.
      const { flight_iata: _f, ...rest } = activeSession as unknown as Record<string, unknown>
      setMatcherBody(rest)
    }
    load().catch(() => {})
    return () => { cancelled = true }
  }, []))

  // Ably subscriptions for the user channel.
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
        router.push({ pathname: '/(app)/match', params: { match_id } })
      }).catch(() => {})

      channel.subscribe('curiosity.match', (msg) => {
        const data = msg.data as {
          match_id: string
          winning_signal: string | null
          flight_iata?: string
          origin_iata?: string
        }
        if (declinedMatchIds.current.has(data.match_id)) return
        setCuriosity({
          match_id: data.match_id,
          winning_signal: data.winning_signal,
          flight_iata: data.flight_iata ?? '',
          origin_iata: data.origin_iata ?? '···',
        })
        setState('curiosity')
        haptics.standbyStamp()
      }).catch(() => {})

      channel.subscribe('pool.exhausted', () => {
        // Not a dead end: show the quiet state, keep searching underneath.
        setState(s => (s === 'curiosity' ? s : 'exhausted'))
        setCuriosity(null)
      }).catch(() => {})

      // Subscriptions are live — safe to fire matching now. takePendingSession
      // is set by intent.tsx after it creates the session row.
      const pending = takePendingSession()
      if (pending) {
        setMatcherBody(pending)
        supabase.functions.invoke('match-sessions', { body: pending }).catch(() => {})
      }
    }

    subscribe().catch(() => {})
    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [])

  // Curiosity-mode probe: after 15s of plain searching, ask the matcher to
  // surface someone the user wasn't explicitly looking for. Backend enforces
  // the same wait on the partner side, so a stale fire is harmless.
  useEffect(() => {
    if (state !== 'searching' || !matcherBody) return
    const timer = setTimeout(() => {
      supabase.functions
        .invoke('match-sessions', { body: { ...matcherBody, curiosity_mode: true } })
        .catch(() => {})
    }, CURIOSITY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, matcherBody])

  // Keep searching: re-invoke the matcher on an interval while in searching or
  // exhausted state. Each tick re-reads the session — if it has expired or
  // been archived (possibly from another device), stop instead of pushing a
  // stale row at the matcher.
  useEffect(() => {
    if ((state !== 'searching' && state !== 'exhausted') || !matcherBody) return
    const interval = setInterval(async () => {
      try {
        const fresh = await getActiveSession()
        if (!fresh) {
          setState('no-session')
          return
        }
        // Use the fresh row for this invocation; matcherBody stays stable so
        // the poll/curiosity effects don't churn their intervals.
        const { flight_iata: _f, ...body } = fresh as unknown as Record<string, unknown>
        supabase.functions.invoke('match-sessions', { body }).catch(() => {})
      } catch { /* transient network failure — next tick retries */ }
    }, REMATCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [state, matcherBody])

  // Match poll — belt-and-braces alongside Ably. Runs in both searching and
  // exhausted states so a match can always pull the user out of the quiet
  // state. One query per tick, keyed on the session id we already hold.
  useEffect(() => {
    if ((state !== 'searching' && state !== 'exhausted') || !matcherBody) return
    const sessionId = matcherBody.id as string
    if (!sessionId) return

    const interval = setInterval(async () => {
      try {
        const existingMatch = await getActiveMatch(sessionId)
        if (existingMatch) {
          clearInterval(interval)
          router.replace({
            pathname: '/(app)/match/room',
            params: { match_id: existingMatch.id },
          })
        }
      } catch { /* transient network failure — next tick retries */ }
    }, MATCH_POLL_MS)

    return () => clearInterval(interval)
  }, [state, matcherBody])

  function dismissCuriosity() {
    if (!curiosity) return
    haptics.selection()
    declinedMatchIds.current.add(curiosity.match_id)
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
          <Pressable
            onPress={() => { haptics.buttonTap(); router.replace('/(app)/flight') }}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>START A SESSION</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const headline =
    state === 'exhausted' ? 'We looked, nobody yet.'
      : state === 'curiosity' ? 'Be open to someone unexpected.'
      : "Finding the person you would've walked past."

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{headline}</Text>

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName={firstName || 'YOU'}
            iata={iata}
            flightIata={flightIata}
            mode="static"
            status="standby"
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
              Not your criteria — could still be worth it.
            </Text>
            <View style={styles.curiosityActions}>
              <Pressable
                onPress={openMatch}
                style={({ pressed }) => [styles.meetBtn, pressed && { opacity: 0.85 }]}
              >
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  eyebrow: { color: colors.subtle },
  body: { flex: 1, justifyContent: 'center', gap: 20 },
  headline: { color: colors.text },
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
  meetBtnText: {
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  dismissBtn: { paddingVertical: 6 },
  dismissText: {
    fontFamily: fonts.body,
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
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
})
