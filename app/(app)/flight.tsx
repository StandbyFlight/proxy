import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
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

  if (json.error) {
    const code = json.error.code
    if (code === 104) throw new Error('Monthly flight lookup limit reached.')
    if (code === 106) throw new Error('API plan does not support HTTPS.')
    throw new Error(json.error.message ?? 'Flight data error.')
  }

  if (!json.data || json.data.length === 0) {
    throw new Error('Flight not found — double-check the number (e.g. AA1234)')
  }

  return json.data[0]
}

// Combines a user-entered "H:MM AM/PM" time with today's date into an ISO string
function buildDepartureISO(timeStr: string): string | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3]?.toUpperCase()

  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  if (hours > 23 || minutes > 59) return null

  const today = new Date().toISOString().split('T')[0]
  return `${today}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`
}

type Phase = 'search' | 'confirm'

export default function FlightScreen() {
  const [phase, setPhase] = useState<Phase>('search')
  const [flightNumber, setFlightNumber] = useState('')
  const [flightData, setFlightData] = useState<any>(null)
  const [flightRowId, setFlightRowId] = useState<string>('')

  // Manual inputs shown when API returns null
  const [manualDepartureTime, setManualDepartureTime] = useState('')
  const [manualTerminal, setManualTerminal] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const normalized = flightNumber.trim().toUpperCase().replace(/\s+/g, '')
  const isValid = /^[A-Z]{2}\d{1,4}$/.test(normalized)

  const apiDepartureTime = flightData?.departure?.scheduled ?? null
  const apiTerminal = flightData?.departure?.terminal ?? null

  const needsManualDepartureTime = phase === 'confirm' && !apiDepartureTime
  const needsManualTerminal = phase === 'confirm' && !apiTerminal

  const departureTimeReady = !needsManualDepartureTime || (manualDepartureTime.trim().length > 0 && !!buildDepartureISO(manualDepartureTime))
  const terminalReady = !needsManualTerminal || manualTerminal.trim().length > 0
  const canConfirm = departureTimeReady && terminalReady

  async function lookup() {
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

      setFlightData(f)
      setFlightRowId(flightRow.id)
      setPhase('confirm')
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    const departureTime = apiDepartureTime ?? buildDepartureISO(manualDepartureTime) ?? ''
    const terminal = apiTerminal ?? manualTerminal.trim()

    router.push({
      pathname: '/(app)/intent',
      params: {
        flight_id: flightRowId,
        flight_iata: normalized,
        origin_iata: flightData?.departure?.iata ?? '',
        destination_iata: flightData?.arrival?.iata ?? '',
        destination_city: flightData?.arrival?.airport ?? '',
        departure_time: departureTime,
        gate: flightData?.departure?.gate ?? '',
        terminal,
      },
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.back}
          onPress={() => phase === 'confirm' ? setPhase('search') : router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {phase === 'search' && (
          <>
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
              onPress={lookup}
              disabled={!isValid || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Look up flight</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {phase === 'confirm' && flightData && (
          <>
            <Text style={styles.heading}>{normalized}</Text>
            <Text style={styles.sub}>
              {flightData.departure?.iata ?? '?'} → {flightData.arrival?.iata ?? '?'}
              {flightData.airline?.name ? `  ·  ${flightData.airline.name}` : ''}
            </Text>

            {needsManualDepartureTime && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Departure time</Text>
                <Text style={styles.fieldHint}>
                  We couldn't get this from the airline. What time does your flight depart?
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 3:45 PM or 15:45"
                  placeholderTextColor={colors.subtle}
                  value={manualDepartureTime}
                  onChangeText={setManualDepartureTime}
                  autoFocus
                />
                {manualDepartureTime.length > 0 && !buildDepartureISO(manualDepartureTime) && (
                  <Text style={styles.error}>Enter time as H:MM AM/PM or HH:MM (24hr)</Text>
                )}
              </View>
            )}

            {needsManualTerminal && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Your departure terminal</Text>
                <Text style={styles.fieldHint}>
                  We couldn't get this from the airline. Check your boarding pass or the airport app.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. T1, B, International"
                  placeholderTextColor={colors.subtle}
                  value={manualTerminal}
                  onChangeText={setManualTerminal}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {!needsManualDepartureTime && !needsManualTerminal && (
              <View style={styles.confirmedInfo}>
                {apiDepartureTime && (
                  <Text style={styles.confirmedText}>
                    Departs {new Date(apiDepartureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
                {apiTerminal && (
                  <Text style={styles.confirmedText}>Terminal {apiTerminal}</Text>
                )}
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !canConfirm && styles.buttonDisabled]}
              onPress={confirm}
              disabled={!canConfirm}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 40, gap: 16 },
  back: { paddingBottom: 8 },
  backText: { fontSize: 15, color: colors.subtle },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.subtle, marginTop: -8 },
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
    marginTop: 8,
  },
  hint: { fontSize: 13, color: colors.subtle, textAlign: 'center' },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle, letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldHint: { fontSize: 13, color: colors.subtle, lineHeight: 19 },
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
  confirmedInfo: { gap: 4 },
  confirmedText: { fontSize: 15, color: colors.text },
  error: { fontSize: 14, color: colors.error },
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
