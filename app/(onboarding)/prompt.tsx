import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { haptics } from '../../lib/haptics'

const EXAMPLES = [
  'the rise of independent bookstores',
  'why my dog is so weird',
  'how to actually stop eating sugar',
  'a podcast about a 1970s cult',
  'learning to make sourdough',
]

const MIN_CHARS = 20
const MAX_CHARS = 400

// Deliberately not a flip board. Quiet, handwritten — the contrast against
// the rest of the onboarding is what gives the board its weight elsewhere.

export default function Prompt() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const focusedRef = useRef(false)
  const [showExample, setShowExample] = useState(true)
  const firedInputStart = useRef(false)
  const prevValid = useRef(false)

  useEffect(() => {
    const t = setInterval(() => {
      if (focusedRef.current || text.length > 0) return
      setExampleIdx(i => (i + 1) % EXAMPLES.length)
    }, 2800)
    return () => clearInterval(t)
  }, [text])

  const trimmed = text.trim()
  const valid = trimmed.length >= MIN_CHARS

  useEffect(() => {
    if (valid && !prevValid.current) haptics.inputValid()
    prevValid.current = valid
  }, [valid])

  async function next() {
    if (!valid) return
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      router.replace('/(auth)')
      return
    }
    const { error } = await supabase
      .from('users')
      .update({ current_thinking: trimmed })
      .eq('id', session.user.id)
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/(onboarding)/preview')
  }

  return (
    <OnboardingChrome
      eyebrow="Signal · 04 / 04"
      step={4}
      total={4}
      title="What's been on your mind lately?"
      subtitle="The more specific, the better. We use this to find someone you'd actually want to talk to."
      onContinue={next}
      continueDisabled={!valid}
      continueLoading={loading}
      error={error}
    >
      <View style={styles.frame}>
        <View style={styles.rule} />
        <TextInput
          style={styles.input}
          placeholder={showExample ? EXAMPLES[exampleIdx] : ''}
          placeholderTextColor={colors.subtle}
          value={text}
          onChangeText={setText}
          multiline
          scrollEnabled={false}
          selectionColor={colors.accent}
          onFocus={() => {
            focusedRef.current = true
            setShowExample(false)
            if (!firedInputStart.current) { firedInputStart.current = true; haptics.inputStart() }
          }}
          onBlur={() => { focusedRef.current = false; if (text.length === 0) setShowExample(true) }}
          maxLength={MAX_CHARS}
        />
        <View style={styles.rule} />
      </View>

      {!valid && text.length > 0 ? (
        <Text style={styles.softHint}>A sentence or two is plenty.</Text>
      ) : null}
    </OnboardingChrome>
  )
}

const styles = StyleSheet.create({
  frame: {
    marginTop: 8,
    gap: 18,
  },
  rule: {
    height: 1,
    backgroundColor: 'rgba(10,10,10,0.18)',
  },
  input: {
    fontFamily: fonts.serifItalic,
    fontSize: 20,
    lineHeight: 30,
    color: colors.text,
    minHeight: 160,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  softHint: {
    ...type.bodyItalic,
    fontSize: 13,
    color: colors.subtle,
    marginTop: 14,
  },
})
