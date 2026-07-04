import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'
import { openFeedback } from '../lib/demo'

// Feedback affordance for demo screens. `openFeedback` already emits the
// demo_feedback_clicked event and handles the URL-or-alert fallback, so this is
// just the tap surface. Two looks: a ghost text link (default) and a black
// outlined button matching the app's secondary action buttons.

export function FeedbackButton({
  variant = 'link',
  label = 'SEND FEEDBACK',
  style,
}: {
  variant?: 'link' | 'button'
  label?: string
  style?: StyleProp<ViewStyle>
} = {}) {
  function onPress() {
    haptics.selection()
    openFeedback()
  }

  if (variant === 'button') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }, style]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.5 }, style]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.surface,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.black,
  },
})
