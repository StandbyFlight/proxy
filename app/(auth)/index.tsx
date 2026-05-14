import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function LoginScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`
  const phoneDigits = phone.replace(/\D/g, '')

  async function sendOtp() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone })
    setLoading(false)
    if (error) setError(error.message)
    else setStep('otp')
  }

  async function verifyOtp() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      setError('Something went wrong. Try again.')
      return
    }
    const { data } = await supabase
      .from('users')
      .select('first_name, age, base_city, current_thinking')
      .eq('id', session.user.id)
      .maybeSingle()

    setLoading(false)
    if (!data?.first_name) router.replace('/(onboarding)/name')
    else if (data.age == null) router.replace('/(onboarding)/age')
    else if (!data.base_city) router.replace('/(onboarding)/city')
    else if (!data.current_thinking) router.replace('/(onboarding)/prompt')
    else router.replace('/(app)')
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {step === 'phone' ? (
          <>
            <Text style={styles.prompt}>What's your number?</Text>
            <Text style={styles.sub}>We'll text you a code.</Text>

            <TextInput
              style={styles.input}
              placeholder="(555) 123 4567"
              placeholderTextColor={colors.subtle}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
              selectionColor={colors.accent}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                phoneDigits.length < 10 && styles.buttonDisabled,
                pressed && phoneDigits.length >= 10 && styles.buttonPressed,
              ]}
              onPress={sendOtp}
              disabled={loading || phoneDigits.length < 10}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Send code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.prompt}>Enter the code.</Text>
            <Text style={styles.sub}>Sent to {phone}.</Text>

            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor={colors.subtle}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              autoFocus
              selectionColor={colors.accent}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                otp.length < 6 && styles.buttonDisabled,
                pressed && otp.length >= 6 && styles.buttonPressed,
              ]}
              onPress={verifyOtp}
              disabled={loading || otp.length < 6}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Verify</Text>}
            </Pressable>

            <Pressable
              onPress={() => { setStep('phone'); setOtp(''); setError('') }}
              hitSlop={12}
            >
              <Text style={styles.link}>Use a different number</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    gap: 18,
  },
  prompt: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  sub: {
    fontSize: 15,
    color: colors.subtle,
    lineHeight: 22,
    marginTop: -10,
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingHorizontal: 0,
    paddingVertical: 14,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 0.4,
  },
  codeInput: {
    fontSize: 28,
    letterSpacing: 12,
    fontVariant: ['tabular-nums'],
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  buttonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  link: {
    fontSize: 14,
    color: colors.subtle,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 12,
  },
  error: {
    fontSize: 14,
    color: colors.error,
    marginTop: -4,
  },
})
