import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, usePathname } from 'expo-router'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'

// The five tabs from group_plan.md §"Bottom Nav".
// Match tab deep-links to /match/room when an active match exists; otherwise
// it falls back to /match/searching. The router is the single source of truth
// for which sub-screen renders — those screens handle their own redirects.
type TabKey = 'home' | 'session' | 'match' | 'events' | 'profile'

type Tab = {
  key: TabKey
  label: string
  // A pathname prefix that means "this tab is active". Tap deep-links inside
  // a tab keep the right one highlighted (e.g. /(app)/session/location lights
  // up Session).
  matchPrefix: string
}

const TABS: Tab[] = [
  { key: 'home',    label: 'HOME',    matchPrefix: '/(app)' },
  { key: 'session', label: 'SESSION', matchPrefix: '/(app)/session' },
  { key: 'match',   label: 'MATCH',   matchPrefix: '/(app)/match' },
  { key: 'events',  label: 'EVENTS',  matchPrefix: '/(app)/events' },
  { key: 'profile', label: 'PROFILE', matchPrefix: '/(app)/profile' },
]

type Badges = Partial<Record<TabKey, number | 'dot'>>

type NavState = {
  hasActiveSession: boolean
  activeMatchId: string | null
}

// Smart-routing: Session and Match converge once a session exists, because
// "manage my session" and "look at my match" are the same activity at that
// point. With no session, Session is the entry to flight setup and Match
// hands the user off to start one.
function hrefForTab(tab: TabKey, state: NavState): string {
  if (tab === 'home')    return '/(app)/'
  if (tab === 'events')  return '/(app)/events'
  if (tab === 'profile') return '/(app)/profile'
  if (tab === 'session') return state.hasActiveSession ? '/(app)/match/searching' : '/(app)/flight'
  if (tab === 'match') {
    if (state.activeMatchId) return `/(app)/match/room?match_id=${state.activeMatchId}`
    return '/(app)/match/searching'
  }
  return '/(app)/'
}

export function BottomNav({
  badges,
  navState,
}: {
  badges?: Badges
  navState?: NavState
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
  const state: NavState = navState ?? { hasActiveSession: false, activeMatchId: null }

  // Home tab is exclusively the root — anything deeper belongs to its sub-stack.
  function isActive(tab: Tab): boolean {
    if (tab.key === 'home') return pathname === '/' || pathname === '/(app)' || pathname === '/(app)/'
    // session sub-stack: legacy flat /flight and /intent also count
    if (tab.key === 'session') {
      return pathname.startsWith('/(app)/session') ||
        pathname === '/(app)/flight' ||
        pathname === '/(app)/intent'
    }
    if (tab.key === 'profile') {
      return pathname.startsWith('/(app)/profile') || pathname === '/(app)/settings'
    }
    return pathname.startsWith(tab.matchPrefix)
  }

  function go(tab: Tab) {
    haptics.selection()
    router.push(hrefForTab(tab.key, state) as never)
  }

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.rule} />
      <View style={styles.row}>
        {TABS.map(tab => {
          const active = isActive(tab)
          const badge = badges?.[tab.key]
          return (
            <Pressable
              key={tab.key}
              onPress={() => go(tab)}
              hitSlop={6}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.labelRow}>
                <Text style={[styles.label, active && styles.labelActive]}>
                  {tab.label}
                </Text>
                {badge === 'dot' ? (
                  <View style={styles.dot} />
                ) : typeof badge === 'number' && badge > 0 ? (
                  <View style={styles.numberBadge}>
                    <Text style={styles.numberBadgeText}>
                      {badge > 9 ? '9+' : String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {active ? <View style={styles.underline} /> : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,10,0.18)',
  },
  row: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  underline: {
    height: 2,
    width: 18,
    backgroundColor: colors.accent,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  numberBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.bg,
  },
})
