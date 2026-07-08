import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors, radius, spacing } from '../lib/theme'
import { type } from '../lib/typography'
import { Badge } from './ui'
import { isDemoMode, DEMO_BANNER_COPY } from '../lib/demo'

// Slim, self-gating banner shown on demo screens. Renders nothing outside demo
// mode, so it's safe to drop onto any screen unconditionally. Frames the demo
// as intentional — a preview, never "broken".

export function BetaDemoBanner({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  if (!isDemoMode()) return null

  return (
    <View style={[styles.bar, style]}>
      <Badge tone="sky" label="DEMO" />
      <Text style={styles.copy} numberOfLines={3}>
        {DEMO_BANNER_COPY}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(151,208,227,0.5)',
    backgroundColor: colors.glassSky,
  },
  copy: {
    ...type.caption,
    flex: 1,
    color: colors.textSecondary,
  },
})
