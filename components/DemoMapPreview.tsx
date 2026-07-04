import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

// Pure React-Native stand-in for a live map, used only in the demo meetup
// screen. No map SDK, no Mapbox, no native deps — a stylized "you → spot" route
// with a walking-time badge. Deliberately static and non-interactive; the
// PREVIEW tag makes clear it isn't a real map.

export function DemoMapPreview({
  spotName,
  nearGate,
  walkingMinutes,
  terminal,
  style,
}: {
  spotName: string
  nearGate: string
  walkingMinutes: number
  terminal: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.card, style]}>
      {/* Top chrome: preview tag + terminal context */}
      <View style={styles.header}>
        <View style={styles.previewTag}>
          <Text style={styles.previewTagText}>MAP PREVIEW</Text>
        </View>
        <Text style={styles.terminal}>{terminal}</Text>
      </View>

      {/* Stylized route: YOU dot → dashed line → destination dot */}
      <View style={styles.route}>
        <View style={styles.node}>
          <View style={[styles.dot, styles.youDot]} />
          <Text style={styles.nodeLabel}>YOU</Text>
        </View>

        <View style={styles.line}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>

        <View style={styles.node}>
          <View style={[styles.dot, styles.destDot]} />
          <Text style={styles.nodeLabel} numberOfLines={1}>
            {spotName}
          </Text>
        </View>
      </View>

      {/* Walking-time badge */}
      <View style={styles.footer}>
        <View style={styles.walkBadge}>
          <Feather name="navigation" size={13} color={colors.onAccent} />
          <Text style={styles.walkBadgeText}>{walkingMinutes} MIN WALK</Text>
        </View>
        <Text style={styles.nearGate}>near Gate {nearGate}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 190,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTag: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewTagText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  terminal: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.subtle,
  },

  route: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  node: {
    alignItems: 'center',
    gap: 8,
    width: 96,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.white,
  },
  youDot: {
    backgroundColor: colors.periwinkle,
  },
  destDot: {
    backgroundColor: colors.accent,
  },
  nodeLabel: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.text,
    textAlign: 'center',
  },
  line: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 20,
  },
  dash: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  walkBadgeText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
  },
  nearGate: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.subtle,
  },
})
