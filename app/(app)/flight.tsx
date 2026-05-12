import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

const AVIATIONSTACK_KEY = process.env.EXPO_PUBLIC_AVIATIONSTACK_KEY!

async function lookupFlight(flightNumber: string) {
  const url = `https://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&flight_iata=${flightNumber}`

  const res = await fetch(url)

  if (res.status === 529) throw new Error('Flight data service is overloaded. Try again in a moment.')
  if (!res.ok) throw new Error(`Could not reach flight data (${res.status}). Try again.`)

  const json = await res.json()

  // AviationStack returns API-level errors inside a 200 response
  if (json.error) {
    const code = json.error.code
    if (code === 104) throw new Error('Monthly flight lookup limit reached.')
    if (code === 106) throw new Error('API plan does not support HTTPS — using HTTP.')
    throw new Error(json.error.message ?? 'Flight data error.')
  }

  if (!json.data || json.data.length === 0) {
    throw new Error('Flight not found — double-check the number (e.g. AA1234)')
  }

  return json.data[0]
}

export default function FlightScreen() {
  const [flightNumber, setFlightNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const normalized = flightNumber.trim().toUpperCase().replace(/\s+/g, '')
  const isValid = /^[A-Z]{2}\d{1,4}$/.test(normalized)

  async function proceed() {
    setLoading(true)
    setError('')

    try {
      const f = await lookupFlight(normalized)
      const today = new Date().toISOString().split('T')[0]

      const { data: flightRow, error: upsertErr } = await supabase
        .from('flights')
        .upsert({
          flight_iata: normalized,
          departure_date: today,
          airline_name: f.airline?.name ?? null,
          airline_iata: f.airline?.iata ?? null,
          origin_iata: f.departure?.iata ?? null,
          origin_name: f.departure?.airport ?? null,
          destination_iata: f.arrival?.iata ?? null,
          destination_name: f.arrival?.airport ?? null,
          departure_scheduled: f.departure?.scheduled ?? null,
          arrival_scheduled: f.arrival?.scheduled ?? null,
          departure_gate: f.departure?.gate ?? null,
          departure_terminal: f.departure?.terminal ?? null,
          arrival_gate: f.arrival?.gate ?? null,
          status: f.flight_status ?? null,
          last_enriched_at: new Date().toISOString(),
        }, { onConflict: 'flight_iata,departure_date' })
        .select('id')
        .single()

      if (upsertErr) throw upsertErr

      router.push({
        pathname: '/(app)/intent',
        params: {
          flight_id: flightRow.id,
          flight_iata: normalized,
          origin_iata: f.departure?.iata ?? '',
          destination_iata: f.arrival?.iata ?? '',
          destination_city: f.arrival?.airport ?? '',
          departure_time: f.departure?.scheduled ?? '',
          gate: f.departure?.gate ?? '',
          terminal: f.departure?.terminal ?? '',
        },
      })
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
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

        {error
          ? <Text style={styles.error}>{error}</Text>
          : <Text style={styles.hint}>Carrier code + flight number</Text>
        }

        <TouchableOpacity
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={proceed}
          disabled={!isValid || loading}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.buttonText}>Continue</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 16 },
  back: { paddingTop: 60, paddingBottom: 8 },
  backText: { fontSize: 15, color: colors.subtle },
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
  error: { fontSize: 14, color: colors.error, textAlign: 'center' },
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
