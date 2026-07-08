import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../../lib/theme'
import { type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { ProgressDashes } from '../../components/ProgressDashes'
import { GlassCard, GlassButton } from '../../components/ui'

// 5-question branching quiz writing to users.quiz_answers (JSONB) per
// group_plan §"quiz". Tone is loose — meant to feel like a magazine quiz, not
// a survey. Each question's answer is one of three options; selections drive
// the tellability score in the matcher (see matching_algorithm.md).

type Question = {
  key: string
  prompt: string
  options: { value: string; label: string }[]
}

const QUESTIONS: Question[] = [
  {
    key: 'ideal_seat',
    prompt: "What's your ideal seat?",
    options: [
      { value: 'window',      label: 'Window. I want to look out and disappear into my own head.' },
      { value: 'aisle',       label: 'Aisle. I like getting up and being in the flow of things.' },
      { value: 'middle_talk', label: 'Wherever I end up, as long as someone interesting is next to me.' },
    ],
  },
  {
    key: 'opening_line',
    prompt: 'A stranger sits down at your gate. What\'s your move?',
    options: [
      { value: 'wait_signal', label: 'Wait for them to make eye contact first.' },
      { value: 'comment',     label: 'Say something about the delay, the gate, the city. Anything light.' },
      { value: 'ask_about',   label: 'Ask where they\'re headed. People love being asked where they\'re going.' },
    ],
  },
  {
    key: 'best_conversation',
    prompt: 'The best in-flight conversation you ever had was with…',
    options: [
      { value: 'expert',      label: 'Someone who quietly knew an enormous amount about one thing.' },
      { value: 'storyteller', label: 'A person who lived a wilder life than I expected.' },
      { value: 'mirror',      label: 'Someone working through exactly what I was thinking about.' },
    ],
  },
  {
    key: 'travel_default',
    prompt: 'Layover hours, no plans. What\'s the default?',
    options: [
      { value: 'cafe_book', label: 'Café, single coffee, book.' },
      { value: 'walk_term', label: 'Walk the whole terminal. Look at everyone.' },
      { value: 'lounge',    label: 'Find the lounge. Don\'t move.' },
    ],
  },
  {
    key: 'right_now',
    prompt: 'Right now, you\'d rather…',
    options: [
      { value: 'learn',      label: 'Learn something I didn\'t know I cared about.' },
      { value: 'talk',       label: 'Talk to someone outside my usual bubble.' },
      { value: 'be_known',   label: 'Be asked what I actually think about something.' },
    ],
  },
]

export default function QuizScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = QUESTIONS.length
  const current = QUESTIONS[step]
  const picked = answers[current.key]

  function pick(value: string) {
    haptics.selection()
    setAnswers(prev => ({ ...prev, [current.key]: value }))
  }

  async function next() {
    if (!picked || saving) return
    if (step < total - 1) {
      haptics.buttonTap()
      setStep(s => s + 1)
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const { error: upErr } = await supabase
        .from('users')
        .update({ quiz_answers: answers })
        .eq('id', session.user.id)
      if (upErr) throw upErr
      haptics.standbyStamp()
      router.replace('/(onboarding)/preview')
    } catch (err: any) {
      haptics.error()
      setError(err.message ?? 'Could not save your answers. Try again.')
      setSaving(false)
    }
  }

  function back() {
    if (step === 0) return
    haptics.buttonTap()
    setStep(s => s - 1)
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topChrome}>
        <ProgressDashes step={step + 1} total={total} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.headline, styles.headline]}>{current.prompt}</Text>

        <View style={styles.options}>
          {current.options.map(opt => {
            const selected = picked === opt.value
            return (
              <Pressable
                key={opt.value}
                onPress={() => pick(opt.value)}
                style={({ pressed }) => [pressed && !selected && { opacity: 0.7 }]}
              >
                <GlassCard
                  rounded="lg"
                  padding={16}
                  tint={selected ? 'scarlet' : 'none'}
                  strong={selected}
                >
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {opt.label}
                  </Text>
                </GlassCard>
              </Pressable>
            )
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {step > 0 ? (
          <Pressable
            onPress={back}
            hitSlop={14}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
        ) : (
          <View style={styles.footerSpacer} />
        )}

        <GlassButton
          label={step < total - 1 ? 'NEXT' : 'FINISH'}
          onPress={next}
          variant="primary"
          size="lg"
          disabled={!picked || saving}
          haptic={false}
          fullWidth={false}
          style={styles.continueBtn}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: spacing.screenX },
  topChrome: { gap: 12, marginBottom: 24 },
  eyebrow: { color: colors.subtle },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: 24 },
  headline: { color: colors.text },
  options: { gap: 12 },
  optionLabel: {
    ...type.body,
    color: colors.textPrimary,
  },
  optionLabelSelected: {
    ...type.bodyBold,
    color: colors.scarletDeep,
  },
  error: {
    ...type.body,
    fontSize: 14,
    color: colors.error,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  footerSpacer: { width: 64 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  backText: { ...type.hint, color: colors.subtle },
  continueBtn: {
    minWidth: 150,
  },
})
