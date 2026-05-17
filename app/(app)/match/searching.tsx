import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, userChannelName } from '../../../lib/ably'
import { FlipBoard } from '../../../components/FlipBoard'
import type Ably from 'ably'

// Standalone waiting screen, listening for `match.created` and `curiosity.match`.
// This is the screen behind the Match tab when the user has signaled availability
// but no candidate has been surfaced yet. Pool-empty and active-match states
// re-route — this screen is only the "actively looking" leaf.

type ScreenState = 'searching' | 'no-session' | 'pool-empty'

export default function SearchingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const [state, setState] = useState<ScreenState>('searching')
  const [clockLabel, setClockLabel] = useState(formatClock(new Date()))

  useEffect(() => {
    const id = setInterval(() => setClockLabel(formatClock(new Date())), 30_000)
    return () => clearInterval(id)
  }, [])

  // Gate on having an active session — match/searching only makes sense after
  // session creation. If there's a live match already, deep-link to /match/room.
  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function gate() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

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
      if (cancelled) return

      if (!activeSession) { setState('no-session'); return }

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
      }
    }
    gate()
    return () => { cancelled = true }
  }, []))

  // Subscribe for match.created — the moment the matcher writes our row.
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
      })
      channel.subscribe('pool.exhausted', () => setState('pool-empty'))
    }
    subscribe()
    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const eyebrow =
    state === 'pool-empty' ? `THE GATE · ${clockLabel}`
      : state === 'no-session' ? 'NO ACTIVE SESSION'
      : `LISTENING · ${clockLabel}`

  const headline =
    state === 'pool-empty' ? "We looked. Nobody yet."
      : state === 'no-session' ? "You're not in a session."
      : "Looking for one good reason."

  const subhead =
    state === 'pool-empty'
      ? "No travelers within reach right now. More usually show up as departure approaches — leave this screen on."
      : state === 'no-session'
        ? "Start a session from the Session tab and we'll surface someone here when there's a fit."
        : "We're scanning everyone in your terminal cluster with overlapping time. You'll know the moment we find someone."

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.boardWrap}>
          <FlipBoard
            label={state === 'pool-empty' ? 'STANDBY' : 'SEARCHING'}
            cellSize={28}
            initialFlipMs={700}
            staggerMs={90}
          />
        </View>

        <Text style={[type.headline, styles.headline]}>{headline}</Text>
        <Text style={[type.subhead, styles.subhead]}>{subhead}</Text>

        <Text style={styles.privacyNote}>
          NO NAMES SHARED · NOTHING REVEALED UNTIL YOU BOTH SAY YES.
        </Text>
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
  boardWrap: { alignItems: 'center', marginBottom: 12 },
  headline: { color: colors.text },
  subhead: { color: colors.subtle },
  privacyNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginTop: 16,
  },
})
