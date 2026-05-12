import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { getAblyClient, userChannelName, disconnectAbly } from '../../lib/ably'
import type Ably from 'ably'

export default function HomeScreen() {
  const router = useRouter()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  useEffect(() => {
    let cancelled = false

    async function subscribeToMatches() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(userChannelName(session.user.id))
      channelRef.current = channel

      channel.subscribe('match.created', (msg) => {
        const { match_id } = msg.data as { match_id: string }
        router.push({ pathname: '/(app)/match', params: { match_id } })
      })
    }

    subscribeToMatches()

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [])

  async function signOut() {
    channelRef.current?.unsubscribe()
    channelRef.current = null
    disconnectAbly()
    await supabase.auth.signOut()
    router.replace('/(auth)')
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.wordmark}>proxy</Text>
        <View style={styles.status}>
          <Text style={styles.statusText}>Looking for someone on your flight.</Text>
          <Text style={styles.statusSub}>We'll let you know when we find a match.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/flight')}>
          <Text style={styles.link}>Change flight</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.footerText}>Sign out</Text>
        </TouchableOpacity>
        <Text style={styles.footerDivider}>·</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/dev')}>
          <Text style={styles.footerText}>Dev</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 16 },
  wordmark: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -1, marginBottom: 24 },
  status: { gap: 8 },
  statusText: { fontSize: 22, fontWeight: '600', color: colors.text, letterSpacing: -0.3 },
  statusSub: { fontSize: 16, color: colors.subtle },
  link: { fontSize: 15, color: colors.subtle, textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 48, gap: 8 },
  footerText: { fontSize: 14, color: colors.subtle },
  footerDivider: { fontSize: 14, color: colors.border },
})
