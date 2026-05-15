import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { getAblyClient, userChannelName } from '../../lib/ably'
import { takePendingSession } from '../../lib/pendingMatch'
import { haptics } from '../../lib/haptics'
import { ManifestBoard } from '../../components/ManifestBoard'
import { InputFlipCell } from '../../components/InputFlipCell'
import { primaryIataForCity } from '../../lib/cities'
import type Ably from 'ably'

type ScreenState = 'searching' | 'curiosity' | 'exhausted'

interface CuriosityData {
  match_id: string
  winning_signal: string | null
  flight_iata: string
  origin_iata: string
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  const [firstName, setFirstName] = useState('')
  const [iata, setIata] = useState('···')
  const [flightIata, setFlightIata] = useState<string | null>(null)
  const [state, setState] = useState<ScreenState>('searching')
  const [curiosity, setCuriosity] = useState<CuriosityData | null>(null)
  const [clockLabel, setClockLabel] = useState(formatClock(new Date()))

  // Live clock for the eyebrow — ticks every 30s so the minute stays current.
  useEffect(() => {
    const id = setInterval(() => setClockLabel(formatClock(new Date())), 30_000)
    return () => clearInterval(id)
  }, [])

  // Load profile basics for the manifest row, and gate on an active session.
  // If the user has no current standby session (expires_at in the future),
  // route them to flight entry — you can't wait without a flight.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const { data: profile } = await supabase
        .from('users')
        .select('first_name, base_city')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (profile?.first_name) setFirstName(profile.first_name)
      if (profile?.base_city) setIata(primaryIataForCity(profile.base_city))

      const nowIso = new Date().toISOString()
      const { data: activeSession } = await supabase
        .from('sessions')
        .select('id, flights(flight_iata)')
        .eq('user_id', session.user.id)
        .gt('expires_at', nowIso)
        .order('expires_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (!activeSession) { router.replace('/(app)/flight'); return }
      const flight = activeSession.flights as { flight_iata: string } | { flight_iata: string }[] | null
      const fIata = Array.isArray(flight) ? flight[0]?.flight_iata : flight?.flight_iata
      if (fIata) setFlightIata(fIata)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Ably subscriptions for match events.
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
        const data = msg.data as {
          match_id: string
          winning_signal: string | null
          flight_iata?: string
          origin_iata?: string
        }
        setCuriosity({
          match_id: data.match_id,
          winning_signal: data.winning_signal,
          flight_iata: data.flight_iata ?? '',
          origin_iata: data.origin_iata ?? '···',
        })
        setState('curiosity')
        haptics.standbyStamp()
      })

      channel.subscribe('pool.exhausted', () => {
        setState('exhausted')
        setCuriosity(null)
      })

      // Subscriptions are live — safe to fire matching now.
      const pending = takePendingSession()
      if (pending) {
        supabase.functions.invoke('match-sessions', { body: pending }).catch(() => {})
      }
    }

    subscribe()

    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [])

  async function dismissCuriosity() {
    if (!curiosity) return
    haptics.selection()
    try {
      await supabase
        .from('matches')
        .update({ status: 'declined' })
        .eq('id', curiosity.match_id)
    } catch (_) {}
    setCuriosity(null)
    setState('searching')
  }

  function openMatch() {
    if (!curiosity) return
    haptics.buttonTap()
    router.push({ pathname: '/(app)/match', params: { match_id: curiosity.match_id } })
  }

  const eyebrowLabel =
    state === 'exhausted' ? `THE GATE · ${clockLabel}` : `LISTENING · ${clockLabel}`

  const headline =
    state === 'exhausted'
      ? "You've met the gate."
      : "Finding the person you would've walked past."

  const subhead =
    state === 'exhausted'
      ? 'The gate is quiet for now — more travelers arrive closer to departure.'
      : null

  const manifestStatus = state === 'exhausted' ? 'gate-quiet' : 'standby'

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      {/* Top chrome — gear icon top-right. */}
      <View style={styles.topRow}>
        <View style={styles.eyebrowWrap}>
          {state !== 'searching' ? (
            <Text style={[type.eyebrow, styles.eyebrow]}>{eyebrowLabel}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.push('/(app)/profile') }}
          hitSlop={14}
          style={({ pressed }) => [styles.passengerBadge, pressed && { opacity: 0.5 }]}
        >
          <InputFlipCell
            char={(firstName[0] || ' ').toUpperCase()}
            cellSize={28}
            cellWidth={22}
          />
        </Pressable>
      </View>

      {/* Body — manifest board centered. */}
      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{headline}</Text>
        {subhead ? (
          <Text style={[type.subhead, styles.subhead]}>{subhead}</Text>
        ) : null}

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName={firstName || 'YOU'}
            iata={iata}
            flightIata={flightIata}
            mode="static"
            status={manifestStatus}
            stranger={
              state === 'curiosity' && curiosity
                ? {
                    flightIata: curiosity.flight_iata || '────',
                    originIata: curiosity.origin_iata || '···',
                  }
                : null
            }
          />
        </View>

        {/* Curiosity panel: italic line + MEET / KEEP LOOKING. */}
        {state === 'curiosity' && curiosity ? (
          <View style={styles.curiosityPanel}>
            <Text style={[type.subhead, styles.curiosityLine]}>
              {curiosity.winning_signal
                ? `"${curiosity.winning_signal.toLowerCase()}"`
                : 'someone curious is heading your way.'}
            </Text>
            <View style={styles.curiosityActions}>
              <Pressable
                onPress={openMatch}
                style={({ pressed }) => [styles.meetBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.triangle}>{'▶'}</Text>
                <Text style={styles.meetBtnText}>MEET THEM</Text>
              </Pressable>
              <Pressable
                onPress={dismissCuriosity}
                hitSlop={14}
                style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.5 }]}
              >
                <Text style={styles.dismissText}>KEEP LOOKING</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom — change flight only. */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.push('/(app)/flight') }}
          style={({ pressed }) => [styles.changeFlightBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.changeFlightText}>CHANGE FLIGHT</Text>
        </Pressable>
      </View>
    </View>
  )
}

function formatClock(d: Date): string {
  let h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${suffix}`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrowWrap: { flex: 1 },
  eyebrow: { color: colors.subtle },
  passengerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  headline: { color: colors.text },
  subhead: { color: colors.subtle, marginTop: -8 },
  boardWrap: { marginTop: 8 },
  curiosityPanel: {
    marginTop: 8,
    gap: 14,
  },
  curiosityLine: { color: colors.text },
  curiosityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  meetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  triangle: {
    fontSize: 9,
    color: colors.bg,
  },
  meetBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  dismissBtn: { paddingVertical: 6 },
  dismissText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  footer: {
    paddingTop: 12,
    alignItems: 'center',
  },
  changeFlightBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeFlightText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
})
