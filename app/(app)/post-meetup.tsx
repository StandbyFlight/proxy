import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

export default function PostMeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function respond(met: boolean) {
    setSaving(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/(app)/'); return }

    const { data: match } = await supabase
      .from('matches')
      .select('session_id_a, session_a:sessions!session_id_a(user_id)')
      .eq('id', match_id)
      .single()

    if (match) {
      const sessionA = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
      const iAmA = sessionA?.user_id === session.user.id
      const update = iAmA ? { user_a_met_confirmed: met } : { user_b_met_confirmed: met }
      await supabase.from('matches').update(update).eq('id', match_id)
    }

    router.replace('/(app)/')
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.heading}>Did you meet up?</Text>
        <Text style={styles.sub}>Just between us — this helps us improve.</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.yes, saving && styles.disabled]}
            onPress={() => respond(true)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.yesText}>Yes, we met</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.no, saving && styles.disabled]}
            onPress={() => respond(false)}
            disabled={saving}
          >
            <Text style={styles.noText}>No, it didn't work out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.subtle, marginTop: -12 },
  actions: { gap: 12, marginTop: 8 },
  yes: { backgroundColor: colors.text, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  yesText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  no: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  noText: { color: colors.subtle, fontSize: 16 },
  disabled: { opacity: 0.5 },
})
