import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { completeMatchAndSession } from '../../lib/session'
import { BackButton } from '../../components/BackButton'

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
    if (!session) { Alert.alert('Session not found'); router.replace('/(app)/'); return }

    const { data: match } = await supabase
      .from('matches')
      .select('session_id_a, session_id_b, session_a:sessions!session_id_a(user_id)')
      .eq('id', match_id)
      .single()

    if (match) {
      const sessionA = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
      const iAmA = sessionA?.user_id === session.user.id
      const update = iAmA ? { user_a_met_confirmed: met } : { user_b_met_confirmed: met }
      await supabase.from('matches').update(update).eq('id', match_id)

      if (!met) {
        await supabase
          .from('matches')
          .update({ status: 'declined' })
          .eq('id', match_id)
      } else {
        // "We met" is a terminal outcome too — drive the match/session to
        // completed so a match that reached here still mutual doesn't re-enter
        // the active flow. completeMatchAndSession guards the match update on
        // status='mutual', so an already-completed match is a safe no-op.
        const mySessionId = iAmA ? match.session_id_a : match.session_id_b
        if (mySessionId) {
          await completeMatchAndSession(match_id, mySessionId)
        }
      }
    }

    router.replace(met ? '/(app)/profile' : '/(app)/')
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={() => router.replace('/(app)/')} />

        <Text style={styles.headline}>Did you{'\n'}meet up?</Text>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, saving && styles.disabled, pressed && { opacity: 0.85 }]}
            onPress={() => respond(true)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.onAccent} />
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
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  actions: { gap: 12, marginTop: 16 },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.onAccent,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text,
  },
  disabled: { opacity: 0.5 },
})
