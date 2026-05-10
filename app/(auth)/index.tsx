import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function LoginScreen() {
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
    setLoading(false)
    if (error) setError(error.message)
    // root layout handles redirect on session change
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.wordmark}>proxy</Text>
        <Text style={styles.tagline}>
          Meet someone worth talking to,{'\n'}before your flight.
        </Text>

        {step === 'phone' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={colors.subtle}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, phoneDigits.length < 10 && styles.buttonDisabled]}
              onPress={sendOtp}
              disabled={loading || phoneDigits.length < 10}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Send code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Code sent to {phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.subtle}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, otp.length < 6 && styles.buttonDisabled]}
              onPress={verifyOtp}
              disabled={loading || otp.length < 6}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setError('') }}>
              <Text style={styles.link}>Use a different number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 14 },
  wordmark: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -1, marginBottom: 4 },
  tagline: { fontSize: 17, color: colors.subtle, lineHeight: 25, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14, color: colors.subtle },
  error: { fontSize: 14, color: colors.error },
  link: { fontSize: 14, color: colors.subtle, textAlign: 'center', textDecorationLine: 'underline', marginTop: 4 },
})
