import { useState } from 'react'
import {
  View, Text, StyleSheet,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, flightChannelName } from '../../../lib/ably'
import { BackButton } from '../../../components/BackButton'
import { Screen, GlassButton } from '../../../components/ui'

// Final confirmation. One line, one button. Tapping enters Ably presence and
// starts the search — until then the user is invisible to the pool.

export default function AvailabilityScreen() {
  const params = useLocalSearchParams<{
    flight_iata: string
    departure_time: string
  }>()
  const router = useRouter()
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
    <Screen>
      <View style={styles.topRow}>
        <BackButton />
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>
          Ready to meet someone?
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GlassButton
          label="GO ON STANDBY"
          onPress={signal}
          disabled={loading}
          loading={loading}
          variant="primary"
          size="lg"
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
})
