import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'

export default function FlightScreen() {
  const [flightNumber, setFlightNumber] = useState('')
  const router = useRouter()

  const normalized = flightNumber.trim().toUpperCase().replace(/\s+/g, '')
  const isValid = /^[A-Z]{2}\d{1,4}$/.test(normalized)

  function proceed() {
    router.push({ pathname: '/(app)/intent', params: { flight: normalized } })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.heading}>What's your flight?</Text>
        <Text style={styles.sub}>We'll use this to find people at your airport.</Text>

        <TextInput
          style={styles.flightInput}
          placeholder="AA1234"
          placeholderTextColor={colors.subtle}
          autoCapitalize="characters"
          autoCorrect={false}
          value={flightNumber}
          onChangeText={setFlightNumber}
          autoFocus
        />

        <Text style={styles.hint}>Carrier code + flight number</Text>

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={proceed}
          disabled={!isValid}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.subtle, marginTop: -8, marginBottom: 8 },
  flightInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 13, color: colors.subtle, textAlign: 'center' },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
})
