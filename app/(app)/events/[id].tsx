import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'

// Event detail — primary action depends on whether the user has an active
// session: attach → group/searching (event mode), no session → kick off
// session/flight with the event pre-filled.

const EVENT_DETAIL: Record<string, {
  name: string; dates: string; city: string; attending: number; blurb: string
}> = {
  'yc-startup-school-2026': {
    name: 'YC AI Startup School',
    dates: 'JUL 25',
    city: 'San Francisco',
    attending: 14,
    blurb: 'A one-day intensive for early founders building AI startups. STANDBY travelers attending mostly fly in the morning of.',
  },
  'consensus-2026': {
    name: 'Consensus',
    dates: 'MAY 19–22',
    city: 'Austin',
    attending: 9,
    blurb: 'The largest crypto + AI conference in the US. Long flights in, dense social schedule.',
  },
  'sxsw-2026': {
    name: 'SXSW',
    dates: 'MAR 12–22',
    city: 'Austin',
    attending: 27,
    blurb: 'Music, film, tech. Ten days, hundreds of travelers crossing through Austin daily.',
  },
  'aihackathon-berkeley': {
    name: 'AI Hackathon @ Berkeley',
    dates: 'JUN 20',
    city: 'Berkeley',
    attending: 6,
    blurb: 'Weekend hackathon at Berkeley. Almost all attendees fly in Friday afternoon.',
  },
  'web-summit-2026': {
    name: 'Web Summit',
    dates: 'NOV 9–12',
    city: 'Lisbon',
    attending: 3,
    blurb: 'Tech conference in Lisbon. Most US travelers connect through JFK or BOS.',
  },
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null)

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .limit(1)
        .maybeSingle()
      if (!cancelled) setHasActiveSession(!!data)
    }
    check()
    return () => { cancelled = true }
  }, []))

  const detail = EVENT_DETAIL[id ?? '']

  if (!detail) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[type.subhead, { color: colors.text }]}>Event not found.</Text>
      </View>
    )
  }

  function attach() {
    haptics.buttonTap()
    router.push({
      pathname: '/(app)/group/searching',
      params: { event_id: String(id), event_name: detail.name },
    })
  }

  function startSession() {
    haptics.buttonTap()
    router.push({
      pathname: '/(app)/flight',
      params: { event_id: String(id), event_name: detail.name },
    })
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK TO EVENTS</Text>
        </Pressable>

        <Text style={[type.eyebrow, styles.eyebrow]}>EVENT</Text>
        <Text style={[type.headline, styles.headline]}>{detail.name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>WHEN</Text>
            <Text style={styles.metaValue}>{detail.dates}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>WHERE</Text>
            <Text style={styles.metaValue}>{detail.city.toUpperCase()}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>NEARBY</Text>
            <Text style={[styles.metaValue, { color: colors.accent }]}>{detail.attending}</Text>
          </View>
        </View>

        <Text style={[type.subhead, styles.blurb]}>{detail.blurb}</Text>

        <View style={styles.placeholderBlock}>
          <Text style={styles.placeholderLabel}>HEADS UP</Text>
          <Text style={styles.placeholderBody}>
            Event-attached group seating is in preview. Solo matches inside the same event are already live.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        {hasActiveSession ? (
          <Pressable
            onPress={attach}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.triangleOnRed}>{'▶'}</Text>
            <Text style={styles.primaryBtnText}>ATTACH TO YOUR SESSION</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={startSession}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.triangleOnRed}>{'▶'}</Text>
            <Text style={styles.primaryBtnText}>START A SESSION</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 16 },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1.4,
  },

  eyebrow: { color: colors.subtle },
  headline: { color: colors.text, marginTop: 4 },

  metaRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.16)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.16)',
    paddingVertical: 14,
    marginTop: 8,
  },
  metaCell: { flex: 1, gap: 6 },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  metaValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.text,
  },

  blurb: { color: colors.text, marginTop: 8 },

  placeholderBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 14,
    marginTop: 8,
    gap: 6,
  },
  placeholderLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  placeholderBody: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.08)',
    backgroundColor: colors.bg,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
})
