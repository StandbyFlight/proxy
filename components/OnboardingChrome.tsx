import { ReactNode } from 'react'
import {
  View, Text, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../lib/theme'
import { type } from '../lib/typography'
import { ProgressDashes } from './ProgressDashes'

export function OnboardingChrome({
  eyebrow,
  title,
  subtitle,
  step,
  total,
  children,
  onContinue,
  continueDisabled,
  continueLoading,
  continueLabel = 'Continue',
  hideBack = false,
  error,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  step: number
  total: number
  children: ReactNode
  onContinue: () => void
  continueDisabled?: boolean
  continueLoading?: boolean
  continueLabel?: string
  hideBack?: boolean
  error?: string
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.topChrome}>
          <ProgressDashes step={step} total={total} />
          <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[type.headline, styles.title]}>{title}</Text>
          {subtitle ? (
            <Text style={[type.subhead, styles.subtitle]}>{subtitle}</Text>
          ) : null}

          <View style={styles.body}>{children}</View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {hideBack ? (
            <View style={styles.footerSpacer} />
          ) : (
            <Pressable
              onPress={() => router.back()}
              hitSlop={16}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
            >
              <Text style={styles.backText}>{'←  Back'}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onContinue}
            disabled={continueDisabled || continueLoading}
            style={({ pressed }) => [
              styles.continueBtn,
              continueDisabled && styles.continueBtnDisabled,
              pressed && !continueDisabled && { opacity: 0.85 },
            ]}
          >
            {continueLoading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.continueText}>{continueLabel}  {'→'}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topChrome: { gap: 12, marginBottom: 24 },
  eyebrow: { color: colors.subtle },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  title: { color: colors.text },
  subtitle: { color: colors.subtle, marginTop: 10 },
  body: { marginTop: 32 },
  error: {
    fontFamily: 'Fraunces_400Regular_Italic',
    fontSize: 14,
    color: colors.error,
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10,10,10,0.08)',
  },
  footerSpacer: { width: 64 },
  backBtn: { paddingVertical: 10, paddingRight: 12 },
  backText: {
    fontFamily: 'Menlo',
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  continueBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 140,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  continueText: {
    fontFamily: 'Menlo',
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
})
