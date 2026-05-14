import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

const CAREER_STAGES = [
  { key: 'student', label: 'Student' },
  { key: 'early', label: 'Early career (0–3 yrs)' },
  { key: 'mid', label: 'Mid career (3–8 yrs)' },
  { key: 'senior', label: 'Senior (8+ yrs)' },
  { key: 'founder', label: 'Founder / entrepreneur' },
  { key: 'executive', label: 'Executive' },
]

const TRAVEL_STYLES = [
  { key: 'planner', label: 'I plan everything' },
  { key: 'balanced', label: 'Somewhere in between' },
  { key: 'spontaneous', label: 'Fully spontaneous' },
]

type Step = 1 | 2 | 3

export default function ProfileSetup() {
  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [firstName, setFirstName] = useState('')
  const [city, setCity] = useState('')
  const [age, setAge] = useState('')

  // Step 2
  const [currentThinking, setCurrentThinking] = useState('')

  // Step 3
  const [industry, setIndustry] = useState('')
  const [company, setCompany] = useState('')
  const [school, setSchool] = useState('')
  const [hometown, setHometown] = useState('')
  const [careerStage, setCareerStage] = useState<string | null>(null)
  const [travelStyle, setTravelStyle] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const step1Valid = firstName.trim().length > 0 && city.trim().length > 0
  const step2Valid = currentThinking.trim().length > 0

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
      current_thinking: currentThinking.trim(),
      industry: industry.trim() || null,
      company: company.trim() || null,
      school: school.trim() || null,
      hometown: hometown.trim() || null,
      career_stage: careerStage,
      travel_style: travelStyle,
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
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {([1, 2, 3] as Step[]).map(s => (
          <View
            key={s}
            style={[styles.progressSegment, step >= s && styles.progressSegmentActive]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {step === 1 && (
          <>
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

            <TouchableOpacity
              style={[styles.button, !step1Valid && styles.buttonDisabled]}
              onPress={() => setStep(2)}
              disabled={!step1Valid}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.heading}>What's on your mind?</Text>
            <Text style={styles.sub}>
              This is the single most useful thing you can share.
              What have you been nerding out about, thinking through, or working on lately?
            </Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="I've been obsessed with how cities actually get built — zoning, financing, the whole thing."
              placeholderTextColor={colors.subtle}
              value={currentThinking}
              onChangeText={setCurrentThinking}
              multiline
              maxLength={200}
              autoFocus
            />
            <Text style={styles.charCount}>{currentThinking.length}/200</Text>

            <TouchableOpacity
              style={[styles.button, !step2Valid && styles.buttonDisabled]}
              onPress={() => setStep(3)}
              disabled={!step2Valid}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.heading}>Your background</Text>
            <Text style={styles.sub}>
              All optional — each field gives us more ways to find you a match worth meeting.
            </Text>

            <View style={styles.fields}>
              <View>
                <Text style={styles.label}>Industry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Venture capital, healthcare, design..."
                  placeholderTextColor={colors.subtle}
                  value={industry}
                  onChangeText={setIndustry}
                />
              </View>

              <View>
                <Text style={styles.label}>Company</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Where do you work?"
                  placeholderTextColor={colors.subtle}
                  value={company}
                  onChangeText={setCompany}
                />
              </View>

              <View>
                <Text style={styles.label}>School</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Where did you study?"
                  placeholderTextColor={colors.subtle}
                  value={school}
                  onChangeText={setSchool}
                />
              </View>

              <View>
                <Text style={styles.label}>Hometown</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Where did you grow up?"
                  placeholderTextColor={colors.subtle}
                  value={hometown}
                  onChangeText={setHometown}
                />
              </View>

              <View>
                <Text style={styles.label}>Career stage <Text style={styles.optional}>optional</Text></Text>
                <View style={styles.chips}>
                  {CAREER_STAGES.map(s => (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.chip, careerStage === s.key && styles.chipSelected]}
                      onPress={() => setCareerStage(careerStage === s.key ? null : s.key)}
                    >
                      <Text style={[styles.chipText, careerStage === s.key && styles.chipTextSelected]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.label}>Travel style <Text style={styles.optional}>optional</Text></Text>
                <View style={styles.chips}>
                  {TRAVEL_STYLES.map(s => (
                    <TouchableOpacity
                      key={s.key}
                      style={[styles.chip, travelStyle === s.key && styles.chipSelected]}
                      onPress={() => setTravelStyle(travelStyle === s.key ? null : s.key)}
                    >
                      <Text style={[styles.chipText, travelStyle === s.key && styles.chipTextSelected]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={save}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.buttonText}>Find my match</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(2)}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 28,
    paddingTop: 60,
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressSegmentActive: { backgroundColor: colors.text },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48, gap: 24 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: colors.subtle, lineHeight: 22, marginTop: -12 },
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
  textArea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 14 },
  charCount: { fontSize: 12, color: colors.subtle, textAlign: 'right', marginTop: -16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.bg },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  back: { fontSize: 14, color: colors.subtle, textAlign: 'center' },
  error: { fontSize: 14, color: colors.error },
})
