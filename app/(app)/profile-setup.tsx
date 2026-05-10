import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function ProfileSetup() {
  const [firstName, setFirstName] = useState('')
  const [city, setCity] = useState('')
  const [age, setAge] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const canSubmit = firstName.trim().length > 0 && city.trim().length > 0

  async function save() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { error } = await supabase.from('users').insert({
      id: session.user.id,
      first_name: firstName.trim(),
      base_city: city.trim(),
      age: age ? parseInt(age, 10) : null,
      phone: session.user.phone ?? null,
    })

    setLoading(false)
    if (error) setError(error.message)
    else router.replace('/(app)/flight')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>A bit about you</Text>
        <Text style={styles.sub}>Just enough for someone to say yes.</Text>

        <View style={styles.fields}>
          <View>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={styles.input}
              placeholder="Alex"
              placeholderTextColor={colors.subtle}
              value={firstName}
              onChangeText={setFirstName}
              autoFocus
            />
          </View>

          <View>
            <Text style={styles.label}>City you're based in</Text>
            <TextInput
              style={styles.input}
              placeholder="New York"
              placeholderTextColor={colors.subtle}
              value={city}
              onChangeText={setCity}
            />
          </View>

          <View>
            <Text style={styles.label}>
              Age{'  '}<Text style={styles.optional}>optional</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="24"
              placeholderTextColor={colors.subtle}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              maxLength={2}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={save}
          disabled={loading || !canSubmit}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.buttonText}>Continue</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40, gap: 28 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.subtle, marginTop: -16 },
  fields: { gap: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.subtle, marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
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
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, color: colors.error },
})
