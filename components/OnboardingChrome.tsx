import { ReactNode } from 'react'
import {
  View, Text, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../lib/theme'
import { type } from '../lib/typography'
import { ProgressDashes } from './ProgressDashes'
import { haptics } from '../lib/haptics'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export function OnboardingChrome({
  eyebrow,
  title,
  subtitle,
  step,
  total,
  children,
  onContinue,
  onBack,
  continueDisabled,
  continueLoading,
  continueLabel = 'Continue',
  hideBack = false,
  error,
}: {
  eyebrow: string
  title: string
  subtitle?: string | ReactNode
  step: number
  total: number
  children: ReactNode
  onContinue: () => void
  onBack?: () => void
  continueDisabled?: boolean
  continueLoading?: boolean
  continueLabel?: string
  hideBack?: boolean
  error?: string
}) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  function goBack() {
    haptics.buttonTap()
    if (onBack) { onBack(); return }
    if (router.canGoBack()) router.back()
    else router.replace('/(onboarding)/name')
  }

  function goForward() {
    if (!continueDisabled && !continueLoading) {
      haptics.buttonTap()
      onContinue()
    }
  }

  // Instagram-story-style tap: left 40% = back, right 60% = forward.
  // Only fires on empty areas — interactive children (inputs, buttons) claim
  // their own touches first and this handler never sees them.
  function handleStoryTap(e: { nativeEvent: { pageX: number } }) {
    if (e.nativeEvent.pageX < SCREEN_WIDTH * 0.4) {
      if (!hideBack) goBack()
    } else {
      goForward()
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.topChrome}>
          <ProgressDashes step={step} total={total} />
          {eyebrow ? (
            <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrow}</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Scroll body wrapped in a story-tap Pressable. Interactive descendants
              (TextInput, inner Pressables) claim their own touches — this only fires
              on truly empty regions of the scroll content. */}
          <Pressable onPress={handleStoryTap} android_ripple={null} style={styles.storyBody}>
            <Text style={[type.headline, styles.title]}>{title}</Text>
            {typeof subtitle === 'string' ? (
              <Text style={[type.subhead, styles.subtitle]}>{subtitle}</Text>
            ) : subtitle ? (
              <View style={{ marginTop: 10 }}>{subtitle}</View>
            ) : null}

            <View style={styles.body}>{children}</View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {hideBack ? (
            <View style={styles.footerSpacer} />
          ) : (
            <Pressable
              onPress={goBack}
              hitSlop={16}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
            >
              <Text style={[styles.triangle, styles.triangleBack]}>{'◀'}</Text>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => { if (!continueDisabled && !continueLoading) haptics.buttonTap(); onContinue() }}
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
              <>
                <Text style={styles.continueText}>{continueLabel}</Text>
                <Text style={[styles.triangle, styles.triangleContinue]}>{'▶'}</Text>
              </>
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
  },
  footerSpacer: { width: 64 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
  triangle: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  triangleBack: { color: colors.subtle },
  triangleContinue: { color: colors.bg },
  storyBody: { alignSelf: 'stretch' },
})
