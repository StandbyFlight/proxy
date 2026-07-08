import { ReactNode } from 'react'
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors } from '../../lib/theme'

// The STANDBY backdrop: a clean, full-white base. The corner gradient glows
// were removed per design — every screen now sits on flat white so the frosted
// glass surfaces read against a calm, neutral ground. Purely a container.

type Props = {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  // Kept for API compatibility with existing callers; no longer changes the
  // backdrop (all variants render the same flat white base).
  variant?: 'full' | 'scarlet' | 'sky' | 'calm'
}

export function GradientBackground({ children, style }: Props) {
  return <View style={[styles.base, style]}>{children}</View>
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.white,
  },
})
