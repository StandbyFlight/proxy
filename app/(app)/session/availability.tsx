import { useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, flightChannelName } from '../../../lib/ably'
import { BackButton } from '../../../components/BackButton'

// Final confirmation. One line, one button. Tapping enters Ably presence and
// starts the search — until then the user is invisible to the pool.

export default function AvailabilityScreen() {
  const params = useLocalSearchParams<{
    flight_iata: string
    departure_time: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signal() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const departureDate = params.departure_time
        ? params.departure_time.split('T')[0]
        : new Date().toISOString().split('T')[0]

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(flightChannelName(params.flight_iata, departureDate))
      await channel.presence
        .enter({ checked_in_at: new Date().toISOString() })
        .catch(() => {}) // presence is informational — don't block on it

      haptics.standbyStamp()
      router.replace('/(app)/match/searching')
    } catch (err: any) {
      haptics.error()
      setError(err.message ?? 'Could not go on standby. Try again.')
      setLoading(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <BackButton />
        <Text style={[type.eyebrow, styles.eyebrow]}>SESSION · READY</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>
          Ready to meet someone?
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Pressable
          onPress={signal}
          disabled={loading}
          style={({ pressed }) => [
            styles.primaryBtn,
            loading && styles.primaryBtnDisabled,
            pressed && !loading && { opacity: 0.85 },
          ]}
        >
          {loading
            ? <ActivityIndicator color={colors.onAccent} />
            : (
              <>
                <Text style={styles.primaryBtnText}>GO ON STANDBY</Text>
              </>
            )
          }
        </Pressable>
        <Text style={styles.privacyNote}>
          NO NAME · NO PHOTO · NO PROFILE SHARED YET
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
  },
  headline: { color: colors.text },

  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
  },

  footer: { gap: 12, paddingTop: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
  },
  primaryBtnDisabled: { backgroundColor: colors.text, opacity: 0.4 },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.onAccent,
  },
  privacyNote: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    textAlign: 'center',
  },
})
