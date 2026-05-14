import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { colors } from '../../lib/theme'
import { supabase } from '../../lib/supabase'
import { haptics } from '../../lib/haptics'

type MatchType = 'high_confidence' | 'curiosity' | null

type MatchData = {
  id: string
  status: string
  matchType: MatchType
  pointOfConnection: string | null
  mySessionId: string
  theirFirstName: string | null
  theirIndustry: string | null
  theirIntent: string
  theirPurpose: string | null
  destinationIata: string | null
  flightIata: string
}

const PURPOSE_LABEL: Record<string, string> = {
  conference: 'a conference',
  work_trip: 'a work trip',
  solo_travel: 'solo travel',
  relocating: 'relocating',
  other: 'travel',
}

const INTENT_LABEL: Record<string, string> = {
  professional: 'professional connections',
  social: 'social connections',
  open: 'open to anything',
}

function buildFallbackBlurb(theirIntent: string, theirPurpose: string | null, dest: string | null): string {
  const intentStr = INTENT_LABEL[theirIntent] ?? theirIntent
  const purposeStr = theirPurpose ? PURPOSE_LABEL[theirPurpose] ?? 'travel' : null
  const destStr = dest ? ` to ${dest}` : ''

  if (purposeStr) {
    return `Heading${destStr} for ${purposeStr}, open to ${intentStr}.`
  }
  return `Heading${destStr}, open to ${intentStr}.`
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
          id, status, match_type, point_of_connection, session_id_a, session_id_b,
          session_a:sessions!session_id_a(
            user_id, connection_intent, travel_purpose, destination_iata,
            flights(flight_iata),
            users(first_name, industry)
          ),
          session_b:sessions!session_id_b(
            user_id, connection_intent, travel_purpose, destination_iata,
            flights(flight_iata),
            users(first_name, industry)
          )
        `)
        .eq('id', match_id)
        .single()

      if (matchErr) throw matchErr

      const sessionA = Array.isArray(data.session_a) ? data.session_a[0] : data.session_a
      const sessionB = Array.isArray(data.session_b) ? data.session_b[0] : data.session_b
      const iAmA = sessionA?.user_id === session.user.id
      const theirSession = iAmA ? sessionB : sessionA

      const theirUser = Array.isArray(theirSession?.users) ? theirSession.users[0] : theirSession?.users
      const flight = Array.isArray(theirSession?.flights) ? theirSession.flights[0] : theirSession?.flights

      setMatch({
        id: data.id,
        status: data.status,
        matchType: data.match_type ?? null,
        pointOfConnection: data.point_of_connection ?? null,
        mySessionId: iAmA ? data.session_id_a : data.session_id_b,
        theirFirstName: theirUser?.first_name ?? null,
        theirIndustry: theirUser?.industry ?? null,
        theirIntent: theirSession?.connection_intent ?? 'open',
        theirPurpose: theirSession?.travel_purpose ?? null,
        destinationIata: theirSession?.destination_iata ?? null,
        flightIata: flight?.flight_iata ?? '',
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
    if (interested) haptics.success()
    else haptics.selection()
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

  const isCuriosity = match.matchType === 'curiosity'
  const fallbackBlurb = buildFallbackBlurb(match.theirIntent, match.theirPurpose, match.destinationIata)

  return (
    <View style={styles.container}>
      <View style={styles.inner}>

        {isCuriosity ? (
          <>
            <Text style={styles.eyebrow}>A curious match</Text>
            <Text style={styles.heading}>
              {match.theirFirstName ?? 'Someone'} is heading{match.destinationIata ? ` to ${match.destinationIata}` : ''} too.
            </Text>
            <Text style={styles.curiosityNote}>
              No obvious shared connection — but you're both here, and that's usually enough.
            </Text>
            {match.theirIndustry ? (
              <Text style={styles.detail}>Works in {match.theirIndustry}</Text>
            ) : null}
            <Text style={styles.detail}>{fallbackBlurb}</Text>
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>Your match</Text>
            {match.pointOfConnection ? (
              <Text style={styles.heading}>{match.pointOfConnection}</Text>
            ) : (
              <Text style={styles.heading}>{fallbackBlurb}</Text>
            )}
            {match.theirIndustry ? (
              <Text style={styles.detail}>Works in {match.theirIndustry}</Text>
            ) : null}
          </>
        )}

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
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subtle,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  curiosityNote: {
    fontSize: 15,
    color: colors.subtle,
    lineHeight: 22,
    marginTop: -8,
  },
  detail: {
    fontSize: 14,
    color: colors.subtle,
  },
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
