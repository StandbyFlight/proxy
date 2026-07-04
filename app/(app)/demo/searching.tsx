import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { isDemoMode, trackDemo } from '../../../lib/demo'
import { demoFlight, demoSearchSteps, DEMO_ROUTES } from '../../../lib/demoData'
import { BetaDemoBanner } from '../../../components/BetaDemoBanner'
import { ManifestBoard } from '../../../components/ManifestBoard'

// Simulated searching leaf for the beta demo. This screen NEVER touches the real
// matcher, Supabase, Ably, or session logic — it plays the searching animation
// and progressive copy on a fixed timeline, then routes to the demo match
// reveal. It exists purely so friends can preview the searching → match feel.

const STEP_INTERVAL_MS = 1_600

export default function DemoSearchingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [stepIndex, setStepIndex] = useState(0)
  const navigatedRef = useRef(false)

  // If somehow reached with demo mode off, don't strand the user on a fake flow.
  useEffect(() => {
    if (!isDemoMode()) {
      router.replace('/(app)/')
      return
    }
    trackDemo('demo_search_started')
  }, [])

  // Advance the progressive copy one line at a time, then hand off to the demo
  // match reveal once the final "Match found." line has shown.
  useEffect(() => {
    if (!isDemoMode()) return
    const timers: ReturnType<typeof setTimeout>[] = []

    demoSearchSteps.forEach((_, i) => {
      if (i === 0) return // first line is shown immediately
      timers.push(
        setTimeout(() => {
          setStepIndex(i)
          // One soft tick per step; a success cue on the final "Match found." line.
          if (i === demoSearchSteps.length - 1) haptics.success()
          else haptics.selection()
        }, i * STEP_INTERVAL_MS),
      )
    })

    // Hand off shortly after the last line lands (~6s total, within 5–8s window).
    timers.push(
      setTimeout(() => {
        if (navigatedRef.current) return
        navigatedRef.current = true
        router.replace(DEMO_ROUTES.match)
      }, demoSearchSteps.length * STEP_INTERVAL_MS),
    )

    return () => { timers.forEach(clearTimeout) }
  }, [])

  const currentStep = demoSearchSteps[stepIndex] ?? ''
  const isFinal = stepIndex === demoSearchSteps.length - 1

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <BetaDemoBanner style={styles.banner} />

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>
          Finding the person you would’ve walked past.
        </Text>

        <View style={styles.boardWrap}>
          <ManifestBoard
            firstName="YOU"
            iata={demoFlight.origin}
            iataLabel="FROM"
            flightIata={demoFlight.flightLabel}
            mode="static"
            status="none"
            stranger={null}
          />
        </View>

        <View style={styles.statusRow}>
          {isFinal ? null : <ActivityIndicator size="small" color={colors.subtle} />}
          <Text style={[styles.statusText, isFinal && styles.statusTextFinal]}>
            {currentStep}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => { haptics.selection(); router.replace('/(app)/') }}
        hitSlop={14}
        style={({ pressed }) => [
          styles.cancelBtn,
          { paddingBottom: Math.max(insets.bottom, 16) },
          pressed && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.cancelText}>CANCEL</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  banner: { marginTop: 6 },
  body: { flex: 1, justifyContent: 'center', gap: 20 },
  headline: { color: colors.text },
  boardWrap: { marginTop: 8 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    minHeight: 22,
  },
  statusText: {
    fontFamily: fonts.body,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.subtle,
  },
  statusTextFinal: {
    color: colors.accent,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingTop: 12,
  },
  cancelText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.subtle,
  },
})
