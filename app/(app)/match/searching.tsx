import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, userChannelName } from '../../../lib/ably'
import { getActiveSession, getActiveMatch, getSessionById, type Session } from '../../../lib/session'
import { requestMatch, type MatcherResult } from '../../../lib/matcher'
import { haptics } from '../../../lib/haptics'
import { ManifestBoard } from '../../../components/ManifestBoard'
import { primaryIataForCity } from '../../../lib/cities'
import { GradientBackground, GlassButton, GlassCard } from '../../../components/ui'
import type Ably from 'ably'

// The "actively searching" leaf.
//
// One source of truth: the DATABASE. Every way a match can surface converges
// on handleMatchFound(), which routes to match/room — and match/room reads the
// row from Supabase and dispatches on its real status. Three signals feed it:
//   1. the matcher's own response (fastest for the requester),
//   2. an Ably match.created push (fastest for the partner),
//   3. a 4s DB poll (guaranteed fallback — works with Ably fully down).
// Ably setup failing never blocks the search: the matcher is invoked from the
// session-load path, not the subscription path.

// 'loading' is the neutral initial state: the screen shows nothing about
// searching until the async session/match check resolves, so the "Finding
// the person…" copy never flashes before we know there's an active session.
type ScreenState = 'loading' | 'searching' | 'curiosity' | 'exhausted' | 'no-session'

const REMATCH_INTERVAL_MS = 45_000
const MATCH_POLL_MS = 4_000
const CURIOSITY_DELAY_MS = 15_000

// matched:false reasons that mean "keep waiting quietly" rather than an error.
const QUIET_REASONS = new Set([
  'no_candidates_at_airport',
  'all_candidates_filtered',
  'pool_exhausted',
  'below_threshold',
  'curiosity_requester_wait',
  'curiosity_no_waiting_candidates',
  'insert_race',
])

interface CuriosityData {
  match_id: string
  winning_signal: string | null
  flight_iata: string
  origin_iata: string
}

