import { ReactNode } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ScrollViewProps,
} from 'react-native'
import { useSafeAreaInsets, Edge } from 'react-native-safe-area-context'
import { GradientBackground } from './GradientBackground'
import { spacing } from '../../lib/theme'

// Standard screen container: the gradient glass backdrop + safe-area padding.
// Use `scroll` for long content. Keeps every screen on the same background and
// horizontal rhythm so the app reads as one system.

type Props = {
  children: ReactNode
  scroll?: boolean
  // Horizontal screen padding (defaults to the 24pt screen gutter). Set 0 for
  // edge-to-edge screens that manage their own padding.
  padded?: boolean
  variant?: 'full' | 'scarlet' | 'sky' | 'calm'
  // Which edges get safe-area insets. Default top+bottom.
  edges?: Edge[]
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  scrollProps?: ScrollViewProps
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  variant = 'full',
  edges = ['top', 'bottom'],
  style,
  contentContainerStyle,
  scrollProps,
}: Props) {
  const insets = useSafeAreaInsets()
  const pad = {
    paddingTop: edges.includes('top') ? insets.top + spacing.md : 0,
    paddingBottom: edges.includes('bottom') ? Math.max(insets.bottom, spacing.lg) : 0,
    paddingHorizontal: padded ? spacing.screenX : 0,
  }

  return (
    <GradientBackground variant={variant}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[pad, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, pad, style]}>{children}</View>
      )}
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
