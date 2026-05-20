import { useCallback, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Slot, usePathname } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { BottomNav } from '../../components/BottomNav'

// Routes that own the whole screen and should not show the nav bar.
// Per group_plan §"Global Navigation Rules" back gestures are disabled on
// match/card, match/mutual, group/join, group/room, post-meetup/confirm — the
// persistent nav would defeat the same intent, so we hide it on those screens
// too. Exact match only (no prefix), to avoid hiding it on sibling routes like
// /match/searching or /group/searching.
const FULLSCREEN_EXACT = new Set([
  '/(app)/match',           // flat match.tsx — the decision card
  '/(app)/match/mutual',
  '/(app)/group/join',
  '/(app)/group/room',
  '/(app)/post-meetup',     // flat post-meetup.tsx
])

function shouldHideNav(pathname: string): boolean {
  return FULLSCREEN_EXACT.has(pathname)
}

export default function AppLayout() {
  const pathname = usePathname()
  const [badges, setBadges] = useState<{
    session?: 'dot'
    match?: number
    profile?: 'dot'
  }>({})
  const [navState, setNavState] = useState<{
    hasActiveSession: boolean
    activeMatchId: string | null
  }>({ hasActiveSession: false, activeMatchId: null })

  // Refresh badges + smart-route state on every route change. Light queries
  // and worth it for the consistency: tab destinations always match reality.
  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function loadState() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const nowIso = new Date().toISOString()
      const [{ data: activeSession }, { data: profile }] = await Promise.all([
        supabase
          .from('sessions')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('users')
          .select('first_name, age, base_city, current_thinking, school, hometown, career_stage, travel_style')
          .eq('id', session.user.id)
          .maybeSingle(),
      ])
      if (cancelled) return

      let activeMatchId: string | null = null
      let pendingMatchCount = 0
      if (activeSession?.id) {
        const { data: matchRow, count } = await supabase
          .from('matches')
          .select('id', { count: 'exact' })
          .or(`session_id_a.eq.${activeSession.id},session_id_b.eq.${activeSession.id}`)
          .in('status', ['pending', 'pending_a', 'pending_b', 'mutual'])
          .order('created_at', { ascending: false })
          .limit(1)
        if (matchRow && matchRow.length > 0) activeMatchId = matchRow[0].id
        pendingMatchCount = count ?? 0
      }
      if (cancelled) return

      // Profile completeness: 8 stable signals counted; "complete" = ≥ 80%.
      const fields = [
        profile?.first_name, profile?.age, profile?.base_city, profile?.current_thinking,
        profile?.school, profile?.hometown, profile?.career_stage, profile?.travel_style,
      ]
      const filled = fields.filter(v => v != null && v !== '').length
      const profileComplete = filled / fields.length >= 0.8

      setBadges({
        session: activeSession ? undefined : 'dot',
        match: pendingMatchCount > 0 ? pendingMatchCount : undefined,
        profile: profileComplete ? undefined : 'dot',
      })
      setNavState({
        hasActiveSession: !!activeSession,
        activeMatchId,
      })
    }
    loadState()
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
