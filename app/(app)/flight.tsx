import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

const AERODATABOX_KEY = process.env.EXPO_PUBLIC_AERODATABOX_KEY!

async function lookupFlight(flightNumber: string) {
  const today = new Date().toISOString().split('T')[0]
  const res = await fetch(
    `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}/${today}`,
    {
      headers: {
        'X-RapidAPI-Key': AERODATABOX_KEY,
        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
      },
    }
  )

  if (res.status === 404) throw new Error('Flight not found — double-check the number (e.g. AA1234)')
  if (!res.ok) throw new Error('Could not reach flight data. Try again.')

  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Flight not found — double-check the number (e.g. AA1234)')
  }

  return data[0]
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

      const toUtcIso = (t?: string) =>
        t ? `${t.endsWith('Z') ? t : t + 'Z'}` : null

      const { data: flightRow, error: upsertErr } = await supabase
        .from('flights')
        .upsert({
          flight_iata: normalized,
          departure_date: today,
          airline_name: f.airline?.name ?? null,
          airline_iata: f.airline?.iata ?? null,
          origin_iata: f.departure?.airport?.iata ?? null,
          origin_name: f.departure?.airport?.name ?? null,
          origin_city: f.departure?.airport?.municipalityName ?? null,
          destination_iata: f.arrival?.airport?.iata ?? null,
          destination_name: f.arrival?.airport?.name ?? null,
          destination_city: f.arrival?.airport?.municipalityName ?? null,
          departure_scheduled: toUtcIso(f.departure?.scheduledTime?.utc),
          arrival_scheduled: toUtcIso(f.arrival?.scheduledTime?.utc),
          departure_gate: f.departure?.gate ?? null,
          departure_terminal: f.departure?.terminal ?? null,
          arrival_gate: f.arrival?.gate ?? null,
          status: f.status ?? null,
          icao24: f.aircraft?.modeS ?? null,
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
          origin_iata: f.departure?.airport?.iata ?? '',
          destination_iata: f.arrival?.airport?.iata ?? '',
          destination_city: f.arrival?.airport?.municipalityName ?? '',
          departure_time: f.departure?.scheduledTime?.local ?? '',
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
  back: { paddingTop: 60, paddingBottom: 8 },
  backText: { fontSize: 15, color: colors.subtle },
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
