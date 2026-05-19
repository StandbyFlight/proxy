import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { ManifestBoard } from '../../components/ManifestBoard'
import { InputFlipCell } from '../../components/InputFlipCell'
import { primaryIataForCity } from '../../lib/cities'

// Status hub. Reads state on focus; renders pills/CTAs that link out, never
// auto-redirects. Per group_plan §"index (Home)":
//   no session   → "Start a session" CTA → /(app)/flight
//   active session, no match → session pill → /(app)/match/searching
//   active match → match pill → /(app)/match/room
// All listener / matcher logic lives on /(app)/match/searching now.

type SessionInfo = {
  id: string
  flightIata: string | null
  originIata: string | null
}

type MatchInfo = {
  id: string
  status: string
  iAccepted: boolean
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [firstName, setFirstName] = useState('')
  const [iata, setIata] = useState('···')
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null)
  const [activeMatch, setActiveMatch] = useState<MatchInfo | null>(null)
  const [loaded, setLoaded] = useState(false)

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
      const { data: sess } = await supabase
        .from('sessions')
        .select('id, origin_iata, flights(flight_iata)')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      let nextSession: SessionInfo | null = null
      let nextMatch: MatchInfo | null = null

      if (sess) {
        const fl = sess.flights as { flight_iata: string } | { flight_iata: string }[] | null
        const fIata = Array.isArray(fl) ? fl[0]?.flight_iata : fl?.flight_iata
        nextSession = {
          id: sess.id,
          flightIata: fIata ?? null,
          originIata: (sess as { origin_iata?: string }).origin_iata ?? null,
        }

        const { data: match } = await supabase
          .from('matches')
          .select('id, status, session_id_a')
          .or(`session_id_a.eq.${sess.id},session_id_b.eq.${sess.id}`)
          .in('status', ['pending', 'pending_a', 'pending_b', 'mutual'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (match) {
          const iAmA = match.session_id_a === sess.id
          const iAccepted =
            match.status === 'mutual' ||
            (iAmA && match.status === 'pending_b') ||
            (!iAmA && match.status === 'pending_a')
          nextMatch = { id: match.id, status: match.status, iAccepted }
        }
      }

      if (cancelled) return
      setActiveSession(nextSession)
      setActiveMatch(nextMatch)
      setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, []))

  function startSession() {
    haptics.buttonTap()
    router.push('/(app)/flight')
  }

  function openMatch() {
    if (!activeMatch) return
    haptics.buttonTap()
    router.push({ pathname: '/(app)/match/room', params: { match_id: activeMatch.id } })
  }

  function openSearching() {
    haptics.buttonTap()
    router.push('/(app)/match/searching')
  }

  function openProfile() {
    haptics.buttonTap()
    router.push('/(app)/profile')
  }

  // Render branches: keep them flat so the state machine is readable at a glance.
  const showCTA = loaded && !activeSession
  const showSessionPill = loaded && activeSession && !activeMatch
  const showMatchPill = loaded && activeMatch

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <View style={styles.eyebrowWrap}>
          <Text style={[type.eyebrow, styles.eyebrow]}>STANDBY · HOME</Text>
        </View>
        <Pressable
          onPress={openProfile}
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

      <View style={styles.body}>
        {showCTA ? (
          <>
            <Text style={[type.headline, styles.headline]}>
              Sit down across from a stranger.
            </Text>
            <Text style={[type.subhead, styles.subhead]}>
              Add the flight you're catching today and we'll find someone in your terminal worth your forty-five minutes.
            </Text>
          </>
        ) : showMatchPill && activeMatch ? (
          <>
            <Text style={[type.headline, styles.headline]}>
              {activeMatch.status === 'mutual' ? "You're both in." : "Someone said yes."}
            </Text>
            <Text style={[type.subhead, styles.subhead]}>
              {activeMatch.status === 'mutual'
                ? "Pick a time and a place. They're waiting on you."
                : activeMatch.iAccepted
                  ? "Waiting for the other side. We'll surface the moment it lands."
                  : "Open the card and decide."}
            </Text>
          </>
        ) : showSessionPill && activeSession ? (
          <>
            <Text style={[type.headline, styles.headline]}>
              Listening at the gate.
            </Text>
            <Text style={[type.subhead, styles.subhead]}>
              Your session is live. We're scanning your terminal cluster. Open Searching to watch it happen.
            </Text>
          </>
        ) : null}

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName={firstName || 'YOU'}
            iata={activeSession?.originIata?.toUpperCase() || iata}
            flightIata={activeSession?.flightIata ?? null}
            mode="static"
            status="standby"
            stranger={null}
          />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {showCTA ? (
          <Pressable
            onPress={startSession}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.triangleOnRed}>{'▶'}</Text>
            <Text style={styles.primaryBtnText}>START A SESSION</Text>
          </Pressable>
        ) : showMatchPill && activeMatch ? (
          <Pressable
            onPress={openMatch}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.triangleOnRed}>{'▶'}</Text>
            <Text style={styles.primaryBtnText}>
              {activeMatch.status === 'mutual'
                ? 'OPEN MEETUP'
                : activeMatch.iAccepted ? 'MATCH PENDING' : 'OPEN MATCH'}
            </Text>
          </Pressable>
        ) : showSessionPill ? (
          <View style={styles.pillStack}>
            <Pressable
              onPress={openSearching}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.triangleOnRed}>{'▶'}</Text>
              <Text style={styles.primaryBtnText}>OPEN SEARCHING</Text>
            </Pressable>
            <Pressable
              onPress={startSession}
              hitSlop={14}
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.5 }]}
            >
              <Text style={styles.ghostText}>CHANGE FLIGHT</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
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

  footer: {
    paddingTop: 12,
    gap: 12,
  },
  pillStack: { gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
  ghostBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  ghostText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
})
