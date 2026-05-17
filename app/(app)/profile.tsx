import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'
import { BoardingPass } from '../../components/BoardingPass'
import { StandbyStamp } from '../../components/StandbyStamp'
import { primaryIataForCity, searchCities, type CityEntry } from '../../lib/cities'

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
  { key: 'remote_worker', label: 'Remote / digital nomad' },
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
      const { data, error: userErr } = await supabase
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
      console.log('[profile] users query', { id: session.user.id, data, error: userErr })
      if (userErr) console.error('[profile] users query error:', userErr)
      if (cancelled || !data) { setLoading(false); return }

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

      const nowIso = new Date().toISOString()
      const { data: activeSession, error: sessErr } = await supabase
        .from('sessions')
        .select('id, status, expires_at, origin_iata, destination_iata, departure_time, gate, terminal, flights(flight_iata)')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      console.log('[profile] sessions query', { user_id: session.user.id, nowIso, data: activeSession, error: sessErr })
      if (sessErr) console.error('[profile] sessions query error:', sessErr)
      if (!cancelled && activeSession) {
        const fl = activeSession.flights as { flight_iata: string } | { flight_iata: string }[] | null
        const fIata = Array.isArray(fl) ? fl[0]?.flight_iata : fl?.flight_iata
        const dep = activeSession.departure_time as string | null
        setFlightInfo({
          flight: fIata ?? null,
          origin: activeSession.origin_iata ?? null,
          destination: activeSession.destination_iata ?? null,
          date: dep ? formatDepDate(dep) : null,
          time: dep ? formatDepTime(dep) : null,
          gate: (activeSession as any).gate ?? null,
          terminal: (activeSession as any).terminal ?? null,
        })
      }

      setLoading(false)
    }
    load()
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
              router.replace('/(app)/')
            }}
            hitSlop={14}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.triangleSubtle}>{'◀'}</Text>
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
          <Text style={[type.eyebrow, styles.eyebrow]}>BOARDING PASS</Text>
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
            <Text style={[type.headline, styles.headline]}>Your pass.</Text>
            <Text style={[type.subhead, styles.subhead]}>
              Fill in over time: more signals means better matches.
            </Text>

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
                seat={null}
                stampSlot={profile.first_name ? <StandbyStamp label="STANDBY" /> : null}
              />
            </View>

            {/* ── Basic profile ─────────────────────────────────────────── */}
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
                  <View style={styles.suggestions}>
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
                  </View>
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
            </View>

            {/* ── Right Now ─────────────────────────────────────────────── */}
            <SectionHeader
              title="RIGHT NOW"
              hint="What's active in your life on this trip."
            />
            <View style={styles.fields}>
              <FieldLine
                label="RIGHT NOW I'M INTO"
                value={profile.currently_into}
                onChange={set('currently_into')}
                placeholder="planning my Patagonia trip"
                maxLength={60}
              />
              <FieldLine
                label="ASK ME ABOUT"
                value={profile.ask_me_about}
                onChange={set('ask_me_about')}
                placeholder="venture capital, hiking the PCT…"
                maxLength={60}
              />
              <FieldLine
                label="NEXT ON MY LIST"
                value={profile.next_on_list}
                onChange={set('next_on_list')}
                placeholder="Japan, finishing my first novel…"
                maxLength={60}
              />
            </View>

            {/* ── About Me ──────────────────────────────────────────────── */}
            <SectionHeader
              title="ABOUT ME"
              hint="Stable signals — set once, update rarely."
            />
            <View style={styles.fields}>
              <FieldLine
                label="I KNOW A LOT ABOUT"
                value={profile.know_a_lot_about}
                onChange={set('know_a_lot_about')}
                placeholder="specialty coffee, college football, French cuisine…"
                maxLength={60}
              />
              <FieldLine label="HOMETOWN" value={profile.hometown} onChange={set('hometown')}
                placeholder="Chapel Hill, NC" autoCapitalize="words" maxLength={48} />
              <FieldLine label="SCHOOL" value={profile.school} onChange={set('school')}
                placeholder="UNC" autoCapitalize="words" maxLength={48} />
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.fieldLabel}>CAREER STAGE</Text>
              <View style={styles.chips}>
                {CAREER_STAGES.map(cs => (
                  <Pressable
                    key={cs.key}
                    onPress={() => { haptics.selection(); set('career_stage')(profile.career_stage === cs.key ? '' : cs.key) }}
                    style={({ pressed }) => [
                      styles.chip,
                      profile.career_stage === cs.key && styles.chipSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.chipText, profile.career_stage === cs.key && styles.chipTextSelected]}>
                      {cs.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── Travel ────────────────────────────────────────────────── */}
            <SectionHeader
              title="TRAVEL"
              hint="How and why you travel — high signal for the matcher."
            />

            <View style={styles.pickerSection}>
              <Text style={styles.fieldLabel}>I TRAVEL TO  <Text style={styles.chipHint}>(pick up to 2)</Text></Text>
              <View style={styles.chips}>
                {TRAVEL_MOTIVATIONS.map(tm => (
                  <Pressable
                    key={tm.key}
                    onPress={() => toggleMotivation(tm.key)}
                    style={({ pressed }) => [
                      styles.chip,
                      travelMotivations.includes(tm.key) && styles.chipSelected,
                      !travelMotivations.includes(tm.key) && travelMotivations.length >= 2 && styles.chipDisabled,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
                      travelMotivations.includes(tm.key) && styles.chipTextSelected,
                    ]}>
                      {tm.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fields}>
              <FieldLine
                label="CITIES I KNOW WELL"
                value={profile.cities_know_well}
                onChange={set('cities_know_well')}
                placeholder="Boston, Charlotte, Tokyo"
                maxLength={80}
              />
              <FieldLine
                label="I'M MOVING TO"
                value={profile.moving_to_city}
                onChange={set('moving_to_city')}
                placeholder="San Francisco, Austin…"
                autoCapitalize="words"
                maxLength={48}
              />
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.fieldLabel}>TRAVEL STYLE</Text>
              <View style={styles.chips}>
                {TRAVEL_STYLES.map(ts => (
                  <Pressable
                    key={ts.key}
                    onPress={() => { haptics.selection(); set('travel_style')(profile.travel_style === ts.key ? '' : ts.key) }}
                    style={({ pressed }) => [
                      styles.chip,
                      profile.travel_style === ts.key && styles.chipSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.chipText, profile.travel_style === ts.key && styles.chipTextSelected]}>
                      {ts.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={save}
              disabled={!dirty || saving}
              style={({ pressed }) => [
                styles.saveBtn,
                (!dirty || saving) && styles.saveBtnDisabled,
                pressed && dirty && { opacity: 0.85 },
              ]}
            >
              {saving
                ? <ActivityIndicator color={colors.bg} />
                : (
                  <>
                    <Text style={styles.triangleOnRed}>{'▶'}</Text>
                    <Text style={styles.saveBtnText}>{dirty ? 'SAVE CHANGES' : 'SAVED'}</Text>
                  </>
                )
              }
            </Pressable>

            <View style={styles.moreSection}>
              <Text style={styles.sectionTitle}>MORE</Text>
              <Pressable
                onPress={() => { haptics.selection(); router.push('/(app)/profile/integrations') }}
                style={({ pressed }) => [styles.moreLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.moreLinkLabel}>INTEGRATIONS</Text>
                <Text style={styles.moreLinkChevron}>{'▸'}</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptics.selection(); router.push('/(app)/profile/history') }}
                style={({ pressed }) => [styles.moreLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.moreLinkLabel}>SESSION HISTORY</Text>
                <Text style={styles.moreLinkChevron}>{'▸'}</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptics.selection(); router.push('/(app)/settings') }}
                style={({ pressed }) => [styles.moreLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.moreLinkLabel}>SETTINGS</Text>
                <Text style={styles.moreLinkChevron}>{'▸'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.sectionDivider}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
    </View>
  )
}

function formatDepDate(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

function formatDepTime(iso: string): string | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function FieldLine({
  label, value, onChange, placeholder, maxLength,
  autoCapitalize, keyboardType, half = false, onFocus, onBlur,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: 'default' | 'number-pad'
  half?: boolean
  onFocus?: () => void
  onBlur?: () => void
}) {
  return (
    <View style={[styles.field, half && styles.fieldHalf]}>
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
  settingsLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  eyebrow: { color: colors.subtle },

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },
  passWrap: { marginTop: 12 },

  fields: { gap: 16 },
  fieldRow: { flexDirection: 'row', gap: 14 },
  field: { flex: 1 },
  fieldHalf: { flex: 1 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginBottom: 6,
  },
  fieldInput: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
    letterSpacing: 0.6,
  },
  fieldInputMulti: {
    fontFamily: fonts.serifItalic,
    fontSize: 17,
    lineHeight: 25,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  fieldLineRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,10,0.25)',
  },

  suggestions: {
    marginTop: 6,
    backgroundColor: colors.bg,
  },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  suggestionLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 1.4,
  },
  suggestionIata: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1.4,
  },

  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 18,
    gap: 6,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.subtle,
  },
  sectionHint: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
  },

  pickerSection: { gap: 10 },
  chipHint: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.subtle,
    opacity: 0.6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.bg,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginTop: 8,
  },
  saveBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  saveBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },

  error: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.error,
  },

  moreSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 18,
    gap: 0,
    marginTop: 14,
  },
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  moreLinkLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 1.4,
  },
  moreLinkChevron: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.subtle,
  },
})
