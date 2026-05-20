import { useState } from 'react'
import {
  View, Text, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { BoardingPassCapture, type BoardingPassData } from '../../components/BoardingPassCapture'
import { BoardingPass } from '../../components/BoardingPass'
import { StandbyStamp } from '../../components/StandbyStamp'

function buildDepartureISO(date: string, time: string): string | null {
  if (!date || !time) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const clean = time.trim().toLowerCase()
  // Accept "2:35 PM" / "2:35pm" and "14:35" (24h) formats.
  const ampm = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/)
  const mil  = clean.match(/^(\d{1,2}):(\d{2})$/)
  if (!ampm && !mil) return null
  let h: number, m: number
  if (ampm) {
    h = parseInt(ampm[1], 10)
    m = parseInt(ampm[2], 10)
    const isPM = ampm[3] === 'pm'
    if (h === 12) h = isPM ? 12 : 0
    else if (isPM) h += 12
  } else {
    h = parseInt(mil![1], 10)
    m = parseInt(mil![2], 10)
  }
  if (h > 23 || m > 59) return null
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(y, mo - 1, d, h, m, 0).toISOString()
}

function formatPassDate(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [_y, mm, dd] = iso.split('-')
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const monthIdx = parseInt(mm, 10) - 1
  if (monthIdx < 0 || monthIdx > 11) return null
  return `${months[monthIdx]} ${dd}`
}

type Phase = 'landing' | 'capturing' | 'edit'

type Fields = {
  flight_number: string
  origin: string
  destination: string
  departure_date: string
  departure_time: string
  terminal: string
  gate: string
}

function localDateString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function makeEmptyFields(): Fields {
  return {
    flight_number: '',
    origin: '',
    destination: '',
    departure_date: '',
    departure_time: '',
    terminal: '',
    gate: '',
  }
}

