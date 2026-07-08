import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { InputFlipBoard } from '../../components/InputFlipBoard'
import { haptics } from '../../lib/haptics'

const PHONE_DIGITS = 10
const OTP_DIGITS = 6

export default function LoginScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formattedPhone = `+1${phone}`
  const phoneValid = phone.length === PHONE_DIGITS
  const otpValid = otp.length === OTP_DIGITS

  async function sendOtp() {
    if (!phoneValid) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone })
    setLoading(false)
    if (error) { haptics.error(); setError(error.message); return }
    setStep('otp')
  }

  async function verifyOtp() {
    if (!otpValid) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setLoading(false)
      haptics.error()
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
    haptics.success()
    if (!data?.first_name) router.replace('/(onboarding)/name')
    else if (data.age == null) router.replace('/(onboarding)/age')
    else if (!data.base_city) router.replace('/(onboarding)/city')
    else if (!data.current_thinking) router.replace('/(onboarding)/prompt')
    else router.replace('/(app)')
  }

  function backToPhone() {
    setStep('phone')
    setOtp('')
    setError('')
  }

  if (step === 'phone') {
    return (
      <OnboardingChrome
        eyebrow=""
        step={1}
        total={2}
        title="What's your number?"
        onContinue={sendOtp}
        continueDisabled={!phoneValid}
        continueLoading={loading}
        continueLabel="Send code"
        hideBack
        error={error}
      >
        <View style={styles.phoneRow}>
          <Text style={styles.prefix}>+1</Text>
          <InputFlipBoard
            value={phone}
            minSlots={PHONE_DIGITS}
            maxLength={PHONE_DIGITS}
            onChangeText={setPhone}
            cellSize={36}
            cellWidth={24}
            gap={3}
            autoFocus
            keyboardType="number-pad"
            filter={(t) => t.replace(/\D/g, '')}
          />
        </View>
        <Text style={styles.hint}>Tap to edit</Text>
      </OnboardingChrome>
    )
  }

  return (
    <OnboardingChrome
      eyebrow=""
      step={2}
      total={2}
      title="Enter the code."
      onContinue={verifyOtp}
      continueDisabled={!otpValid}
      continueLoading={loading}
      continueLabel="Verify"
      onBack={backToPhone}
      error={error}
    >
      <View style={styles.otpWrap}>
        <InputFlipBoard
          value={otp}
          minSlots={OTP_DIGITS}
          maxLength={OTP_DIGITS}
          onChangeText={setOtp}
          cellSize={46}
          cellWidth={32}
          gap={4}
          autoFocus
          keyboardType="number-pad"
          filter={(t) => t.replace(/\D/g, '')}
        />
        <Text style={styles.hint}>Tap to edit</Text>
      </View>
    </OnboardingChrome>
  )
}

const styles = StyleSheet.create({
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefix: {
    fontFamily: fonts.body,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 1,
  },
  otpWrap: {
    gap: 14,
    alignItems: 'flex-start',
  },
  hint: {
    ...type.hint,
    color: colors.subtle,
    marginTop: 14,
  },
})
