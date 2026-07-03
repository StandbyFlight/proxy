import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../lib/theme'
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
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.5 }]}
    >
      <View style={styles.triangle} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  // A thin left-pointing (backwards) triangle drawn from borders.
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.text,
  },
})
