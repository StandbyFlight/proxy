import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { FlipBoard } from '../../../components/FlipBoard'

// Group forming screen. Group mode is MVP-deferred per app_plan §20, but the
// navigation contract exists per group_plan §"group/forming". Today the screen
// shows an honest "table is being set" state — same chrome that will host live
// member-count updates from Ably once the backend ships.

export default function GroupForming() {
  const { event_name, origin_iata } = useLocalSearchParams<{
    event_name?: string
    origin_iata?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [count, setCount] = useState(1)

  // Placeholder tick that nudges the count up so the screen feels alive while
  // we wait on real group backend. Caps at 3 of 8 to avoid implying we have
  // matches we don't.
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => (c < 3 ? c + 1 : c))
    }, 12_000)
    return () => clearInterval(id)
  }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={[type.eyebrow, styles.eyebrow]}>GROUP · FORMING</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.subhead, styles.subhead]}>Setting the table.</Text>

        <View style={styles.boardWrap}>
          <FlipBoard
            label={`${count} OF 8`}
            cellSize={28}
            initialFlipMs={500}
            staggerMs={120}
          />
        </View>

        {event_name ? (
          <Text style={[type.headline, styles.headline]}>{event_name}</Text>
        ) : (
          <Text style={[type.headline, styles.headline]}>A small group, same place.</Text>
        )}
        {origin_iata ? (
          <Text style={styles.tag}>{origin_iata}  ·  HEADED THE SAME WAY</Text>
        ) : null}

        <Text style={[type.subhead, styles.body2]}>
          When at least four of you are in, we'll lock the table and reveal first names. Anyone who joins after fills an empty seat or kicks off a second table.
        </Text>

        <View style={styles.placeholderBlock}>
          <Text style={styles.placeholderLabel}>HEADS UP</Text>
          <Text style={styles.placeholderBody}>
            Group mode is still being seated. Solo matches are live, and you'll get a push the moment your table fills.
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  body: { flex: 1, gap: 18, paddingTop: 12 },
  subhead: { color: colors.subtle },
  boardWrap: { alignItems: 'flex-start', marginVertical: 12 },
  headline: { color: colors.text },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  body2: { color: colors.text },

  placeholderBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 14,
    marginTop: 8,
    gap: 6,
  },
  placeholderLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  placeholderBody: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
  },
})
