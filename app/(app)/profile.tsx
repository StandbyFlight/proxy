import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadow } from '../../lib/theme'
import { fonts } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { getActiveSession } from '../../lib/session'
import { passDate, passTime } from '../../lib/format'
import { BoardingPass } from '../../components/BoardingPass'
import { StandbyStamp } from '../../components/StandbyStamp'
import { primaryIataForCity, searchCities, type CityEntry } from '../../lib/cities'
import { GradientBackground, GlassButton, GlassCard } from '../../components/ui'

// Profile is edited right here — pass on top, editable fields below.
// Settings holds account-level actions only.

type Profile = {
  first_name: string
  age: string
  base_city: string
  current_thinking: string
  school: string
  hometown: string
  career_stage: string
  travel_style: string
  currently_into: string
  ask_me_about: string
  next_on_list: string
  know_a_lot_about: string
  cities_know_well: string
  moving_to_city: string
}

const EMPTY: Profile = {
  first_name: '', age: '', base_city: '', current_thinking: '',
  school: '', hometown: '', career_stage: '', travel_style: '',
  currently_into: '', ask_me_about: '', next_on_list: '',
  know_a_lot_about: '', cities_know_well: '', moving_to_city: '',
}

const CAREER_STAGES = [
  { key: 'student',   label: 'Student' },
  { key: 'early',     label: 'Early (0–3 yrs)' },
  { key: 'mid',       label: 'Mid (3–8 yrs)' },
  { key: 'senior',    label: 'Senior (8+ yrs)' },
  { key: 'founder',   label: 'Founder' },
  { key: 'executive', label: 'Executive' },
]

const TRAVEL_STYLES = [
  { key: 'light_packer',  label: 'Light packer' },
  { key: 'carry_on_only', label: 'Carry-on only' },
  { key: 'frequent_flyer', label: 'Frequent flyer' },
]

