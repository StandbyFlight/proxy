import { Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'

// The one back-navigation component. Every screen uses this — no bespoke back
// buttons. Falls back to `fallback` when there's no stack to pop.

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
      accessibilityLabel="Go back"
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.5 }]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
})
