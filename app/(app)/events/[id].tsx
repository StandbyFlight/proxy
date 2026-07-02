import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { getActiveSession, attachEventToActiveSession } from '../../../lib/session'
import { getEvent, type Event } from '../../../lib/events'
import { BackButton } from '../../../components/BackButton'

// Event detail — loaded from the events table. Attaching adds the event to
// the current session as matching context; with no session, the event is
// carried into session setup.

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [event, setEvent] = useState<Event | null | undefined>(undefined)
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    let cancelled = false
    getEvent(String(id))
      .then(ev => { if (!cancelled) setEvent(ev) })
      .catch(() => { if (!cancelled) setEvent(null) })
    getActiveSession()
      .then(s => { if (!cancelled) setHasActiveSession(!!s) })
      .catch(() => { if (!cancelled) setHasActiveSession(false) })
    return () => { cancelled = true }
  }, [id]))

  if (event === undefined) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.subtle} />
      </View>
    )
  }

  if (event === null) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={[type.subhead, { color: colors.text }]}>Event not found.</Text>
      </View>
    )
  }

  // Attach never hard-fails: every async step is awaited inside try/catch and
  // surfaced inline, so no promise rejection escapes this flow.
  async function attach() {
    if (attaching) return
    haptics.buttonTap()
    setAttaching(true)
    setError('')
    try {
      await attachEventToActiveSession(String(id))
      haptics.success()
      router.push('/(app)/match/searching')
    } catch (err: any) {
      haptics.error()
      setError(err?.message ?? 'Could not attach the event. Try again.')
    } finally {
      setAttaching(false)
    }
  }

  function startSession() {
    haptics.buttonTap()
    router.push({
      pathname: '/(app)/flight',
      params: { event_id: String(id), event_name: event!.name },
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
        <BackButton label="EVENTS" fallback="/(app)/events" />

        <Text style={[type.headline, styles.headline]}>{event.name}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>WHEN</Text>
            <Text style={styles.metaValue}>{event.dates_label}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>WHERE</Text>
            <Text style={styles.metaValue}>{event.city.toUpperCase()}</Text>
          </View>
        </View>

        {event.blurb ? (
          <Text style={[type.subhead, styles.blurb]}>{event.blurb}</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Pressable
          onPress={hasActiveSession ? attach : startSession}
          disabled={attaching || hasActiveSession === null}
          style={({ pressed }) => [
            styles.primaryBtn,
            (attaching || hasActiveSession === null) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {hasActiveSession ? 'ATTACH TO YOUR SESSION' : 'START A SESSION'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  inner: { paddingHorizontal: 24, gap: 16 },

  headline: { color: colors.text, marginTop: 4 },

  metaRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 14,
    marginTop: 8,
  },
  metaCell: { flex: 1, gap: 6 },
  metaLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.text,
    opacity: 0.6,
  },
  metaValue: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.6,
    color: colors.text,
  },

  blurb: { color: colors.text, marginTop: 8 },

  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
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
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.onAccent,
  },
})
