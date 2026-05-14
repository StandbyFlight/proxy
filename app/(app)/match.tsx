import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'

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

  if (purposeStr) return `Heading${destStr} for ${purposeStr}, open to ${intentStr}.`
  return `Heading${destStr}, open to ${intentStr}.`
}

export default function MatchScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => { loadMatch() }, [match_id])

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
        <Text style={styles.errorText}>{error || 'Match not found.'}</Text>
        <Pressable onPress={() => router.replace('/(app)/')} hitSlop={12}>
          <Text style={styles.linkText}>Go home</Text>
        </Pressable>
      </View>
    )
  }

  const isCuriosity = match.matchType === 'curiosity'
  const fallbackBlurb = buildFallbackBlurb(match.theirIntent, match.theirPurpose, match.destinationIata)

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 32) }]}>
      <View style={styles.inner}>

        {isCuriosity ? (
          <>
            <Text style={styles.eyebrow}>A curious match</Text>
            <Text style={styles.headline}>
              {match.theirFirstName ?? 'Someone'} is heading
              {match.destinationIata ? ` to ${match.destinationIata}` : ''} too.
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
            <Text style={styles.headline}>
              {match.pointOfConnection ?? fallbackBlurb}
            </Text>
            {match.theirIndustry ? (
              <Text style={styles.detail}>Works in {match.theirIndustry}</Text>
            ) : null}
          </>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, acting && styles.disabled, pressed && { opacity: 0.85 }]}
            onPress={() => respond(true)}
            disabled={acting}
          >
            {acting
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.primaryBtnText}>I'm interested  →</Text>
            }
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, acting && styles.disabled, pressed && { opacity: 0.7 }]}
            onPress={() => respond(false)}
            disabled={acting}
          >
            <Text style={styles.secondaryBtnText}>Not for me</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Their name won't be shared until you both say yes.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 16 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 20 },
  eyebrow: { ...type.eyebrow, color: colors.subtle },
  headline: { ...type.headline, color: colors.text, marginTop: 4 },
  curiosityNote: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: colors.subtle,
    lineHeight: 23,
    marginTop: -8,
  },
  detail: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.subtle,
    lineHeight: 22,
  },
  actions: { gap: 12, marginTop: 8 },
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
  disabled: { opacity: 0.5 },
  note: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.subtle,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorText: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.error,
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.subtle,
    textDecorationLine: 'underline',
  },
})
