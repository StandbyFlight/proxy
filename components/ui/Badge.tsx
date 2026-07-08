import { ReactNode } from 'react'
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors, radius, spacing } from '../../lib/theme'
import { type } from '../../lib/typography'

// Small pill chip for statuses, tags, and counts. Tones map to the brand
// accents; `glass` is a neutral translucent chip. `selected` variants are used
// for choice chips (quiz answers, filters).

type Tone = 'neutral' | 'scarlet' | 'sky' | 'lilac' | 'glass'

type Props = {
  label?: string
  children?: ReactNode
  tone?: Tone
  selected?: boolean
  style?: StyleProp<ViewStyle>
}

const toneStyle: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'rgba(28,27,32,0.06)', fg: colors.textSecondary, border: colors.borderHair },
  scarlet: { bg: 'rgba(222,23,23,0.12)', fg: colors.scarletDeep, border: 'rgba(222,23,23,0.22)' },
  sky: { bg: 'rgba(151,208,227,0.22)', fg: '#2E6E85', border: 'rgba(151,208,227,0.5)' },
  lilac: { bg: 'rgba(167,150,174,0.20)', fg: '#6E5C76', border: 'rgba(167,150,174,0.4)' },
  glass: { bg: colors.glassWhiteStrong, fg: colors.textPrimary, border: colors.borderGlass },
}

export function Badge({ label, children, tone = 'neutral', selected = false, style }: Props) {
  const t = selected
    ? { bg: colors.scarlet, fg: colors.onAccent, border: colors.scarlet }
    : toneStyle[tone]
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: t.bg, borderColor: t.border },
        style,
      ]}
    >
      {children ?? (
        <Text style={[type.label, { color: t.fg }]} allowFontScaling={false} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
})
