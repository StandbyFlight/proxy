import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../../lib/theme'
import { supabase } from '../../../lib/supabase'

// Smart redirect hub for active matches. Deep links from push notifications and
// home pills land here; we read the current match status and forward to the
// correct sub-screen. Never renders for more than a frame in the happy path.

export default function MatchRoom() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      if (!match_id) {
        router.replace('/(app)/match/searching')
        return
      }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/(auth)'); return }

        const { data: match } = await supabase
          .from('matches')
          .select('id, status, session_id_a, session_id_b, meetup_confirmed_at')
          .eq('id', match_id)
          .single()
        if (cancelled || !match) return

        if (match.status === 'pending_a' || match.status === 'pending_b') {
          router.replace({ pathname: '/(app)/match', params: { match_id: match.id } })
          return
        }
        if (match.status === 'mutual') {
          // previously branched on meetup_confirmed_at — both arms led here
          router.replace({ pathname: '/(app)/meetup', params: { match_id: match.id } })
          return
        }
        if (match.status === 'declined' || match.status === 'expired') {
          router.replace('/(app)/match/searching')
          return
        }
        router.replace({ pathname: '/(app)/match', params: { match_id: match.id } })
      } catch {
        if (!cancelled) router.replace('/(app)/match/searching')
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [match_id])

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.subtle} />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
})
