import { View, StyleSheet } from 'react-native'

// Hand-built monochrome outline glyphs drawn from plain RN primitives — the app
// ships no icon library. Kept intentionally minimal to match the clean outline
// aesthetic. Each takes a color so it can inherit the surrounding label color.

export function MapPinGlyph({ color, size = 18 }: { color: string; size?: number }) {
  const head = Math.round(size * 0.72)
  return (
    <View style={[styles.glyphBox, { width: size, height: size }]}>
      {/* Teardrop head: three rounded corners + one sharp, rotated so the
          sharp corner points straight down. */}
      <View
        style={{
          width: head,
          height: head,
          borderWidth: 2,
          borderColor: color,
          borderTopLeftRadius: head,
          borderTopRightRadius: head,
          borderBottomLeftRadius: head,
          borderBottomRightRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
      {/* Center dot, overlaid on the (unrotated) container so it stays centered. */}
      <View
        style={[
          styles.pinDot,
          { backgroundColor: color, top: Math.round(size * 0.3) },
        ]}
      />
    </View>
  )
}

export function MessageGlyph({ color, size = 18 }: { color: string; size?: number }) {
  const w = Math.round(size * 0.92)
  const h = Math.round(size * 0.68)
  const tail = Math.round(size * 0.28)
  return (
    <View style={[styles.glyphBox, { width: size, height: size }]}>
      <View
        style={{
          width: w,
          height: h,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 4,
        }}
      />
      {/* Small tail nub at the bottom-left of the bubble. */}
      <View
        style={{
          position: 'absolute',
          bottom: Math.round((size - h) / 2) - tail + 3,
          left: Math.round((size - w) / 2) + 2,
          width: 0,
          height: 0,
          borderLeftWidth: tail / 2,
          borderRightWidth: tail / 2,
          borderTopWidth: tail,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  glyphBox: { alignItems: 'center', justifyContent: 'center' },
  pinDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
})
