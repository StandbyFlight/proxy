import { View, Text, Pressable, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, usePathname } from 'expo-router'
import { colors, blur } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'
import { normalizePathname } from '../lib/routes'

// Bottom navigation — icon + short label per tab (never icon-only).
//   Home    — the current live session and nothing else
//   History — all past and upcoming travel sessions
//   Match   — the single active match (deep-links to its current state)
//   Events  — events browser
//   Profile — read-only pass

type TabKey = 'home' | 'history' | 'match' | 'events' | 'profile'

type Tab = {
  key: TabKey
  icon: string
  label: string
}

const TABS: Tab[] = [
  { key: 'home',    icon: '⌂', label: 'HOME' },
  { key: 'history', icon: '≡', label: 'HISTORY' },
  { key: 'match',   icon: '◉', label: 'MATCH' },
  { key: 'events',  icon: '✦', label: 'EVENTS' },
  { key: 'profile', icon: '◐', label: 'PROFILE' },
]

type Badges = Partial<Record<TabKey, number | 'dot'>>

type NavState = {
  activeMatchId: string | null
}

function hrefForTab(tab: TabKey, state: NavState): string {
  switch (tab) {
    case 'home': return '/(app)/'
    case 'history': return '/(app)/history'
    case 'events': return '/(app)/events'
    case 'profile': return '/(app)/profile'
    case 'match':
      return state.activeMatchId
        ? `/(app)/match/room?match_id=${state.activeMatchId}`
        : '/(app)/match/searching'
  }
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
  // Runtime pathnames carry no route groups: "/match/searching", not
  // "/(app)/match/searching". Compare against real paths only.
  const pathname = normalizePathname(usePathname())
  const state: NavState = navState ?? { activeMatchId: null }

  function isActive(tab: Tab): boolean {
    switch (tab.key) {
      case 'home':
        // Session setup screens belong to starting the live session → Home.
        return pathname === '/' || pathname === '/flight' || pathname === '/intent' ||
          pathname.startsWith('/session')
      case 'history': return pathname.startsWith('/history')
      case 'match': return pathname.startsWith('/match')
      case 'events': return pathname.startsWith('/events')
      case 'profile':
        return pathname.startsWith('/profile') || pathname === '/settings'
    }
  }

  function go(tab: Tab) {
    haptics.selection()
    router.push(hrefForTab(tab.key, state) as never)
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <BlurView intensity={blur.panel} tint={blur.tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.fill]} pointerEvents="none" />
      <View style={styles.topBorder} pointerEvents="none" />
      <View style={styles.row}>
        {TABS.map(tab => {
          const active = isActive(tab)
          const badge = badges?.[tab.key]
          return (
            <Pressable
              key={tab.key}
              onPress={() => go(tab)}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.iconRow}>
                <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
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
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  // Solid white fill — the bar reads as a clean, fully-white panel (no
  // off-white translucency showing the content behind it).
  fill: {
    backgroundColor: colors.white,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.borderGlass,
  },
  row: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 3,
  },
  iconRow: {
    flexDirection: 'row',
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.subtle,
    includeFontPadding: false,
    textAlign: 'center',
  },
  iconActive: { color: colors.accent },
  label: {
    fontFamily: fonts.elmsSans.regular,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.0,
    color: colors.subtle,
    textAlign: 'center',
  },
  // The tab you're on renders fully in the accent so it's unmistakable.
  labelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  numberBadge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeText: {
    fontFamily: fonts.elmsSans.bold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.onAccent,
  },
})
