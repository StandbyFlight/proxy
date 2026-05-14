import { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function Name() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const trimmed = name.trim()
  const valid = trimmed.length > 0

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.prompt}>What's your first name?</Text>
        <Text style={styles.sub}>This is the only name anyone will see — last names are never shown.</Text>

        <TextInput
          style={styles.input}
          placeholder="Alex"
          placeholderTextColor={colors.subtle}
          value={name}
          onChangeText={setName}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          selectionColor={colors.accent}
          returnKeyType="next"
          onSubmitEditing={next}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            !valid && styles.buttonDisabled,
            pressed && valid && styles.buttonPressed,
          ]}
          onPress={next}
          disabled={loading || !valid}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.buttonText}>Continue</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 56, gap: 18 },
  prompt: { fontSize: 32, fontWeight: '600', color: colors.text, letterSpacing: -0.6, lineHeight: 38 },
  sub: { fontSize: 15, color: colors.subtle, lineHeight: 22, marginTop: -10, marginBottom: 8 },
  input: {
    borderBottomWidth: 1, borderBottomColor: colors.text,
    paddingVertical: 14, fontSize: 22, color: colors.text, letterSpacing: 0.4,
  },
  button: { backgroundColor: colors.accent, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  error: { fontSize: 14, color: colors.error, marginTop: -4 },
})
