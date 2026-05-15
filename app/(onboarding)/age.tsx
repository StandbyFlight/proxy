import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { type } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { InputFlipBoard } from '../../components/InputFlipBoard'
import { haptics } from '../../lib/haptics'

const AGE_LENGTH = 2
const CELL_HEIGHT = 92
const CELL_WIDTH = 64

export default function Age() {
  const router = useRouter()
  const [age, setAge] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const num = parseInt(age, 10)
  const valid = !isNaN(num) && num >= 13 && num <= 99

  const prevValid = useRef(false)
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
      .update({ age: num })
      .eq('id', session.user.id)
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/(onboarding)/city')
  }

  return (
    <OnboardingChrome
      eyebrow=""
      step={2}
      total={4}
      title="Your age?"
      subtitle="Find someone in the same chapter of life."
      onContinue={next}
      continueDisabled={!valid}
      continueLoading={loading}
      error={error}
    >
      <View style={styles.boardWrap}>
        <InputFlipBoard
          value={age}
          minSlots={AGE_LENGTH}
          maxLength={AGE_LENGTH}
          onChangeText={setAge}
          cellSize={CELL_HEIGHT}
          cellWidth={CELL_WIDTH}
          gap={6}
          autoFocus
          keyboardType="number-pad"
          filter={(t) => t.replace(/\D/g, '')}
        />
        <Text style={styles.hint}>Tap to edit</Text>
        {age.length === AGE_LENGTH && !valid ? (
          <Text style={styles.warn}>Must be between 13 and 99.</Text>
        ) : null}
      </View>
    </OnboardingChrome>
  )
}

const styles = StyleSheet.create({
  boardWrap: { gap: 14, alignItems: 'flex-start' },
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
