import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { getAblyClient, userChannelName, disconnectAbly } from '../../lib/ably'
import { haptics } from '../../lib/haptics'
import type Ably from 'ably'

type ScreenState = 'searching' | 'curiosity' | 'exhausted'

interface CuriosityData {
  match_id: string
  winning_signal: string | null
}

export default function HomeScreen() {
  const router = useRouter()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  const [state, setState] = useState<ScreenState>('searching')
  const [curiosity, setCuriosity] = useState<CuriosityData | null>(null)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(userChannelName(session.user.id))
      channelRef.current = channel

      channel.subscribe('match.created', (msg) => {
        const { match_id } = msg.data as { match_id: string }
        router.push({ pathname: '/(app)/match', params: { match_id } })
      })

      channel.subscribe('curiosity.match', (msg) => {
        const { match_id, winning_signal } = msg.data as { match_id: string; winning_signal: string | null }
        setCuriosity({ match_id, winning_signal })
        setState('curiosity')
      })

      channel.subscribe('pool.exhausted', () => {
        setState('exhausted')
        setCuriosity(null)
      })
    }

    subscribe()

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [])

  async function keepLooking() {
    if (!curiosity) return
    setDismissing(true)
    try {
      await supabase
        .from('matches')
        .update({ status: 'declined' })
        .eq('id', curiosity.match_id)
    } catch (_) {
      // best-effort — pg_cron uses created_at cooldown as fallback
    }
    setCuriosity(null)
    setState('searching')
    setDismissing(false)
  }

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

        {state === 'searching' && (
          <View style={styles.statusBlock}>
            <Text style={styles.statusHeading}>Looking for someone{'\n'}worth meeting.</Text>
            <Text style={styles.statusSub}>We'll let you know when we find a match.</Text>
          </View>
        )}

        {state === 'curiosity' && curiosity && (
          <View style={styles.curiosityCard}>
            <Text style={styles.curiosityEyebrow}>Someone interesting</Text>
            {curiosity.winning_signal ? (
              <Text style={styles.curiositySignal}>{curiosity.winning_signal}</Text>
            ) : (
              <Text style={styles.curiositySignal}>No obvious overlap — but you never know.</Text>
            )}

            <View style={styles.curiosityActions}>
              <TouchableOpacity
                style={styles.sureButton}
                onPress={() => { haptics.buttonTap(); router.push({ pathname: '/(app)/match', params: { match_id: curiosity.match_id } }) }}
              >
                <Text style={styles.sureButtonText}>Sure why not →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keepLookingButton}
                onPress={() => { haptics.selection(); keepLooking() }}
                disabled={dismissing}
              >
                {dismissing
                  ? <ActivityIndicator color={colors.subtle} />
                  : <Text style={styles.keepLookingText}>Keep looking</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state === 'exhausted' && (
          <View style={styles.statusBlock}>
            <Text style={styles.statusHeading}>No more matches{'\n'}right now.</Text>
            <Text style={styles.statusSub}>
              You've seen everyone available in your area.
              Check back closer to boarding — more people check in over time.
            </Text>
          </View>
        )}

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
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  wordmark: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -1, marginBottom: 16 },

  statusBlock: { gap: 10 },
  statusHeading: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5, lineHeight: 34 },
  statusSub: { fontSize: 15, color: colors.subtle, lineHeight: 22 },

  curiosityCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    backgroundColor: colors.surface,
    gap: 14,
  },
  curiosityEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  curiositySignal: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  curiosityActions: { gap: 10, marginTop: 4 },
  sureButton: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sureButtonText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  keepLookingButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  keepLookingText: { color: colors.subtle, fontSize: 15, fontWeight: '500' },

  link: { fontSize: 15, color: colors.subtle, textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 48, gap: 8 },
  footerText: { fontSize: 14, color: colors.subtle },
  footerDivider: { fontSize: 14, color: colors.border },
})
