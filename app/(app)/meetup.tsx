import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'

const SLOTS = [
  { key: 'before', label: 'Before boarding', desc: 'Near your gate, ~45 min before departure' },
  { key: 'after', label: 'After landing', desc: 'Baggage claim, ~20 min after arrival' },
]

export default function MeetupScreen() {
  const [wearing, setWearing] = useState('')
  const [slot, setSlot] = useState<string | null>(null)
  const router = useRouter()

  const canConfirm = wearing.trim().length > 0 && slot !== null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <Text style={styles.heading}>Let's set a time</Text>
      <Text style={styles.sub}>Pick a time and help them find you.</Text>

      <View style={styles.section}>
        <Text style={styles.label}>What are you wearing?</Text>
        <TextInput
          style={styles.input}
          placeholder="Navy puffer, red backpack"
          placeholderTextColor={colors.subtle}
          value={wearing}
          onChangeText={setWearing}
          maxLength={80}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>When do you want to meet?</Text>
        {SLOTS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.slot, slot === s.key && styles.slotSelected]}
            onPress={() => setSlot(s.key)}
          >
            <Text style={[styles.slotLabel, slot === s.key && styles.slotLabelSelected]}>
              {s.label}
            </Text>
            <Text style={[styles.slotDesc, slot === s.key && styles.slotDescSelected]}>
              {s.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, !canConfirm && styles.buttonDisabled]}
        onPress={() => router.replace('/(app)/')}
        disabled={!canConfirm}
      >
        <Text style={styles.buttonText}>Confirm meetup</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40, gap: 28 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.subtle, marginTop: -16 },
  section: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.subtle, letterSpacing: 0.3, textTransform: 'uppercase' },
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
  slot: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: colors.surface,
    gap: 4,
  },
  slotSelected: { borderColor: colors.text, backgroundColor: colors.text },
  slotLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  slotLabelSelected: { color: colors.bg },
  slotDesc: { fontSize: 13, color: colors.subtle },
  slotDescSelected: { color: 'rgba(249,248,246,0.65)' },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
})
