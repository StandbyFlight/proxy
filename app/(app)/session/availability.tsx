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

// Step 5 (solo track) of session setup: the explicit "I'm open to meeting
// someone" gate. Tapping enters Ably presence, which triggers match generation
// on the server. Until this tap, the user is invisible to the pool.

export default function AvailabilityScreen() {
  const params = useLocalSearchParams<{
    flight_id: string
    flight_iata: string
    origin_iata: string
    departure_time: string
    intent: string
    travel_purpose?: string
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
      await channel.presence.enter({
        intent: params.intent ?? 'open',
        travel_purpose: params.travel_purpose ?? null,
        checked_in_at: new Date().toISOString(),
      }).catch(() => {})

      haptics.standbyStamp()
      router.replace('/(app)/match/searching')
    } catch (err: any) {
      haptics.error()
      setError(err.message ?? 'Could not signal availability. Try again.')
      setLoading(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={[type.eyebrow, styles.eyebrow]}>SESSION · READY</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>One last yes.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          The room doesn't see you until you say so. Tap below and we'll start looking for someone worth your forty-five minutes.
        </Text>

        {params.origin_iata ? (
          <Text style={styles.tag}>
            {params.origin_iata}
            {params.flight_iata ? `  ·  ${params.flight_iata}` : ''}
          </Text>
        ) : null}

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
            ? <ActivityIndicator color={colors.bg} />
            : (
              <>
                <Text style={styles.triangleOnRed}>{'▶'}</Text>
                <Text style={styles.primaryBtnText}>I'M OPEN TO MEETING SOMEONE</Text>
              </>
            )
          }
        </Pressable>
        <Text style={styles.privacyNote}>
          NO NAME · NO PHOTO · NO PROFILE SHARED YET.
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
  },
  headline: { color: colors.text },
  subhead: { color: colors.subtle },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
    marginTop: 4,
  },

  error: {
    fontFamily: fonts.serifItalic,
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
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
  privacyNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    textAlign: 'center',
  },
})
