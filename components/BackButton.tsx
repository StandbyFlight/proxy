import { View, Pressable, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'
import { colors, radius, blur, shadow } from '../lib/theme'
import { haptics } from '../lib/haptics'

// The one back-navigation component. Every screen uses this — no bespoke back
// buttons. Renders a thin left-pointing (backwards) triangle. Falls back to
// `fallback` when there's no stack to pop. `label` is kept for accessibility.

export function BackButton({
  label = 'BACK',
  fallback = '/(app)/',
  onPress,
}: {
  label?: string
  fallback?: string
  onPress?: () => void
}) {
  const router = useRouter()

  function goBack() {
    haptics.buttonTap()
    if (onPress) { onPress(); return }
    if (router.canGoBack()) router.back()
    else router.replace(fallback as never)
  }

  return (
    <Pressable
      onPress={goBack}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label === 'BACK' ? 'Go back' : label}
      style={({ pressed }) => [
        styles.btn,
        shadow.sm,
        pressed && { opacity: 0.6, transform: [{ scale: 0.96 }] },
      ]}
    >
      <BlurView intensity={blur.subtle} tint={blur.tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.fill]} />
      <View style={styles.border} pointerEvents="none" />
      <View style={styles.triangle} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // A frosted glass circle holding the back glyph.
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    backgroundColor: colors.glassWhite,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
  },
  // A thin left-pointing (backwards) triangle drawn from borders.
  triangle: {
    width: 0,
    height: 0,
    marginLeft: -2,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.text,
  },
})
