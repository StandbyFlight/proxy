import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { type } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { InputFlipBoard } from '../../components/InputFlipBoard'
import { haptics } from '../../lib/haptics'

const NAME_MIN_SLOTS = 6
const NAME_MAX = 20
const CELL_HEIGHT = 46
const CELL_WIDTH = 36

export default function Name() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const trimmed = name.trim()
  const valid = trimmed.length > 0

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
      setError('Sign in expired. Please try again.')
      router.replace('/(auth)')
      return
    }
    const { error } = await supabase
      .from('users')
      .upsert(
        { id: session.user.id, first_name: trimmed, phone: session.user.phone ?? null },
        { onConflict: 'id' },
      )
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/(onboarding)/age')
  }

  return (
    <OnboardingChrome
      eyebrow=""
      step={1}
      total={4}
      title="Your name?"
      subtitle="So people know what to call you."
      onContinue={next}
      continueDisabled={!valid}
      continueLoading={loading}
      hideBack
      error={error}
    >
      <View style={styles.boardWrap}>
        <InputFlipBoard
          value={name}
          minSlots={NAME_MIN_SLOTS}
          maxLength={NAME_MAX}
          onChangeText={setName}
          cellSize={CELL_HEIGHT}
          cellWidth={CELL_WIDTH}
          gap={4}
          autoFocus
          autoCapitalize="characters"
          filter={(t) => t.replace(/[^a-zA-Z]/g, '')}
        />
        <Text style={styles.hint}>Tap to edit</Text>
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
})
