import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
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
  industry: string
  company: string
  school: string
  hometown: string
  career_stage: string
  travel_style: string
}

const EMPTY: Profile = {
  first_name: '', age: '', base_city: '', current_thinking: '',
  industry: '', company: '', school: '', hometown: '',
  career_stage: '', travel_style: '',
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

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [initial, setInitial] = useState<Profile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<CityEntry[]>([])
  const [cityFocused, setCityFocused] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data } = await supabase
        .from('users')
        .select('first_name, age, base_city, current_thinking, industry, company, school, hometown, career_stage, travel_style')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled || !data) { setLoading(false); return }
      const next: Profile = {
        first_name: data.first_name ?? '',
        age: data.age != null ? String(data.age) : '',
        base_city: data.base_city ?? '',
        current_thinking: data.current_thinking ?? '',
        industry: data.industry ?? '',
        company: data.company ?? '',
        school: data.school ?? '',
        hometown: data.hometown ?? '',
        career_stage: data.career_stage ?? '',
        travel_style: data.travel_style ?? '',
      }
      setProfile(next)
      setInitial(next)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

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

  const dirty = (Object.keys(profile) as (keyof Profile)[]).some(k => profile[k] !== initial[k])

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
        industry: profile.industry.trim() || null,
        company: profile.company.trim() || null,
        school: profile.school.trim() || null,
        hometown: profile.hometown.trim() || null,
        career_stage: profile.career_stage || null,
        travel_style: profile.travel_style || null,
      })
      .eq('id', session.user.id)

    setSaving(false)
    if (updateErr) { haptics.error(); setError(updateErr.message); return }
    haptics.success()
    setInitial(profile)
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
            onPress={() => { haptics.buttonTap(); router.back() }}
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
              Fill in over time — more signals means better matches.
            </Text>

            <View style={styles.passWrap}>
              <BoardingPass
                airline="STANDBY"
                classLabel="STANDBY PASS"
                passenger={profile.first_name || null}
                origin={iata}
                destination={null}
                flight={null}
                date={null}
                time={null}
                gate={null}
                terminal={null}
                seat={profile.industry ? profile.industry.toUpperCase().slice(0, 3) : null}
                stampSlot={profile.first_name ? <StandbyStamp label="STANDBY" /> : null}
              />
            </View>

            {/* ── Basic profile ─────────────────────────────────────────── */}
            <View style={styles.fields}>
              <FieldLine label="FIRST NAME" value={profile.first_name} onChange={set('first_name')}
                placeholder="ESTHER" autoCapitalize="characters" maxLength={20} />

              <View style={styles.fieldRow}>
                <FieldLine label="AGE" value={profile.age} onChange={set('age')}
                  placeholder="21" maxLength={2} keyboardType="number-pad" half />
                <FieldLine label="INDUSTRY" value={profile.industry} onChange={set('industry')}
                  placeholder="Tech" autoCapitalize="words" maxLength={32} half />
              </View>

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

            {/* ── Matching signals ──────────────────────────────────────── */}
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>MATCHING SIGNALS</Text>
              <Text style={styles.sectionHint}>
                Each field gives the algorithm one more reason to introduce you to someone specific.
              </Text>
            </View>

            <View style={styles.fields}>
              <View style={styles.fieldRow}>
                <FieldLine label="COMPANY" value={profile.company} onChange={set('company')}
                  placeholder="Acme Corp" autoCapitalize="words" maxLength={48} half />
                <FieldLine label="SCHOOL" value={profile.school} onChange={set('school')}
                  placeholder="MIT" autoCapitalize="words" maxLength={48} half />
              </View>

              <FieldLine label="HOMETOWN" value={profile.hometown} onChange={set('hometown')}
                placeholder="Memphis, TN" autoCapitalize="words" maxLength={48} />
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
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
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
})
