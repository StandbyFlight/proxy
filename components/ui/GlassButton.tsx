import { ReactNode } from 'react'
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, shadow, blur, opacity, gradients, gradientDirection } from '../../lib/theme'
import { type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'

// Pill-shaped button, the single button primitive for the app.
//   primary   — solid scarlet gradient, white label, scarlet glow (main CTA)
//   gradient  — signature red→blue logo gradient fill (hero / celebratory CTA)
//   secondary — frosted glass, charcoal label (secondary actions)
//   ghost     — text-only, subtle (tertiary / cancel)
// States: pressed (dim + slight press), disabled (dimmed, inert), loading.

type Variant = 'primary' | 'gradient' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

type Props = {
  label: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  // Optional leading element (icon / glyph).
  left?: ReactNode
  haptic?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  accessibilityLabel?: string
}

const sizing: Record<Size, { pv: number; ph: number; font: number }> = {
  sm: { pv: 10, ph: 18, font: 12 },
  md: { pv: 15, ph: 24, font: 14 },
  lg: { pv: 18, ph: 28, font: 15 },
}

export function GlassButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  left,
  haptic = true,
  style,
  textStyle,
  accessibilityLabel,
}: Props) {
  const s = sizing[size]
  const inert = disabled || loading
  const isSolid = variant === 'primary' || variant === 'gradient'
  const labelColor =
    variant === 'ghost' ? colors.textSecondary : isSolid ? colors.onAccent : colors.textPrimary

  function press() {
    if (inert) return
    if (haptic) haptics.buttonTap()
    onPress?.()
  }

  return (
    <Pressable
      onPress={press}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'primary' && shadow.accentGlow,
        variant === 'gradient' && shadow.card,
        variant === 'secondary' && shadow.sm,
        { paddingVertical: s.pv, paddingHorizontal: s.ph },
        pressed && !inert && styles.pressed,
        inert && { opacity: opacity.disabled },
        style,
      ]}
    >
      {/* Fill layer per variant */}
      {variant === 'primary' && (
        <LinearGradient
          colors={gradients.scarlet}
          start={gradientDirection.start}
          end={gradientDirection.end}
          style={StyleSheet.absoluteFill}
        />
      )}
      {variant === 'gradient' && (
        <LinearGradient
          colors={gradients.redToBlue}
          start={gradientDirection.start}
          end={gradientDirection.end}
          style={StyleSheet.absoluteFill}
        />
      )}
      {variant === 'secondary' && (
        <>
          <BlurView intensity={blur.subtle} tint={blur.tint} style={StyleSheet.absoluteFill} />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassWhiteStrong }]}
          />
        </>
      )}

      {/* Liquid-glass sheen — a bright specular highlight pooled at the top,
          a faint pick-up glow at the bottom, and a light edge rim. Applied to
          every non-ghost variant so the button reads as a translucent glass
          pill (iOS 26 "Liquid Glass"). */}
      {variant !== 'ghost' && !inert && (
        <>
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
            locations={[0, 0.34, 0.62]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)']}
            start={{ x: 0, y: 0.7 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.glassRim} pointerEvents="none" />
        </>
      )}

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={labelColor} />
        ) : (
          <>
            {left ? <View style={styles.left}>{left}</View> : null}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                type.label,
                styles.label,
                { color: labelColor, fontSize: s.font },
                textStyle,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: {
    opacity: opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  left: { marginRight: 2 },
  label: {
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  glassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderLeftColor: 'rgba(255,255,255,0.55)',
    borderRightColor: 'rgba(255,255,255,0.55)',
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
})
