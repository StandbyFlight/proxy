import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors } from '../lib/theme'
import { type } from '../lib/typography'
import { haptics } from '../lib/haptics'
import { openFeedback } from '../lib/demo'
import { GlassButton } from './ui'

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
      <GlassButton
        label={label}
        onPress={onPress}
        variant="secondary"
        haptic={false}
        accessibilityLabel={label}
        style={style}
      />
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
    ...type.label,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
})
