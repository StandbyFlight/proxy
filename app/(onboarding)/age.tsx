import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { type } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { DigitFlipCell } from '../../components/DigitFlipCell'

// Two-digit age. Default lands at 22 — typical college-age user, easy to swipe from.
const DEFAULT_TENS = 2
const DEFAULT_ONES = 2

export default function Age() {
  const router = useRouter()
  const [tens, setTens] = useState(DEFAULT_TENS)
  const [ones, setOnes] = useState(DEFAULT_ONES)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const num = tens * 10 + ones
  const valid = num >= 13 && num <= 99

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
      .update({ age: num })
      .eq('id', session.user.id)
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/(onboarding)/city')
  }

  return (
    <OnboardingChrome
      eyebrow="Age · 02 / 04"
      step={2}
      total={4}
      title="And how old are you?"
      subtitle="Helps us match you with someone in the same chapter of life."
      onContinue={next}
      continueDisabled={!valid}
      continueLoading={loading}
      error={error}
    >
      <View style={styles.boardWrap}>
        <View style={styles.cells}>
          <DigitFlipCell value={tens} onChange={setTens} cellSize={92} cellWidth={64} />
          <DigitFlipCell value={ones} onChange={setOnes} cellSize={92} cellWidth={64} />
        </View>
        <Text style={styles.hint}>Swipe to change</Text>
        {!valid ? (
          <Text style={styles.warn}>Must be at least 13.</Text>
        ) : null}
      </View>
    </OnboardingChrome>
  )
}

const styles = StyleSheet.create({
  boardWrap: { gap: 14, alignItems: 'flex-start' },
  cells: { flexDirection: 'row', gap: 8 },
  hint: {
    ...type.hint,
    color: colors.subtle,
  },
  warn: {
    ...type.bodyItalic,
    color: colors.error,
    fontSize: 13,
    marginTop: -4,
  },
})
