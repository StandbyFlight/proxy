import { ReactNode } from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, gradients } from '../../lib/theme'

// The signature STANDBY backdrop: a clean off-white base with soft red / sky /
// lilac gradient glows bleeding in from the corners. Every screen sits on this
// so the frosted glass surfaces have colour to refract. Purely decorative and
// non-interactive (pointerEvents="none").

type Props = {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  // Which corner glows to show. Defaults to the full red→sky→lilac wash.
  variant?: 'full' | 'scarlet' | 'sky' | 'calm'
}

export function GradientBackground({ children, style, variant = 'full' }: Props) {
  return (
    <View style={[styles.base, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {(variant === 'full' || variant === 'scarlet') && (
          <LinearGradient
            colors={gradients.scarletGlow}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 0.8 }}
            style={[styles.glow, styles.topLeft]}
          />
        )}
        {(variant === 'full' || variant === 'sky') && (
          <LinearGradient
            colors={gradients.skyGlow}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.1, y: 0.2 }}
            style={[styles.glow, styles.bottomRight]}
          />
        )}
        {(variant === 'full' || variant === 'calm') && (
          <LinearGradient
            colors={gradients.lilacGlow}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.2, y: 0.9 }}
            style={[styles.glow, styles.topRight]}
          />
        )}
      </View>
      {children}
    </View>
  )
}

const GLOW = 460

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
  },
  topLeft: { top: -GLOW * 0.42, left: -GLOW * 0.34 },
  bottomRight: { bottom: -GLOW * 0.4, right: -GLOW * 0.36 },
  topRight: { top: -GLOW * 0.3, right: -GLOW * 0.42 },
})
