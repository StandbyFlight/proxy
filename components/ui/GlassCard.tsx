import { ReactNode } from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, radius, blur, shadow, gradients } from '../../lib/theme'

// Frosted translucent card — the core surface of the glass system. A BlurView
// backdrop, a translucent white fill, a soft light border, and a diffuse
// shadow. An optional low-opacity gradient "tint" gives brand-coloured glass.

type Tint = 'none' | 'scarlet' | 'sky' | 'lilac'

type Props = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  // Corner radius preset. Default lg (22).
  rounded?: keyof typeof radius
  // Blur intensity preset. Default card.
  intensity?: Exclude<keyof typeof blur, 'tint'>
  // Elevation preset. Default card.
  elevation?: keyof typeof shadow
  // Brand-coloured glass wash.
  tint?: Tint
  // Slightly more opaque fill for content-heavy cards that need contrast.
  strong?: boolean
  // A subtle top-down white sheen (reads as light catching the glass).
  sheen?: boolean
  padding?: number
}

const tintColors: Record<Exclude<Tint, 'none'>, string> = {
  scarlet: colors.glassScarlet,
  sky: colors.glassSky,
  lilac: colors.glassLilac,
}

export function GlassCard({
  children,
  style,
  rounded = 'lg',
  intensity = 'card',
  elevation = 'card',
  tint = 'none',
  strong = false,
  sheen = true,
  padding = 18,
}: Props) {
  const r = radius[rounded]
  return (
    <View style={[styles.shadow, shadow[elevation], { borderRadius: r }, style]}>
      <View style={[styles.clip, { borderRadius: r }]}>
        <BlurView
          intensity={blur[intensity]}
          tint={blur.tint}
          style={StyleSheet.absoluteFill}
        />
        {/* translucent fill so it reads as glass even where blur is weak */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: strong ? colors.glassWhiteStrong : colors.glassWhite },
          ]}
        />
        {tint !== 'none' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColors[tint] }]} />
        )}
        {sheen && (
          <LinearGradient
            colors={gradients.glassSheen}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        <View style={[styles.border, { borderRadius: r }]} pointerEvents="none" />
        <View style={{ padding }}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shadow: {
    backgroundColor: 'transparent',
  },
  clip: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
  },
})
