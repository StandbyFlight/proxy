import { ReactNode } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { GlassCard } from './GlassCard'
import { colors, spacing } from '../../lib/theme'
import { type } from '../../lib/typography'

// Shared loading + empty states so every screen fails/waits in the same voice.

export function LoadingState({
  message,
  style,
}: {
  message?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator size="large" color={colors.scarlet} />
      {message ? <Text style={[type.subhead, styles.msg]}>{message}</Text> : null}
    </View>
  )
}

export function EmptyState({
  title,
  message,
  glyph,
  action,
  style,
}: {
  title: string
  message?: string
  glyph?: string
  action?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.center, style]}>
      <GlassCard rounded="xl" padding={28} style={styles.card}>
        {glyph ? <Text style={styles.glyph}>{glyph}</Text> : null}
        <Text style={[type.heading, styles.title]}>{title}</Text>
        {message ? <Text style={[type.subhead, styles.msg]}>{message}</Text> : null}
        {action ? <View style={styles.action}>{action}</View> : null}
      </GlassCard>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  card: {
    alignItems: 'center',
    maxWidth: 340,
  },
  glyph: {
    fontSize: 34,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    textAlign: 'center',
  },
  msg: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
})