export default function FlightScreen() {
  const [phase, setPhase] = useState<Phase>('landing')
  const [fields, setFields] = useState<Fields>(makeEmptyFields)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupMsg, setLookupMsg] = useState('')
  const router = useRouter()
  const insets = useSafeAreaInsets()

  function set(key: keyof Fields) {
    return (val: string) => setFields(f => ({ ...f, [key]: val }))
  }

  async function lookupFlight(flightNumber: string, departureDate: string) {
    const code = flightNumber.trim().toUpperCase()
    if (code.length < 4) return
    setLookupLoading(true)
    setLookupMsg('')
    try {
      const date = departureDate || localDateString()
      console.log('[flight] lookup', code, 'for date', date)
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('lookup-flight', {
        body: { flight_iata: code, flight_date: date },
      })
      if (fnErr) throw fnErr
      const rows: any[] = fnData?.data ?? []
      if (rows.length === 0) {
        setLookupMsg('Flight not found. Fill in manually.')
        return
      }
      const f = rows[0]
      const dep = f.departure ?? {}
      const arr = f.arrival ?? {}
      const scheduled: string = dep.scheduled ?? ''
      // AviationStack returns local airport time — grab HH:MM directly from the ISO string.
      const [datePart, rawTime] = scheduled.split('T')
      const time24 = rawTime ? rawTime.substring(0, 5) : ''

      // Guard: AviationStack sometimes returns a historical record (e.g. 2024)
      // for a flight number that also flies in the future. Don't overwrite the
      // user's date if the API returned a past date — they almost certainly want
      // today or tomorrow.
      const today = localDateString()
      const safeDate = datePart && datePart >= today ? datePart : null
      if (datePart && !safeDate) {
        console.warn('[flight] API returned past date', datePart, '— keeping user date', date)
      }
      console.log('[flight] lookup result: datePart=', datePart, 'safeDate=', safeDate, 'time24=', time24)

      setFields(prev => ({
        ...prev,
        flight_number: code,
        origin:         dep.iata     ?? prev.origin,
        destination:    arr.iata     ?? prev.destination,
        departure_date: safeDate     || prev.departure_date,
        departure_time: time24       || prev.departure_time,
        terminal:       dep.terminal ?? prev.terminal,
        gate:           dep.gate     ?? prev.gate,
      }))
      const msg = safeDate
        ? 'Filled from live data. Confirm before continuing.'
        : 'Date auto-fill skipped (API returned a past date). Verify the date is correct.'
      setLookupMsg(msg)
    } catch (err: any) {
      console.error('[flight] lookup error:', err)
      setLookupMsg('Could not look up flight. Fill in manually.')
    } finally {
      setLookupLoading(false)
    }
  }

  function handleParsed(data: BoardingPassData) {
    haptics.success()
    // Boarding passes don't print the year; Claude guesses and often picks a past
    // year. Reject any scanned date that's already in the past and fall back to
    // today so the user just needs to confirm rather than correct it.
    const today = localDateString()
    const scannedDate = data.departure_date
    const safeDate = scannedDate && scannedDate >= today ? scannedDate : null
    if (scannedDate && !safeDate) {
      console.warn('[boarding-pass] scanned date is in the past', scannedDate, '— using today')
    }
    setFields({
      flight_number: data.flight_number ?? '',
      origin: data.origin ?? '',
      destination: data.destination ?? '',
      departure_date: safeDate ?? localDateString(),
      departure_time: data.departure_time ?? '',
      terminal: data.terminal ?? '',
      gate: data.gate ?? '',
    })
    setPhase('edit')
  }

  const departureISO = buildDepartureISO(fields.departure_date, fields.departure_time)

  const canConfirm =
    fields.flight_number.length >= 4 &&
    fields.origin.length === 3 &&
    fields.destination.length === 3 &&
    departureISO !== null

  async function confirm() {
    if (!canConfirm) return
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
        pathname: '/(app)/session/location',
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

  // Live boarding pass props derived from current fields. The flight pass
  // shows the flight, not the passenger — that lives on the profile pass.
  const passProps = {
    passenger: null as string | null,
    origin: fields.origin.toUpperCase() || null,
    destination: fields.destination.toUpperCase() || null,
    flight: fields.flight_number.toUpperCase() || null,
    date: formatPassDate(fields.departure_date),
    time: fields.departure_time || null,
    gate: fields.gate.toUpperCase() || null,
    terminal: fields.terminal.toUpperCase() || null,
    seat: null as string | null,
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top chrome */}
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              haptics.buttonTap()
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(app)/');
              }
            }}
            hitSlop={14}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.triangleSubtle}>{'◀'}</Text>
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
          <Text style={[type.eyebrow, styles.eyebrow]}>
            {phase === 'landing' ? '' : ''}
          </Text>
          <View style={styles.spacer} />
        </View>

        {phase === 'landing' ? (
          <View style={styles.landingBody}>
            <Text style={[type.headline, styles.headline]}>Your flight.</Text>
            <Text style={[type.subhead, styles.subhead]}>
              Scan your boarding pass, or fill one in by hand.
            </Text>

            <View style={styles.boardingPassWrap}>
              <BoardingPass {...passProps} />
            </View>

            <View style={styles.landingActions}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={() => { haptics.buttonTap(); setPhase('capturing') }}
              >
                <Text style={styles.triangleOnRed}>{'▶'}</Text>
                <Text style={styles.primaryBtnText}>SCAN BOARDING PASS</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  haptics.selection()
                  setFields(makeEmptyFields())
                  setPhase('edit')
                }}
                hitSlop={12}
                style={({ pressed }) => [styles.ghostLink, pressed && { opacity: 0.5 }]}
              >
                <Text style={styles.ghostLinkText}>FILL IN BY HAND</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.editBody}>
            <Text style={[type.headline, styles.headline]}>Looks right?</Text>
            <Text style={[type.subhead, styles.subhead]}>
              Fields fill in your pass as you type.
            </Text>

            <View style={styles.boardingPassWrap}>
              <BoardingPass
                {...passProps}
                stampSlot={canConfirm ? <StandbyStamp label="STANDBY" /> : null}
              />
            </View>

            <View style={styles.fieldList}>
              <View>
                <FieldLine
                  label="FLIGHT NO."
                  value={fields.flight_number}
                  onChange={val => { set('flight_number')(val); setLookupMsg('') }}
                  placeholder="AA1234"
                  maxLength={7}
                  autoCapitalize="characters"
                  onBlur={() => lookupFlight(fields.flight_number, fields.departure_date)}
                />
                {lookupLoading ? (
                  <View style={styles.lookupRow}>
                    <ActivityIndicator size="small" color={colors.subtle} />
                    <Text style={styles.lookupText}>Looking up flight…</Text>
                  </View>
                ) : lookupMsg ? (
                  <Text style={styles.lookupText}>{lookupMsg}</Text>
                ) : null}
              </View>

              <View style={styles.fieldRow}>
                <FieldLine label="FROM" value={fields.origin} onChange={set('origin')}
                  placeholder="JFK" maxLength={3} autoCapitalize="characters" half />
                <FieldLine label="TO" value={fields.destination} onChange={set('destination')}
                  placeholder="SFO" maxLength={3} autoCapitalize="characters" half />
              </View>

              <View style={styles.fieldRow}>
                <FieldLine label="DATE" value={fields.departure_date} onChange={set('departure_date')}
                  placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" half />
                <FieldLine label="DEPART" value={fields.departure_time} onChange={set('departure_time')}
                  placeholder="4:00 PM" keyboardType="numbers-and-punctuation" half />
              </View>

              <View style={styles.fieldRow}>
                <FieldLine label="TERMINAL" value={fields.terminal} onChange={set('terminal')}
                  placeholder="T1" maxLength={3} autoCapitalize="characters" half />
                <FieldLine label="GATE" value={fields.gate} onChange={set('gate')}
                  placeholder="B42" maxLength={4} autoCapitalize="characters" half />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={() => { if (canConfirm && !loading) { haptics.buttonTap(); confirm() } }}
              disabled={!canConfirm || loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!canConfirm || loading) && styles.primaryBtnDisabled,
                pressed && canConfirm && { opacity: 0.85 },
              ]}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : (
                  <>
                    <Text style={styles.triangleOnRed}>{'▶'}</Text>
                    <Text style={styles.primaryBtnText}>ISSUE PASS</Text>
                  </>
                )
              }
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function FieldLine({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  autoCapitalize,
  keyboardType,
  half = false,
  onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: 'default' | 'numbers-and-punctuation'
  half?: boolean
  onBlur?: () => void
}) {
  return (
    <View style={[styles.fieldLine, half && styles.fieldLineHalf]}>
      <Text style={styles.fieldLineLabel}>{label}</Text>
      <TextInput
        style={styles.fieldLineInput}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        selectionColor={colors.accent}
      />
      <View style={styles.fieldLineRule} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 18 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },

  landingBody: { gap: 16 },
  editBody: { gap: 16 },

  boardingPassWrap: { marginTop: 8 },

  landingActions: { gap: 12, marginTop: 12 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  primaryBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },

  ghostLink: { alignItems: 'center', paddingVertical: 10 },
  ghostLinkText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },

  fieldList: { gap: 16 },
  fieldRow: { flexDirection: 'row', gap: 14 },
  fieldLine: { flex: 1 },
  fieldLineHalf: { flex: 1 },
  fieldLineLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginBottom: 6,
  },
  fieldLineInput: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
    letterSpacing: 0.6,
  },
  fieldLineRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,10,0.25)',
  },

  error: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.error,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  lookupText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 0.8,
    marginTop: 6,
  },
})