export default function SearchingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // When opened from a specific history card, scope the search to that session
  // instead of the current active one. Falls back to getActiveSession() for the
  // normal availability-screen entry (no param).
  const { session_id } = useLocalSearchParams<{ session_id?: string }>()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const declinedMatchIds = useRef(new Set<string>())
  const navigatedRef = useRef(false)

  // The one session resolver — honors the session_id param when present.
  const resolveSession = useCallback(
    () => (session_id ? getSessionById(session_id) : getActiveSession()),
    [session_id],
  )

  const [firstName, setFirstName] = useState('')
  const [iata, setIata] = useState('···')
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<ScreenState>('loading')
  const [curiosity, setCuriosity] = useState<CuriosityData | null>(null)
  const [matcherError, setMatcherError] = useState(false)

  // The single exit: every match signal lands here exactly once. match/room
  // re-reads the row from the DB, so a stale/foreign payload can't mis-route.
  const handleMatchFound = useCallback((matchId: string, source: 'response' | 'ably' | 'poll') => {
    if (navigatedRef.current) return
    if (declinedMatchIds.current.has(matchId)) return
    navigatedRef.current = true
    console.log(`[searching] match found via ${source}: ${matchId}`)
    router.replace({
      pathname: '/(app)/match/room',
      params: { match_id: matchId, ...(session_id ? { session_id } : {}) },
    })
  }, [router, session_id])

  // Interpret a matcher response. Returns true if it resolved the search.
  const applyMatcherResult = useCallback((result: MatcherResult): boolean => {
    if ('matched' in result && result.matched) {
      handleMatchFound(result.match_id, 'response')
      return true
    }
    if ('matched' in result && !result.matched) {
      if (result.reason === 'blocked_by_existing_match' && result.match_id) {
        // A live match already exists for this session — surface it instead
        // of searching forever behind it.
        handleMatchFound(result.match_id, 'response')
        return true
      }
      if (result.reason === 'requester_session_inactive') {
        setState('no-session')
        return true
      }
      if (QUIET_REASONS.has(result.reason)) {
        setMatcherError(false)
        setState(s => (s === 'curiosity' ? s : 'exhausted'))
      }
      return false
    }
    // Real failure — keep polling (a match made by the partner's invocation
    // still surfaces), but tell the user something is off.
    setMatcherError(true)
    return false
  }, [handleMatchFound])

  const runSearch = useCallback(async (sess: Session, opts?: { curiosity?: boolean }) => {
    const result = await requestMatch(sess, opts)
    applyMatcherResult(result)
  }, [applyMatcherResult])

  // ── Session load (also the matcher kick-off — independent of Ably) ────────
  useFocusEffect(useCallback(() => {
    let cancelled = false
    navigatedRef.current = false
    async function load() {
      const { data: { session: auth } } = await supabase.auth.getSession()
      if (!auth || cancelled) return

      const { data: profile } = await supabase
        .from('users')
        .select('first_name, base_city')
        .eq('id', auth.user.id)
        .maybeSingle()
      if (cancelled) return
      if (profile?.first_name) setFirstName(profile.first_name)
      if (profile?.base_city) setIata(primaryIataForCity(profile.base_city))

      const active = await resolveSession()
      if (cancelled) return
      if (!active) { setState('no-session'); return }

      const existing = await getActiveMatch(active.id)
      if (cancelled) return
      if (existing) {
        handleMatchFound(existing.id, 'poll')
        return
      }

      setSession(active)
      // Session confirmed active with no existing match — only now do we enter
      // the visible 'searching' state (leaving the neutral 'loading' gate).
      setState('searching')
      // First search attempt fires immediately — Ably connectivity is
      // irrelevant to this path.
      runSearch(active).catch(() => {})
    }
    load().catch(() => {})
    return () => { cancelled = true }
  }, []))

  // ── Ably: fast-notify layer only (match/room re-reads the DB) ─────────────
  useEffect(() => {
    let cancelled = false

    async function subscribe() {
      const { data: { session: auth } } = await supabase.auth.getSession()
      if (!auth || cancelled) return

      const ably = getAblyClient(auth.user.id)
      const channel = ably.channels.get(userChannelName(auth.user.id))
      channelRef.current = channel

      channel.subscribe('match.created', (msg) => {
        const { match_id } = msg.data as { match_id: string }
        handleMatchFound(match_id, 'ably')
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
    }

    subscribe().catch((e) => {
      // Push notifications are an enhancement; the DB poll below covers us.
      console.warn('[searching] Ably subscription unavailable (poll fallback active):', e?.message ?? e)
    })
    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [handleMatchFound])

  // ── Curiosity probe after 15s of quiet searching ───────────────────────────
  useEffect(() => {
    if (state !== 'searching' || !session) return
    const timer = setTimeout(() => {
      runSearch(session, { curiosity: true }).catch(() => {})
    }, CURIOSITY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, session, runSearch])

  // ── Keep searching: intentional retry loop while quiet ────────────────────
  useEffect(() => {
    if ((state !== 'searching' && state !== 'exhausted') || !session) return
    const interval = setInterval(async () => {
      try {
        const fresh = await resolveSession()
        if (!fresh) {
          setState('no-session')
          return
        }
        runSearch(fresh).catch(() => {})
      } catch { /* transient network failure — next tick retries */ }
    }, REMATCH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [state, session, runSearch, resolveSession])

  // ── DB poll: the guaranteed fallback (partner-created matches, Ably down) ─
  useEffect(() => {
    if ((state !== 'searching' && state !== 'exhausted') || !session) return
    const interval = setInterval(async () => {
      try {
        const existing = await getActiveMatch(session.id)
        if (existing) {
          clearInterval(interval)
          handleMatchFound(existing.id, 'poll')
        }
      } catch { /* transient network failure — next tick retries */ }
    }, MATCH_POLL_MS)
    return () => clearInterval(interval)
  }, [state, session, handleMatchFound])

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
    handleMatchFound(curiosity.match_id, 'ably')
  }

  if (state === 'loading') {
    // Neutral blank gate — no copy flashes before the session/match check
    // resolves. Just the background until real content populates.
    return <View style={[styles.container, { paddingTop: insets.top + 14 }]} />
  }

  if (state === 'no-session') {
    return (
      <GradientBackground>
        <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
          <View style={styles.body}>
            <Text style={[type.headline, styles.headline]}>You're not in a session.</Text>
            <GlassButton
              label="START A SESSION"
              variant="primary"
              fullWidth={false}
              onPress={() => router.replace('/(app)/flight')}
              style={styles.startBtn}
            />
          </View>
        </View>
      </GradientBackground>
    )
  }

  const headline =
    state === 'exhausted' ? 'We looked, nobody yet.'
      : state === 'curiosity' ? 'Be open to someone unexpected.'
      : "Finding the person you would've walked past."

  return (
    <GradientBackground>
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{headline}</Text>

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName={firstName || 'YOU'}
            iata={iata}
            flightIata={session?.flight_iata ?? null}
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

        {matcherError ? (
          <Text style={styles.errorLine}>
            Trouble reaching the matcher. Still checking for matches.
          </Text>
        ) : null}

        {state === 'curiosity' && curiosity ? (
          <GlassCard rounded="lg" tint="lilac" style={styles.curiosityPanel}>
            <Text style={[type.subhead, styles.curiosityLine]}>
              Not your criteria — could still be worth it.
            </Text>
            <View style={styles.curiosityActions}>
              <GlassButton
                label="I'M IN"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={openMatch}
                style={styles.meetBtn}
              />
              <GlassButton
                label="KEEP WAITING"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={dismissCuriosity}
              />
            </View>
          </GlassCard>
        ) : null}
      </View>
    </View>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 24 },
  eyebrow: { color: colors.subtle },
  body: { flex: 1, justifyContent: 'center', gap: 20 },
  headline: { color: colors.text },
  boardWrap: { marginTop: 8 },
  startBtn: { marginTop: 20, alignSelf: 'flex-start' },
  errorLine: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.subtle,
  },
  curiosityPanel: { marginTop: 8, gap: 14 },
  curiosityLine: { color: colors.text },
  curiosityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meetBtn: { flex: 1 },
})
