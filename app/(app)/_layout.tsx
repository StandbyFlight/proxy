import { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Slot, usePathname, useFocusEffect } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { getActiveSession, getActiveMatch } from '../../lib/session'
import { BottomNav } from '../../components/BottomNav'

// Routes that own the whole screen and should not show the nav bar.
// Back gestures are disabled on the decision card and post-meetup; the
// persistent nav would defeat the same intent. Exact match only (no prefix),
// to avoid hiding it on sibling routes like /match/searching.
const FULLSCREEN_EXACT = new Set([
  '/(app)/match',           // flat match.tsx — the decision card
  '/(app)/post-meetup',
])

function shouldHideNav(pathname: string): boolean {
  return FULLSCREEN_EXACT.has(pathname)
}

export default function AppLayout() {
  const pathname = usePathname()
  const [badges, setBadges] = useState<{
    match?: number
    profile?: 'dot'
  }>({})
  const [navState, setNavState] = useState<{
    activeMatchId: string | null
  }>({ activeMatchId: null })

  // Refresh badges + smart-route state on every route change. Light queries
  // and worth it for the consistency: tab destinations always match reality.
  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function loadState() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const [activeSession, { data: profile }] = await Promise.all([
        getActiveSession(),
        supabase
          .from('users')
          .select('first_name, age, base_city, current_thinking, school, hometown, career_stage, travel_style')
          .eq('id', session.user.id)
          .maybeSingle(),
      ])
      if (cancelled) return

      const activeMatch = activeSession ? await getActiveMatch(activeSession.id) : null
      if (cancelled) return

      // Profile completeness: 8 stable signals counted; "complete" = ≥ 80%.
      const fields = [
        profile?.first_name, profile?.age, profile?.base_city, profile?.current_thinking,
        profile?.school, profile?.hometown, profile?.career_stage, profile?.travel_style,
      ]
      const filled = fields.filter(v => v != null && v !== '').length
      const profileComplete = filled / fields.length >= 0.8

      setBadges({
        match: activeMatch ? 1 : undefined,
        profile: profileComplete ? undefined : 'dot',
      })
      setNavState({ activeMatchId: activeMatch?.id ?? null })
    }
    loadState().catch(() => {})
    return () => { cancelled = true }
  }, [pathname]))

  const hideNav = shouldHideNav(pathname)

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <Slot />
      </View>
      {hideNav ? null : <BottomNav badges={badges} navState={navState} />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
})
