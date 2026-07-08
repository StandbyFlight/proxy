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
import { colors, shadow, blur, opacity, gradients, gradientDirection, radius } from '../../lib/theme'
import { type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'

// Pill-shaped button, the single button primitive for the app. Every non-ghost
// button is one frosted "liquid glass" pill: a reduced-opacity white base under
// a faint red→blue brand tint, charcoal label, light rim + top sheen.
//   primary   — the glass pill with a touch more lift (main CTA)
//   gradient  — same glass pill (hero / celebratory CTA)
//   secondary — same glass pill, lightest lift (secondary actions)
//   ghost     — text-only, subtle (tertiary / cancel)
// Hierarchy now reads through shadow depth, not fill colour.
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
  const isGhost = variant === 'ghost'
  // All non-ghost buttons are the same light glass now, so the label is
  // charcoal on every one of them (white text would vanish on the pale fill).
  const labelColor = isGhost ? colors.textSecondary : colors.textPrimary

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
        variant === 'primary' && shadow.card,
        (variant === 'gradient' || variant === 'secondary') && shadow.sm,
        { paddingVertical: s.pv, paddingHorizontal: s.ph },
        pressed && !inert && styles.pressed,
        inert && { opacity: opacity.disabled },
        style,
      ]}
    >
      {/* Frosted glass fill — a blurred, reduced-opacity white base under a
          faint red→blue brand tint. Shared by every non-ghost variant so all
          buttons read as one translucent glass pill. */}
      {!isGhost && (
        <>
          <BlurView intensity={blur.card} tint={blur.tint} style={StyleSheet.absoluteFill} />
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassButtonFill }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={gradients.glassTint}
            start={gradientDirection.start}
            end={gradientDirection.end}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      )}

      {/* Liquid-glass sheen — a bright specular highlight pooled at the top,
          a faint pick-up glow at the bottom, and a light edge rim. Applied to
          every non-ghost variant so the button reads as a translucent glass
          pill (iOS 26 "Liquid Glass"). */}
      {!isGhost && !inert && (
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
    borderRadius: radius['2xl'],
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
    borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: 'rgba(255,255,255,0.85)',
    borderLeftColor: 'rgba(255,255,255,0.55)',
    borderRightColor: 'rgba(255,255,255,0.55)',
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
})
