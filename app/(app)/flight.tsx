import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { BoardingPassCapture, type BoardingPassData } from '../../components/BoardingPassCapture'

function buildDepartureISO(date: string, time: string): string | null {
  if (!date || !time) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h > 23 || m > 59) return null
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

type Phase = 'landing' | 'capturing' | 'confirm'

type Fields = {
  flight_number: string
  origin: string
  destination: string
  departure_date: string
  departure_time: string
  terminal: string
  gate: string
}

const today = new Date().toISOString().split('T')[0]

const emptyFields: Fields = {
  flight_number: '',
  origin: '',
  destination: '',
  departure_date: today,
  departure_time: '',
  terminal: '',
  gate: '',
}

export default function FlightScreen() {
  const [phase, setPhase] = useState<Phase>('landing')
  const [fields, setFields] = useState<Fields>(emptyFields)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function set(key: keyof Fields) {
    return (val: string) => setFields(f => ({ ...f, [key]: val }))
  }

  function handleParsed(data: BoardingPassData) {
    setFields({
      flight_number: data.flight_number ?? '',
      origin: data.origin ?? '',
      destination: data.destination ?? '',
      departure_date: data.departure_date ?? today,
      departure_time: data.departure_time ?? '',
      terminal: data.terminal ?? '',
      gate: data.gate ?? '',
    })
    setPhase('confirm')
  }

  const departureISO = buildDepartureISO(fields.departure_date, fields.departure_time)

  const canConfirm =
    fields.flight_number.length >= 4 &&
    fields.origin.length === 3 &&
    fields.destination.length === 3 &&
    departureISO !== null

  async function confirm() {
    setLoading(true)
    setError('')

    try {
      const { data: flightRow, error: upsertErr } = await supabase
        .from('flights')
        .upsert({
          flight_iata: fields.flight_number.toUpperCase(),
          departure_date: fields.departure_date,
          origin_iata: fields.origin.toUpperCase(),
          destination_iata: fields.destination.toUpperCase(),
          departure_scheduled: departureISO,
          departure_gate: fields.gate || null,
          departure_terminal: fields.terminal || null,
          last_enriched_at: new Date().toISOString(),
        }, { onConflict: 'flight_iata,departure_date' })
        .select('id')
        .single()

      if (upsertErr) throw upsertErr

      router.push({
        pathname: '/(app)/intent',
        params: {
          flight_id: flightRow.id,
          flight_iata: fields.flight_number.toUpperCase(),
          origin_iata: fields.origin.toUpperCase(),
          destination_iata: fields.destination.toUpperCase(),
          destination_city: '',
          departure_time: departureISO!,
          gate: fields.gate,
          terminal: fields.terminal,
        },
      })
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'capturing') {
    return (
      <BoardingPassCapture
        onParsed={handleParsed}
        onClose={() => setPhase('landing')}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.back}
          onPress={() => phase === 'confirm' ? setPhase('landing') : router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {phase === 'landing' && (
          <>
            <Text style={styles.heading}>What's your flight?</Text>
            <Text style={styles.sub}>Scan or upload your boarding pass.</Text>

            <TouchableOpacity style={styles.button} onPress={() => setPhase('capturing')}>
              <Text style={styles.buttonText}>Scan boarding pass</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualLink}
              onPress={() => { setFields(emptyFields); setPhase('confirm') }}
            >
              <Text style={styles.manualLinkText}>Enter details manually</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <Text style={styles.heading}>Review your flight</Text>
            <Text style={styles.sub}>Correct anything that looks off.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Flight number</Text>
              <TextInput
                style={styles.input}
                value={fields.flight_number}
                onChangeText={set('flight_number')}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="AA1234"
                placeholderTextColor={colors.subtle}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.rowField]}>
                <Text style={styles.label}>From</Text>
                <TextInput
                  style={styles.input}
                  value={fields.origin}
                  onChangeText={set('origin')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="JFK"
                  placeholderTextColor={colors.subtle}
                  maxLength={3}
                />
              </View>
              <View style={[styles.field, styles.rowField]}>
                <Text style={styles.label}>To</Text>
                <TextInput
                  style={styles.input}
                  value={fields.destination}
                  onChangeText={set('destination')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="SFO"
                  placeholderTextColor={colors.subtle}
                  maxLength={3}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.rowField]}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={fields.departure_date}
                  onChangeText={set('departure_date')}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.subtle}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={[styles.field, styles.rowField]}>
                <Text style={styles.label}>Departure time</Text>
                <TextInput
                  style={styles.input}
                  value={fields.departure_time}
                  onChangeText={set('departure_time')}
                  placeholder="14:35"
                  placeholderTextColor={colors.subtle}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.rowField]}>
                <Text style={styles.label}>Terminal</Text>
                <TextInput
                  style={styles.input}
                  value={fields.terminal}
                  onChangeText={set('terminal')}
                  autoCapitalize="characters"
                  placeholder="T1"
                  placeholderTextColor={colors.subtle}
                />
              </View>
              <View style={[styles.field, styles.rowField]}>
                <Text style={styles.label}>Gate</Text>
                <TextInput
                  style={styles.input}
                  value={fields.gate}
                  onChangeText={set('gate')}
                  autoCapitalize="characters"
                  placeholder="B42"
                  placeholderTextColor={colors.subtle}
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, (!canConfirm || loading) && styles.buttonDisabled]}
              onPress={confirm}
              disabled={!canConfirm || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Looks good</Text>
              }
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
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
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
  manualLink: { alignItems: 'center', paddingVertical: 8 },
  manualLinkText: { fontSize: 15, color: colors.subtle },
})
