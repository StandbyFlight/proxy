import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

const EXAMPLES = [
  'the rise of independent bookstores',
  'why my dog is so weird',
  'how to actually stop eating sugar',
  'a podcast about a 1970s cult',
  'learning to make sourdough',
]

const MIN_CHARS = 30

export default function Prompt() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exampleIdx, setExampleIdx] = useState(0)
  const focusedRef = useRef(false)
  const [showExample, setShowExample] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      if (focusedRef.current || text.length > 0) return
      setExampleIdx(i => (i + 1) % EXAMPLES.length)
    }, 2400)
    return () => clearInterval(t)
  }, [text])

  const trimmed = text.trim()
  const valid = trimmed.length >= MIN_CHARS

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
    router.replace('/(app)')
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.prompt}>What have you been{'\n'}nerding out about{'\n'}lately?</Text>
        <Text style={styles.sub}>
          The more specific, the better. We use this to find someone you'd actually want to talk to.
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder={showExample ? EXAMPLES[exampleIdx] : ''}
            placeholderTextColor={colors.subtle}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            scrollEnabled
            selectionColor={colors.accent}
            onFocus={() => { focusedRef.current = true; setShowExample(false) }}
            onBlur={() => { focusedRef.current = false; if (text.length === 0) setShowExample(true) }}
            maxLength={400}
          />
        </View>

        <Text style={styles.hint}>
          {trimmed.length < MIN_CHARS
            ? 'A sentence or two is plenty.'
            : 'Edit anytime in your profile.'}
        </Text>

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
            : <Text style={styles.buttonText}>Done</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 40, gap: 18 },
  prompt: {
    fontSize: 32, fontWeight: '600', color: colors.text,
    letterSpacing: -0.6, lineHeight: 38,
  },
  sub: { fontSize: 15, color: colors.subtle, lineHeight: 22, marginTop: -10, marginBottom: 4 },
  inputWrap: {
    borderBottomWidth: 1, borderBottomColor: colors.text,
    paddingBottom: 4,
  },
  input: {
    paddingVertical: 12, fontSize: 20, color: colors.text,
    minHeight: 110, textAlignVertical: 'top', letterSpacing: 0.2,
    lineHeight: 28,
  },
  hint: { fontSize: 13, color: colors.subtle, marginTop: -8 },
  button: { backgroundColor: colors.accent, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  error: { fontSize: 14, color: colors.error, marginTop: -4 },
})
