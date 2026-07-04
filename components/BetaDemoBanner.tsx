import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { isDemoMode, DEMO_BANNER_COPY } from '../lib/demo'

// Slim, self-gating banner shown on demo screens. Renders nothing outside demo
// mode, so it's safe to drop onto any screen unconditionally. Frames the demo
// as intentional — a preview, never "broken".

export function BetaDemoBanner({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  if (!isDemoMode()) return null

  return (
    <View style={[styles.bar, style]}>
      <View style={styles.chip}>
        <Text style={styles.chipText}>DEMO</Text>
      </View>
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
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(122,165,200,0.45)',
    backgroundColor: 'rgba(122,165,200,0.14)',
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  chipText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.onAccent,
  },
  copy: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0.2,
    color: colors.subtle,
  },
})
