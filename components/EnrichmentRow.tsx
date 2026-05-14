import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, Animated, Easing, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors } from '../lib/theme'
import { fonts, type } from '../lib/typography'

const BOARD_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'Menlo, Consolas, monospace',
}) as string

export type EnrichmentState = 'idle' | 'connecting' | 'connected' | 'coming_soon'

const CELL_SIZE = 36
const CELL_WIDTH = 28

// Single-cell flip toggle used in the enrichment list.
// Renders a small flip cell on the left, a provider label, a tagline, and
// a status indicator on the right. Tapping triggers the parent's onPress
// (which decides whether to OAuth or show a "coming soon" inline note).
export function EnrichmentRow({
  provider,
  tagline,
  state,
  onPress,
  note,
}: {
  provider: string
  tagline: string
  state: EnrichmentState
  onPress: () => void
  note?: string
}) {
  const scaleY = useRef(new Animated.Value(1)).current
  const [glyph, setGlyph] = useState(state === 'connected' ? '✓' : '─')

  // Animate flip when state crosses idle <-> connected.
  useEffect(() => {
    const next = state === 'connected' ? '✓' : '─'
    if (next === glyph) return
    Animated.timing(scaleY, {
      toValue: 0,
      duration: 75,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setGlyph(next)
      Animated.timing(scaleY, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    })
  }, [state])

  const handlePress = () => {
    if (state === 'connecting') return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onPress()
  }

  const statusText =
    state === 'connecting' ? 'connecting…' :
    state === 'connected' ? 'connected' :
    state === 'coming_soon' ? 'coming soon' :
    ''

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
    >
      <View style={styles.cell}>
        <Animated.View style={{ transform: [{ scaleY }] }}>
          <Text
            style={[
              styles.cellChar,
              state === 'connected' && styles.cellCharOn,
              state !== 'connected' && styles.cellCharDim,
            ]}
          >
            {glyph}
          </Text>
        </Animated.View>
        <View style={styles.seam} />
      </View>

      <View style={styles.label}>
        <Text style={styles.provider}>{provider}</Text>
        <Text style={styles.tagline} numberOfLines={1}>{tagline}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>

      <Text style={[
        styles.status,
        state === 'connected' && styles.statusOn,
        state === 'connecting' && styles.statusGoing,
      ]}>
        {statusText}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  cell: {
    width: CELL_WIDTH,
    height: CELL_SIZE,
    backgroundColor: colors.board,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 2,
  },
  cellChar: {
    fontFamily: BOARD_FONT,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  cellCharDim: { color: colors.boardText, opacity: 0.35 },
  cellCharOn: { color: colors.accent, opacity: 1 },
  seam: {
    position: 'absolute',
    left: 0, right: 0,
    top: Math.round(CELL_SIZE * 0.48),
    height: 1,
    backgroundColor: colors.boardSeam,
  },
  label: { flex: 1, gap: 2 },
  provider: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  tagline: {
    ...type.bodyItalic,
    fontSize: 14,
    color: colors.subtle,
  },
  note: {
    ...type.bodyItalic,
    fontSize: 12,
    color: colors.subtle,
    marginTop: 4,
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.subtle,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusOn: { color: colors.accent },
  statusGoing: { color: colors.text },
})
