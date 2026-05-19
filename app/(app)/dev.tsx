import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

type UserInfo = {
  id: string
  first_name: string | null
  base_city: string | null
  phone: string | null
  trust_score: number
}

export default function DevScreen() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const router = useRouter()

  useEffect(() => {
    loadInfo()
  }, [])

  async function loadInfo() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [{ data: user }, { count }] = await Promise.all([
      supabase.from('users').select('*').eq('id', session.user.id).single(),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
    ])

    setUserInfo(user)
    setSessionCount(count ?? 0)
  }

  async function resetProfile() {
    Alert.alert(
      'Reset profile',
      'Deletes your profile row. Next login will go through profile setup again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive', onPress: async () => {
            setLoading(true)
            setStatus('')
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('users').delete().eq('id', session.user.id)
            setStatus('Profile deleted.')
            setUserInfo(null)
            setLoading(false)
          }
        }
      ]
    )
  }

  async function clearSessions() {
    Alert.alert(
      'Clear sessions',
      'Deletes all your flight sessions. You can enter a new flight after.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive', onPress: async () => {
            setLoading(true)
            setStatus('')
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            await supabase.from('sessions').delete().eq('user_id', session.user.id)
            setStatus('Sessions cleared.')
            setSessionCount(0)
            setLoading(false)
          }
        }
      ]
    )
  }

  async function fullWipe() {
    Alert.alert(
      'Full wipe + sign out',
      'Deletes your profile and all sessions, then signs you out. You\'ll start completely fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe everything', style: 'destructive', onPress: async () => {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const id = session.user.id
            await supabase.from('sessions').delete().eq('user_id', id)
            await supabase.from('users').delete().eq('id', id)
            await supabase.auth.signOut()
            router.replace('/(auth)')
          }
        }
      ]
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <TouchableOpacity onPress={() => {
        if (router.canGoBack()) router.back()
        else router.replace('/(app)/settings')
      }}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>DEV ONLY · remove before launch</Text>
      </View>

      <Text style={styles.heading}>Account</Text>

      <View style={styles.card}>
        {userInfo ? (
          <>
            <Row label="Name" value={userInfo.first_name ?? '-'} />
            <Row label="City" value={userInfo.base_city ?? '-'} />
            <Row label="Phone" value={userInfo.phone ?? '-'} />
            <Row label="Trust score" value={String(userInfo.trust_score)} />
            <Row label="User ID" value={userInfo.id.slice(0, 16) + '...'} />
          </>
        ) : (
          <Text style={styles.empty}>No profile row found</Text>
        )}
        <Row label="Sessions" value={sessionCount === null ? '...' : String(sessionCount)} />
      </View>

      <Text style={styles.sectionLabel}>Actions</Text>

      <View style={styles.actions}>
        <Action
          label="Reset profile"
          desc="Delete profile row → replay onboarding on next login"
          onPress={resetProfile}
          disabled={loading || !userInfo}
        />
        <Action
          label="Clear sessions"
          desc="Delete all flight sessions → re-enter a flight"
          onPress={clearSessions}
          disabled={loading || sessionCount === 0}
        />
        <Action
          label="Full wipe + sign out"
          desc="Delete everything and return to login screen"
          onPress={fullWipe}
          disabled={loading}
          danger
        />
      </View>

      {loading && <ActivityIndicator color={colors.subtle} style={{ marginTop: 16 }} />}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  )
}

function Action({ label, desc, onPress, disabled, danger }: {
  label: string
  desc: string
  onPress: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <TouchableOpacity
      style={[actionStyles.item, disabled && actionStyles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[actionStyles.label, danger && actionStyles.danger]}>{label}</Text>
      <Text style={actionStyles.desc}>{desc}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 28, paddingTop: 64, paddingBottom: 48, gap: 20 },
  back: { fontSize: 15, color: colors.subtle, marginBottom: 4 },
  badge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#92400E', letterSpacing: 0.3 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  empty: { fontSize: 14, color: colors.subtle, paddingVertical: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle, letterSpacing: 0.3, textTransform: 'uppercase' },
  actions: { gap: 10 },
  status: { fontSize: 14, color: colors.subtle, textAlign: 'center' },
})

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 14, color: colors.subtle },
  value: { fontSize: 14, color: colors.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
})

const actionStyles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  disabled: { opacity: 0.4 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  danger: { color: '#B91C1C' },
  desc: { fontSize: 13, color: colors.subtle },
})
