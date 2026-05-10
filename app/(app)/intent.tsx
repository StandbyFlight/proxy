import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../lib/theme'

const INTENTS = [
  { key: 'professional', label: 'Professional', desc: 'Career-adjacent connections' },
  { key: 'social', label: 'Social', desc: 'Travel companions, shared interests' },
  { key: 'open', label: 'Open to anything', desc: 'Let the app decide' },
] as const

const PURPOSES = [
  { key: 'conference', label: 'Conference / industry event' },
  { key: 'work_trip', label: 'Work trip' },
  { key: 'solo_travel', label: 'Solo travel / leisure' },
  { key: 'relocating', label: 'Relocating' },
  { key: 'other', label: 'Other' },
] as const

type Intent = typeof INTENTS[number]['key']
type Purpose = typeof PURPOSES[number]['key']

export default function IntentScreen() {
  const { flight } = useLocalSearchParams<{ flight: string }>()
  const [intent, setIntent] = useState<Intent | null>(null)
  const [purpose, setPurpose] = useState<Purpose | null>(null)
  const router = useRouter()

  const showPurpose = intent === 'professional' || intent === 'social'
  const canContinue = intent !== null && (!showPurpose || purpose !== null)

  function proceed() {
    router.replace('/(app)/')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.heading}>What are you{'\n'}open to?</Text>

      <View style={styles.section}>
        {INTENTS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.option, intent === item.key && styles.optionSelected]}
            onPress={() => { setIntent(item.key); setPurpose(null) }}
          >
            <Text style={[styles.optionLabel, intent === item.key && styles.optionLabelSelected]}>
              {item.label}
            </Text>
            <Text style={[styles.optionDesc, intent === item.key && styles.optionDescSelected]}>
              {item.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {showPurpose && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What brings you here?</Text>
          {PURPOSES.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.option, purpose === item.key && styles.optionSelected]}
              onPress={() => setPurpose(item.key)}
            >
              <Text style={[styles.optionLabel, purpose === item.key && styles.optionLabelSelected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, !canContinue && styles.buttonDisabled]}
        onPress={proceed}
        disabled={!canContinue}
      >
        <Text style={styles.buttonText}>Find someone</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40, gap: 24 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
    gap: 4,
  },
  optionSelected: { borderColor: colors.text, backgroundColor: colors.text },
  optionLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  optionLabelSelected: { color: colors.bg },
  optionDesc: { fontSize: 13, color: colors.subtle },
  optionDescSelected: { color: 'rgba(249,248,246,0.65)' },
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