const TRAVEL_MOTIVATIONS = [
  { key: 'recharge',     label: 'Recharge alone' },
  { key: 'meet_people',  label: 'Meet new people' },
  { key: 'food_culture', label: 'Food & culture' },
  { key: 'see_as_much',  label: 'See as much as possible' },
  { key: 'slow_down',    label: 'Slow down & settle in' },
]

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [initial, setInitial] = useState<Profile>(EMPTY)
  const [travelMotivations, setTravelMotivations] = useState<string[]>([])
  const [initialMotivations, setInitialMotivations] = useState<string[]>([])
  const [flightInfo, setFlightInfo] = useState<{
    flight: string | null
    origin: string | null
    destination: string | null
    date: string | null
    time: string | null
    gate: string | null
    terminal: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<CityEntry[]>([])
  const [cityFocused, setCityFocused] = useState(false)

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data } = await supabase
        .from('users')
        .select(`
          first_name, age, base_city, current_thinking,
          school, hometown, career_stage, travel_style,
          currently_into, ask_me_about, next_on_list,
          know_a_lot_about, cities_know_well, moving_to_city,
          travel_motivations
        `)
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return

      if (data) {
        const next: Profile = {
          first_name: data.first_name ?? '',
          age: data.age != null ? String(data.age) : '',
          base_city: data.base_city ?? '',
          current_thinking: data.current_thinking ?? '',
          school: data.school ?? '',
          hometown: data.hometown ?? '',
          career_stage: data.career_stage ?? '',
          travel_style: data.travel_style ?? '',
          currently_into: data.currently_into ?? '',
          ask_me_about: data.ask_me_about ?? '',
          next_on_list: data.next_on_list ?? '',
          know_a_lot_about: data.know_a_lot_about ?? '',
          cities_know_well: data.cities_know_well ?? '',
          moving_to_city: data.moving_to_city ?? '',
        }
        const motivations: string[] = Array.isArray(data.travel_motivations)
          ? data.travel_motivations
          : []
        setProfile(next)
        setInitial(next)
        setTravelMotivations(motivations)
        setInitialMotivations(motivations)
      }

      const activeSession = await getActiveSession()
      if (cancelled) return
      if (activeSession) {
        const dep = activeSession.departure_time
        setFlightInfo({
          flight: activeSession.flight_iata,
          origin: activeSession.origin_iata,
          destination: activeSession.destination_iata,
          date: dep ? passDate(dep) : null,
          time: dep ? passTime(dep) : null,
          gate: activeSession.gate,
          terminal: activeSession.terminal,
        })
      }
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    return () => { cancelled = true }
  }, []))

  useEffect(() => {
    if (!cityFocused || profile.base_city.length < 1) {
      setCitySuggestions([])
      return
    }
    setCitySuggestions(searchCities(profile.base_city, 5))
  }, [profile.base_city, cityFocused])

  function set(key: keyof Profile) {
    return (val: string) => setProfile(p => ({ ...p, [key]: val }))
  }

  function toggleMotivation(key: string) {
    haptics.selection()
    setTravelMotivations(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) return prev
      return [...prev, key]
    })
  }

  const profileDirty = (Object.keys(profile) as (keyof Profile)[]).some(k => profile[k] !== initial[k])
  const motivationsDirty = JSON.stringify([...travelMotivations].sort()) !== JSON.stringify([...initialMotivations].sort())
  const dirty = profileDirty || motivationsDirty

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); router.replace('/(auth)'); return }

    const ageNum = profile.age ? parseInt(profile.age, 10) : null
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        first_name: profile.first_name.trim() || null,
        age: ageNum,
        base_city: profile.base_city.trim() || null,
        current_thinking: profile.current_thinking.trim() || null,
        school: profile.school.trim() || null,
        hometown: profile.hometown.trim() || null,
        career_stage: profile.career_stage || null,
        travel_style: profile.travel_style || null,
        currently_into: profile.currently_into.trim() || null,
        ask_me_about: profile.ask_me_about.trim() || null,
        next_on_list: profile.next_on_list.trim() || null,
        know_a_lot_about: profile.know_a_lot_about.trim() || null,
        cities_know_well: profile.cities_know_well.trim() || null,
        moving_to_city: profile.moving_to_city.trim() || null,
        travel_motivations: travelMotivations.length > 0 ? travelMotivations : null,
      })
      .eq('id', session.user.id)

    setSaving(false)
    if (updateErr) { haptics.error(); setError(updateErr.message); return }
    haptics.success()
    setInitial(profile)
    setInitialMotivations(travelMotivations)
  }

  const iata = profile.base_city ? primaryIataForCity(profile.base_city) : '···'

  return (
    <GradientBackground>
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
        <View style={styles.topRow}>
          <View />
          <Pressable
            onPress={() => { haptics.selection(); router.push('/(app)/settings') }}
            hitSlop={14}
            style={({ pressed }) => [pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.settingsLink}>SETTINGS</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ marginTop: 64, alignItems: 'center' }}>
            <ActivityIndicator color={colors.subtle} />
          </View>
        ) : (
          <>
            <View style={styles.passWrap}>
              <BoardingPass
                airline="STANDBY"
                classLabel="STANDBY PASS"
                passenger={profile.first_name || null}
                origin={flightInfo?.origin || iata}
                destination={flightInfo?.destination || null}
                flight={flightInfo?.flight || null}
                date={flightInfo?.date || null}
                time={flightInfo?.time || null}
                gate={flightInfo?.gate || null}
                terminal={flightInfo?.terminal || null}
                status={flightInfo ? 'ON STANDBY' : null}
                stampSlot={profile.first_name ? <StandbyStamp label="STANDBY" /> : null}
              />
            </View>

            <View style={styles.fields}>
              <FieldLine label="FIRST NAME" value={profile.first_name} onChange={set('first_name')}
                placeholder="ESTHER" autoCapitalize="characters" maxLength={20} />

              <FieldLine label="AGE" value={profile.age} onChange={set('age')}
                placeholder="21" maxLength={2} keyboardType="number-pad" />

              <View>
                <FieldLine label="BASE CITY" value={profile.base_city} onChange={set('base_city')}
                  placeholder="Raleigh, NC" autoCapitalize="words" maxLength={48}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => setTimeout(() => setCityFocused(false), 150)} />
                {cityFocused && citySuggestions.length > 0 ? (
                  <GlassCard rounded="md" padding={4} style={styles.suggestions}>
                    {citySuggestions.map(s => (
                      <Pressable
                        key={`${s.name}-${s.state}`}
                        onPress={() => {
                          haptics.selection()
                          set('base_city')(`${s.name}, ${s.state}`)
                          setCityFocused(false)
                        }}
                        style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.5 }]}
                      >
                        <Text style={styles.suggestionLabel}>{`${s.name}, ${s.state}`.toUpperCase()}</Text>
                        <Text style={styles.suggestionIata}>{s.airports[0] ?? ''}</Text>
                      </Pressable>
                    ))}
                  </GlassCard>
                ) : null}
              </View>

              <View>
                <Text style={styles.fieldLabel}>WHAT'S ON YOUR MIND</Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputMulti]}
                  value={profile.current_thinking}
                  onChangeText={set('current_thinking')}
                  placeholder="What's been catching your attention lately?"
                  placeholderTextColor={colors.subtle}
                  multiline
                  maxLength={400}
                  selectionColor={colors.accent}
                />
                <View style={styles.fieldLineRule} />
              </View>

              <FieldLine label="RIGHT NOW I'M INTO" value={profile.currently_into}
                onChange={set('currently_into')} placeholder="planning my trip" maxLength={60} />
              <FieldLine label="ASK ME ABOUT" value={profile.ask_me_about}
                onChange={set('ask_me_about')} placeholder="venture capital, hiking..." maxLength={60} />
              <FieldLine label="NEXT ON MY LIST" value={profile.next_on_list}
                onChange={set('next_on_list')} placeholder="japan, finishing my first novel…" maxLength={60} />
              <FieldLine label="I KNOW A LOT ABOUT" value={profile.know_a_lot_about}
                onChange={set('know_a_lot_about')} placeholder="specialty coffee, french cuisine…" maxLength={60} />
              <FieldLine label="HOMETOWN" value={profile.hometown} onChange={set('hometown')}
                placeholder="providence, rhode island" autoCapitalize="words" maxLength={48} />
              <FieldLine label="SCHOOL" value={profile.school} onChange={set('school')}
                placeholder="unc" autoCapitalize="words" maxLength={48} />
              <FieldLine label="CITIES I KNOW WELL" value={profile.cities_know_well}
                onChange={set('cities_know_well')} placeholder="boston, charlotte, tokyo" maxLength={80} />
              <FieldLine label="I'M MOVING TO" value={profile.moving_to_city}
                onChange={set('moving_to_city')} placeholder="san francisco, austin…"
                autoCapitalize="words" maxLength={48} />
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.fieldLabel}>CAREER STAGE</Text>
              <View style={styles.chips}>
                {CAREER_STAGES.map(cs => (
                  <Chip
                    key={cs.key}
                    label={cs.label}
                    selected={profile.career_stage === cs.key}
                    onPress={() => { haptics.selection(); set('career_stage')(profile.career_stage === cs.key ? '' : cs.key) }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.fieldLabel}>I TRAVEL TO  <Text style={styles.chipHint}></Text></Text>
              <View style={styles.chips}>
                {TRAVEL_MOTIVATIONS.map(tm => (
                  <Chip
                    key={tm.key}
                    label={tm.label}
                    selected={travelMotivations.includes(tm.key)}
                    disabled={!travelMotivations.includes(tm.key) && travelMotivations.length >= 2}
                    onPress={() => toggleMotivation(tm.key)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.fieldLabel}>TRAVEL STYLE</Text>
              <View style={styles.chips}>
                {TRAVEL_STYLES.map(ts => (
                  <Chip
                    key={ts.key}
                    label={ts.label}
                    selected={profile.travel_style === ts.key}
                    onPress={() => { haptics.selection(); set('travel_style')(profile.travel_style === ts.key ? '' : ts.key) }}
                  />
                ))}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <GlassButton
              label={dirty ? 'SAVE CHANGES' : 'SAVED'}
              onPress={save}
              variant="primary"
              loading={saving}
              disabled={!dirty || saving}
              style={styles.saveBtn}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </GradientBackground>
  )
}

function Chip({
  label, selected, disabled, onPress,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

function FieldLine({
  label, value, onChange, placeholder, maxLength,
  autoCapitalize, keyboardType, onFocus, onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: 'default' | 'number-pad'
  onFocus?: () => void
  onBlur?: () => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        selectionColor={colors.accent}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <View style={styles.fieldLineRule} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  inner: { paddingHorizontal: 24, gap: 18 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLink: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 1.4,
  },

  passWrap: { marginTop: 4 },

  fields: { gap: 16 },
  field: { flex: 1 },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginBottom: 6,
  },
  fieldInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  fieldInputMulti: {
    fontSize: 16,
    lineHeight: 23,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  fieldLineRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderHair,
  },

  suggestions: { marginTop: 6 },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 1.4,
  },
  suggestionIata: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1.4,
  },

  pickerSection: { gap: 10 },
  chipHint: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.subtle,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.glassWhiteStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderHair,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadow.sm,
  },
  chipSelected: { backgroundColor: colors.scarlet, borderColor: colors.scarlet },
  chipDisabled: { opacity: 0.35 },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  chipTextSelected: { fontFamily: fonts.bold, color: colors.onAccent },

  saveBtn: {
    marginTop: 8,
  },

  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
  },
})
