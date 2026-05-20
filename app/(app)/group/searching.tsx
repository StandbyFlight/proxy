import { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, eventPoolChannelName } from '../../../lib/ably'
import type Ably from 'ably'

// Event-mode standby. User has opted into event mode for an event; we wait for
// either a seed-pair to form (→ group/room as is_seed) or an existing open
// group to surface (→ group/join). The screen has no counter and no fake
// animation — it's the same quiet vibe as match/searching.

export default function GroupSearching() {
  const { event_id, event_name, origin_iata, departure_time } =
    useLocalSearchParams<{
      event_id?: string
      event_name?: string
      origin_iata?: string
      departure_time?: string
    }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  const eventName = event_name?.trim() || 'YOUR EVENT'

  // Subscribe to the event pool channel. Backend isn't wired yet so these
  // events won't fire — but the channel name + handlers are correct so they
  // become live the moment the create-group / surface-group functions ship.
  useEffect(() => {
    let cancelled = false

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled || !event_id) return

      const departureDate = departure_time
        ? departure_time.split('T')[0]
        : new Date().toISOString().split('T')[0]
      const origin = origin_iata || 'XXX'

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(
        eventPoolChannelName(event_id, origin, departureDate)
      )
      channelRef.current = channel

      channel.subscribe('group.formed', (msg) => {
        const data = msg.data as {
          group_id: string
          meetup_location?: string
          window_expires_at?: string
          member_names?: string[]
        }
        router.replace({
          pathname: '/(app)/group/room',
          params: {
            group_id: data.group_id,
            event_name: eventName,
            meetup_location: data.meetup_location ?? '',
            window_expires_at: data.window_expires_at ?? '',
            member_names: (data.member_names ?? []).join(','),
            is_seed: 'true',
          },
        })
      })

      channel.subscribe('group.open', (msg) => {
        const data = msg.data as {
          group_id: string
          meetup_location?: string
          window_expires_at?: string
          member_names?: string[]
        }
        router.replace({
          pathname: '/(app)/group/join',
          params: {
            group_id: data.group_id,
            event_id: event_id,
            event_name: eventName,
            meetup_location: data.meetup_location ?? '',
            window_expires_at: data.window_expires_at ?? '',
            member_names: (data.member_names ?? []).join(','),
          },
        })
      })
    }

    subscribe()
    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [event_id, origin_iata, departure_time, eventName])

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={[type.eyebrow, styles.eyebrow]}>EVENT MODE · STANDBY</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{eventName}</Text>
        <Text style={[type.subhead, styles.subhead]}>
          We're looking for others headed to {eventName}. You'll hear from us.
        </Text>

        {origin_iata ? (
          <Text style={styles.tag}>{origin_iata}  ·  EVENT POOL</Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
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

  body: { flex: 1, justifyContent: 'center', gap: 18 },
  headline: { color: colors.text },
  subhead: { color: colors.subtle },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
    marginTop: 4,
  },
})
