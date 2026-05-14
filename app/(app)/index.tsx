import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { getAblyClient, userChannelName, disconnectAbly } from '../../lib/ably'
import type Ably from 'ably'

type ScreenState = 'searching' | 'curiosity' | 'exhausted'

interface CuriosityData {
  match_id: string
  winning_signal: string | null
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
    haptics.selection()
    try {
      await supabase
        .from('matches')
        .update({ status: 'declined' })
        .eq('id', curiosity.match_id)
    } catch (_) {}
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
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.inner}>
        <Text style={styles.wordmark}>proxy</Text>

        {state === 'searching' && (
          <View style={styles.statusBlock}>
            <Text style={styles.headline}>Looking for someone{'\n'}worth meeting.</Text>
            <Text style={styles.subhead}>We'll let you know when we find a match.</Text>
          </View>
        )}

        {state === 'curiosity' && curiosity && (
          <View style={styles.curiosityCard}>
            <Text style={styles.curiosityEyebrow}>Someone interesting</Text>
            <Text style={styles.curiositySignal}>
              {curiosity.winning_signal ?? 'No obvious overlap — but you never know.'}
            </Text>

            <View style={styles.curiosityActions}>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={() => {
                  haptics.buttonTap()
                  router.push({ pathname: '/(app)/match', params: { match_id: curiosity.match_id } })
                }}
              >
                <Text style={styles.primaryBtnText}>Sure, why not  →</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
                onPress={keepLooking}
                disabled={dismissing}
              >
                {dismissing
                  ? <ActivityIndicator color={colors.subtle} />
                  : <Text style={styles.secondaryBtnText}>Keep looking</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

        {state === 'exhausted' && (
          <View style={styles.statusBlock}>
            <Text style={styles.headline}>No more matches{'\n'}right now.</Text>
            <Text style={styles.subhead}>
              You've seen everyone available in your area.
              Check back closer to boarding — more people check in over time.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => { haptics.selection(); router.push('/(app)/flight') }}
          hitSlop={12}
        >
          <Text style={styles.footerLink}>Change flight</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={signOut} hitSlop={12}>
          <Text style={styles.footerLink}>Sign out</Text>
        </Pressable>
        <Text style={styles.footerDivider}>·</Text>
        <Pressable onPress={() => router.push('/(app)/dev')} hitSlop={12}>
          <Text style={styles.footerLink}>Dev</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  inner: { flex: 1, justifyContent: 'center', gap: 24 },
  wordmark: {
    fontFamily: fonts.serifBold,
    fontSize: 38,
    letterSpacing: -1,
    color: colors.text,
    marginBottom: 8,
  },
  statusBlock: { gap: 10 },
  headline: { ...type.headline, color: colors.text },
  subhead: { ...type.subhead, color: colors.subtle },
  curiosityCard: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    backgroundColor: colors.surface,
    gap: 16,
  },
  curiosityEyebrow: { ...type.eyebrow, color: colors.subtle },
  curiositySignal: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  curiosityActions: { gap: 10 },
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
  footerLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  footerDivider: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.border,
  },
})
