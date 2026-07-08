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
import { colors, opacity } from '../../lib/theme'
import { fonts } from '../../lib/typography'
import { haptics } from '../../lib/haptics'

// The single button primitive for the app — flat, solid buttons (the original
// pre-"modern UI" look; no glass, blur, gradient, or rounding).
//   primary   — solid scarlet fill, white label (main CTA)
//   gradient  — same solid scarlet fill (kept as an alias so call sites don't
//               break; there was no distinct gradient button originally)
//   secondary — light surface fill + hairline border, charcoal label
//   ghost     — text-only, subtle (tertiary / cancel)
// States: pressed (dim), disabled (dimmed, inert), loading.

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
  const isGhost = variant === 'ghost'
  const labelColor =
    isGhost ? colors.textSecondary : isSolid ? colors.onAccent : colors.textPrimary

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
        isSolid && styles.solid,
        variant === 'secondary' && styles.secondary,
        { paddingVertical: s.pv, paddingHorizontal: s.ph },
        pressed && !inert && { opacity: isGhost ? opacity.pressedGhost : opacity.pressed },
        inert && { opacity: opacity.disabled },
        style,
      ]}
    >
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
    // Flat, sharp rectangle — the original button shape.
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  // Scarlet at reduced opacity so the red reads a touch softer/lighter.
  solid: { backgroundColor: 'rgba(222,23,23,0.8)' },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  left: { marginRight: 2 },
  label: {
    fontFamily: fonts.semibold,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
})
