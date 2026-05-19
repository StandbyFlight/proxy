import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'
import { FlipBoard } from '../../../components/FlipBoard'

// Post-mutual reveal screen: shows the other user's first name, the point of
// connection, and the suggested meetup spot. Continue → meetup/setup.

type MutualData = {
  theirFirstName: string
  pointOfConnection: string
  suggestedLocation: string | null
}

export default function MutualScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<MutualData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        const { data: row, error: matchErr } = await supabase
          .from('matches')
          .select(`
            id, status, point_of_connection, suggested_meetup_location,
            session_id_a, session_id_b,
            session_a:sessions!session_id_a(user_id, users(first_name)),
            session_b:sessions!session_id_b(user_id, users(first_name))
          `)
          .eq('id', match_id)
          .single()
        if (matchErr) throw matchErr
        if (cancelled) return

        const sessA = Array.isArray(row.session_a) ? row.session_a[0] : row.session_a
        const sessB = Array.isArray(row.session_b) ? row.session_b[0] : row.session_b
        const iAmA = sessA?.user_id === session.user.id
        const theirSess = iAmA ? sessB : sessA
        const theirUser = theirSess?.users
          ? (Array.isArray(theirSess.users) ? theirSess.users[0] : theirSess.users)
          : null

        setData({
          theirFirstName: (theirUser as { first_name?: string } | null)?.first_name ?? '-',
          pointOfConnection: row.point_of_connection ?? 'You both said yes.',
          suggestedLocation: row.suggested_meetup_location ?? null,
        })
        haptics.standbyStamp()
      } catch (err: any) {
        setError(err.message ?? 'Could not load match.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [match_id])

  function proceed() {
    haptics.buttonTap()
    router.replace({ pathname: '/(app)/meetup', params: { match_id: String(match_id) } })
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[type.subhead, { color: colors.text, textAlign: 'center' }]}>{error}</Text>
      </View>
    )
  }

  if (!data) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.subtle} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Text style={[type.eyebrow, styles.eyebrow]}>MUTUAL</Text>
      </View>

      <View style={styles.body}>
        <Text style={[type.subhead, styles.subhead]}>You're both in.</Text>

        <View style={styles.nameWrap}>
          <FlipBoard
            label={data.theirFirstName.toUpperCase().slice(0, 14)}
            cellSize={30}
            initialFlipMs={500}
            staggerMs={90}
          />
        </View>

        <Text style={[type.headline, styles.reason]}>{data.pointOfConnection}</Text>

        {data.suggestedLocation ? (
          <View style={styles.locationBlock}>
            <Text style={styles.locationLabel}>SUGGESTED SPOT</Text>
            <Text style={styles.locationText}>{data.suggestedLocation}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={proceed}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.triangleOnRed}>{'▶'}</Text>
          <Text style={styles.primaryBtnText}>PICK A TIME</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topRow: { alignItems: 'center' },
  eyebrow: { color: colors.subtle },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  subhead: { color: colors.subtle, textAlign: 'center' },
  nameWrap: { alignItems: 'center', marginVertical: 8 },
  reason: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
  },
  locationBlock: { alignItems: 'center', gap: 6, marginTop: 8 },
  locationLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  locationText: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  footer: { paddingTop: 12, alignItems: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 200,
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
})
