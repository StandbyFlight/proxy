import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
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
  const insets = useSafeAreaInsets()

  function set(key: keyof Fields) {
    return (val: string) => setFields(f => ({ ...f, [key]: val }))
  }

  function handleParsed(data: BoardingPassData) {
    haptics.success()
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

      haptics.success()
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
      haptics.error()
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'confirm' && (
          <Pressable
            onPress={() => { haptics.buttonTap(); setPhase('landing') }}
            hitSlop={12}
            style={styles.back}
          >
            <Text style={styles.backText}>{'←  Back'}</Text>
          </Pressable>
        )}

        {phase === 'landing' && (
          <>
            <Text style={styles.eyebrow}>Your flight</Text>
            <Text style={styles.headline}>What's your{'\n'}flight?</Text>
            <Text style={styles.subhead}>Scan or upload your boarding pass.</Text>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={() => { haptics.buttonTap(); setPhase('capturing') }}
              >
                <Text style={styles.primaryBtnText}>Scan boarding pass  →</Text>
              </Pressable>

              <TouchableOpacity
                style={styles.ghostLink}
                onPress={() => { haptics.selection(); setFields(emptyFields); setPhase('confirm') }}
              >
                <Text style={styles.ghostLinkText}>Enter details manually</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <Text style={styles.eyebrow}>Review</Text>
            <Text style={styles.headline}>Looks right?</Text>
            <Text style={styles.subhead}>Correct anything that looks off.</Text>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Flight number</Text>
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
                  <Text style={styles.fieldLabel}>From</Text>
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
                  <Text style={styles.fieldLabel}>To</Text>
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
                  <Text style={styles.fieldLabel}>Date</Text>
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
                  <Text style={styles.fieldLabel}>Departure time</Text>
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
                  <Text style={styles.fieldLabel}>Terminal</Text>
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
                  <Text style={styles.fieldLabel}>Gate</Text>
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
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                (!canConfirm || loading) && styles.primaryBtnDisabled,
                pressed && canConfirm && { opacity: 0.85 },
              ]}
              onPress={() => { haptics.buttonTap(); confirm() }}
              disabled={!canConfirm || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.primaryBtnText}>Looks good  →</Text>
              }
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 16 },
  back: { marginBottom: 8 },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  subhead: { ...type.subhead, color: colors.subtle, marginTop: 2 },
  actions: { gap: 12, marginTop: 8 },
  form: { gap: 16, marginTop: 8 },
  field: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  rowField: { flex: 1 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  input: {
    fontFamily: fonts.serif,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  error: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.error,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bg,
  },
  ghostLink: { alignItems: 'center', paddingVertical: 10 },
  ghostLinkText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
})
