import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

const SLOTS = [
  { key: 'before', label: 'Before boarding', desc: 'Near your gate, ~45 min before departure' },
  { key: 'after', label: 'After landing', desc: 'Baggage claim, ~20 min after arrival' },
]

export default function MeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [wearing, setWearing] = useState('')
  const [slot, setSlot] = useState<string | null>(null)
  const [iAmA, setIAmA] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const canConfirm = wearing.trim().length > 0 && slot !== null

  useEffect(() => {
    async function loadSide() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: match } = await supabase
        .from('matches')
        .select('session_id_a, session_a:sessions!session_id_a(user_id)')
        .eq('id', match_id)
        .single()

      if (!match) return
      const sessionA = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
      setIAmA(sessionA?.user_id === session.user.id)
    }
    loadSide()
  }, [match_id])

  async function confirm() {
    if (!canConfirm || iAmA === null) return
    setSaving(true)

    const update = iAmA
      ? { wearing_a: wearing.trim() }
      : { wearing_b: wearing.trim() }

    await supabase.from('matches').update(update).eq('id', match_id)

    router.replace({ pathname: '/(app)/post-meetup', params: { match_id } })
  }

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
        style={[styles.button, (!canConfirm || saving) && styles.buttonDisabled]}
        onPress={confirm}
        disabled={!canConfirm || saving}
      >
        {saving
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.buttonText}>Confirm meetup</Text>
        }
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
