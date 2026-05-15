import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'

export default function PostMeetupScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  async function respond(met: boolean) {
    setSaving(true)
    if (met) haptics.success()
    else haptics.selection()

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

    router.replace(met ? '/(app)/profile' : '/(app)/')
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => { haptics.buttonTap(); router.replace('/(app)/') }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <Text style={styles.eyebrow}>After</Text>
        <Text style={styles.headline}>Did you{'\n'}meet up?</Text>
        <Text style={styles.subhead}>Just between us, this helps us improve.</Text>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, saving && styles.disabled, pressed && { opacity: 0.85 }]}
            onPress={() => respond(true)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.primaryBtnText}>Yes, we met</Text>
            }
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, saving && styles.disabled, pressed && { opacity: 0.7 }]}
            onPress={() => respond(false)}
            disabled={saving}
          >
            <Text style={styles.secondaryBtnText}>No, it didn't work out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: { fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, letterSpacing: 1.4 },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  subhead: { ...type.subhead, color: colors.subtle, marginTop: 2 },
  actions: { gap: 12, marginTop: 16 },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bg,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  disabled: { opacity: 0.5 },
})
