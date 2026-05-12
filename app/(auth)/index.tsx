import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

WebBrowser.maybeCompleteAuthSession()

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

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    try {
      const redirectUrl = 'proxy-app://auth/callback'
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('No OAuth URL returned')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (result.type !== 'success') return

      const { url } = result
      const queryParams = new URLSearchParams(url.split('?')[1] ?? '')
      const code = queryParams.get('code')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else {
        const fragmentParams = new URLSearchParams(url.split('#')[1] ?? '')
        const access_token = fragmentParams.get('access_token')
        const refresh_token = fragmentParams.get('refresh_token')
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token })
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.buttonDisabled]}
          onPress={signInWithGoogle}
          disabled={loading}
        >
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.subtle },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  googleText: { fontSize: 16, fontWeight: '500', color: colors.text },
})
