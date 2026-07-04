import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { getActiveSession, getActiveMatch, type Session, type MatchSummary } from '../../lib/session'
import { ManifestBoard } from '../../components/ManifestBoard'
import { primaryIataForCity } from '../../lib/cities'
import { isDemoMode, trackDemo } from '../../lib/demo'
import { BetaDemoBanner } from '../../components/BetaDemoBanner'

// Home has one job: the current live travel session and its status.
//   no session   → "Start a session" CTA → /(app)/flight
//   active session, no match → status + link to searching
//   active match → link to the match
// Destination (not origin) is the primary status info on the board.

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [firstName, setFirstName] = useState('')
  const [baseIata, setBaseIata] = useState('···')
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [activeMatch, setActiveMatch] = useState<MatchSummary | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Demo analytics: fire once when home first mounts in demo mode. Inert (and
  // trackDemo itself no-ops) when demo mode is off.
  useEffect(() => {
    if (isDemoMode()) trackDemo('demo_app_opened')
  }, [])

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      // Profile and active-session are independent — fetch them concurrently
      // instead of serially so the board paints a full round-trip sooner.
      const [profileRes, sess] = await Promise.all([
        supabase
          .from('users')
          .select('first_name, base_city')
          .eq('id', session.user.id)
          .maybeSingle(),
        getActiveSession(),
      ])
      if (cancelled) return
      const profile = profileRes.data
      if (profile?.first_name) setFirstName(profile.first_name)
      if (profile?.base_city) setBaseIata(primaryIataForCity(profile.base_city))

      const match = sess ? await getActiveMatch(sess.id) : null
      if (cancelled) return

      setActiveSession(sess)
      setActiveMatch(match)
      setLoaded(true)
    }
    load().catch(() => {})
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

  const showCTA = loaded && !activeSession
  const showSession = loaded && activeSession && !activeMatch
  const showMatch = loaded && activeMatch

  // Blank gate — hold the whole screen empty until every piece (profile, board
  // data, buttons) is ready, so it all paints in one shot rather than the board
  // appearing first and the text/buttons popping in after.
  if (!loaded) {
    return <View style={[styles.container, { paddingTop: insets.top + 14 }]} />
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <BetaDemoBanner />
      <View style={styles.body}>
        {showCTA ? (
          <Text style={[type.headline, styles.headline]}>
            Sit down across from a stranger.
          </Text>
        ) : showMatch && activeMatch ? (
          <Text style={[type.headline, styles.headline]}>
            {activeMatch.status === 'mutual'
              ? "You're both in."
              : activeMatch.iAccepted ? 'Waiting on them.' : 'Someone said yes.'}
          </Text>
        ) : showSession && activeSession ? (
          <Text style={[type.headline, styles.headline]}>On standby.</Text>
        ) : null}

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName={firstName || 'YOU'}
            iata={activeSession?.destination_iata?.toUpperCase() || baseIata}
            iataLabel={activeSession?.destination_iata ? 'TO' : 'BASE'}
            flightIata={activeSession?.flight_iata ?? null}
            mode="populate"
            status="none"
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
            <Text style={styles.primaryBtnText}>START A SESSION</Text>
          </Pressable>
        ) : showMatch && activeMatch ? (
          <Pressable
            onPress={openMatch}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>
              {activeMatch.status === 'mutual' ? 'OPEN MEETUP' : 'OPEN MATCH'}
            </Text>
          </Pressable>
        ) : showSession ? (
          <View style={styles.pillStack}>
            <Pressable
              onPress={openSearching}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
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
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  headline: { color: colors.text },
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
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  ghostBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  ghostText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
})
