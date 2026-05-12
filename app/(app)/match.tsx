import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'

type MatchData = {
  id: string
  status: string
  mySessionId: string
  theirIntent: string
  theirPurpose: string | null
  flightIata: string
  destinationIata: string | null
}

const INTENT_LABEL: Record<string, string> = {
  professional: 'professional connections',
  social: 'social connections',
  open: 'open to anything',
}

const PURPOSE_LABEL: Record<string, string> = {
  conference: 'a conference',
  work_trip: 'a work trip',
  solo_travel: 'solo travel',
  relocating: 'relocating',
  other: 'travel',
}

function buildBlurb(theirIntent: string, theirPurpose: string | null, dest: string | null): string {
  const intentStr = INTENT_LABEL[theirIntent] ?? theirIntent
  const purposeStr = theirPurpose ? PURPOSE_LABEL[theirPurpose] ?? 'travel' : null
  const destStr = dest ? ` to ${dest}` : ''

  if (purposeStr) {
    return `They're heading${destStr} for ${purposeStr} and open to ${intentStr}.`
  }
  return `They're heading${destStr} and open to ${intentStr}.`
}

export default function MatchScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadMatch()
  }, [match_id])

  async function loadMatch() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error: matchErr } = await supabase
        .from('matches')
        .select(`
          id, status, session_id_a, session_id_b,
          session_a:sessions!session_id_a(user_id, connection_intent, travel_purpose, flights(flight_iata, destination_iata)),
          session_b:sessions!session_id_b(user_id, connection_intent, travel_purpose, flights(flight_iata, destination_iata))
        `)
        .eq('id', match_id)
        .single()

      if (matchErr) throw matchErr

      const sessionA = Array.isArray(data.session_a) ? data.session_a[0] : data.session_a
      const sessionB = Array.isArray(data.session_b) ? data.session_b[0] : data.session_b
      const iAmA = sessionA?.user_id === session.user.id
      const theirSession = iAmA ? sessionB : sessionA
      const flight = Array.isArray(theirSession?.flights) ? theirSession.flights[0] : theirSession?.flights

      setMatch({
        id: data.id,
        status: data.status,
        mySessionId: iAmA ? data.session_id_a : data.session_id_b,
        theirIntent: theirSession?.connection_intent ?? 'open',
        theirPurpose: theirSession?.travel_purpose ?? null,
        flightIata: flight?.flight_iata ?? '',
        destinationIata: flight?.destination_iata ?? null,
      })
    } catch (err: any) {
      setError(err.message ?? 'Could not load match.')
    } finally {
      setLoading(false)
    }
  }

  async function respond(interested: boolean) {
    if (!match) return
    setActing(true)
    await supabase
      .from('matches')
      .update({ status: interested ? 'accepted' : 'declined' })
      .eq('id', match.id)

    if (interested) {
      router.replace({ pathname: '/(app)/meetup', params: { match_id: match.id } })
    } else {
      router.replace('/(app)/')
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.subtle} />
      </View>
    )
  }

  if (error || !match) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Match not found.'}</Text>
        <TouchableOpacity onPress={() => router.replace('/(app)/')}>
          <Text style={styles.link}>Go home</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const blurb = buildBlurb(match.theirIntent, match.theirPurpose, match.destinationIata)

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.label}>Your connection</Text>
        <Text style={styles.flight}>{match.flightIata}</Text>
        <Text style={styles.blurb}>{blurb}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.accept, acting && styles.disabled]}
            onPress={() => respond(true)}
            disabled={acting}
          >
            {acting
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.acceptText}>I'm interested</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.decline, acting && styles.disabled]}
            onPress={() => respond(false)}
            disabled={acting}
          >
            <Text style={styles.declineText}>Not for me</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          Their name won't be shared until you both say yes.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 16 },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 24 },
  label: { fontSize: 12, fontWeight: '600', color: colors.subtle, letterSpacing: 1, textTransform: 'uppercase' },
  flight: { fontSize: 15, fontWeight: '600', color: colors.subtle, marginBottom: -16 },
  blurb: { fontSize: 26, fontWeight: '600', color: colors.text, lineHeight: 34, letterSpacing: -0.3 },
  actions: { gap: 12, marginTop: 8 },
  accept: { backgroundColor: colors.text, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  acceptText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  decline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  declineText: { color: colors.subtle, fontSize: 16 },
  disabled: { opacity: 0.5 },
  note: { fontSize: 13, color: colors.subtle, textAlign: 'center', lineHeight: 19 },
  error: { fontSize: 15, color: colors.error },
  link: { fontSize: 14, color: colors.subtle, textDecorationLine: 'underline' },
})
