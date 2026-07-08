import { forwardRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { colors, radius, blur, spacing } from '../../lib/theme'
import { type, fonts } from '../../lib/typography'

// Glass text field — frosted fill, soft border that brightens to scarlet on
// focus. Optional label and error. Forwards the ref and all TextInput props so
// existing screens can drop it in without changing behavior.

type Props = TextInputProps & {
  label?: string
  error?: string | null
  containerStyle?: StyleProp<ViewStyle>
}

export const GlassInput = forwardRef<TextInput, Props>(function GlassInput(
  { label, error, containerStyle, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const borderColor = error
    ? colors.scarlet
    : focused
    ? colors.scarlet
    : colors.borderHair

  return (
    <View style={containerStyle}>
      {label ? <Text style={[type.hint, styles.label]}>{label}</Text> : null}
      <View style={[styles.field, { borderColor }]}>
        <BlurView intensity={blur.subtle} tint={blur.tint} style={StyleSheet.absoluteFill} />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassWhiteStrong }]}
        />
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.scarlet}
          onFocus={e => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={e => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? <Text style={[type.caption, styles.error]}>{error}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  field: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  error: {
    color: colors.scarlet,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
})
