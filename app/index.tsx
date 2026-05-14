import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Animated, Easing } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FlipBoard } from '../components/FlipBoard'
import { HEADER_CELL_SIZE, HEADER_PADDING_X, HEADER_PADDING_TOP } from '../components/SectionHeader'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

const LABEL = 'STANDBY'
const BIG_CELL = 58
const INITIAL_FLIP_MS = 2000
const STAGGER_MS = 200
const SETTLE_MS = INITIAL_FLIP_MS + (LABEL.length - 1) * STAGGER_MS + 200
const BEAT_MS = 600
const MORPH_MS = 700

// Welcome cycle — shown only to signed-out users. Reads as one continuous
// sentence: "A quiet way / to meet / someone at / the airport."
const WELCOME_LINES = [
  'A QUIET WAY',
  'TO MEET',
  'SOMEONE AT',
  'THE AIRPORT',
]
const WELCOME_CELL = 36
const WELCOME_INITIAL_MS = 400
const WELCOME_STAGGER_MS = 70
const WELCOME_HOLD_MS = 850     // dwell after a line settles
const WELCOME_TAIL_MS = 600     // pause after the last line before routing

type Destination =
  | { path: '/(auth)' }
  | { path: '/(onboarding)/name' }
  | { path: '/(onboarding)/age' }
  | { path: '/(onboarding)/city' }
  | { path: '/(onboarding)/prompt' }
  | { path: '/(app)' }

type Phase = 'standby' | 'welcome' | 'morph'

export default function Loading() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const wrapRef = useRef<View>(null)
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const fade = useRef(new Animated.Value(1)).current
  const welcomeFade = useRef(new Animated.Value(0)).current

  const [destination, setDestination] = useState<Destination | null>(null)
  const [phase, setPhase] = useState<Phase>('standby')
  const [welcomeIdx, setWelcomeIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        setDestination({ path: '/(auth)' })
        return
      }
      const { data } = await supabase
        .from('users')
        .select('first_name, age, base_city, current_thinking')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (!data?.first_name) setDestination({ path: '/(onboarding)/name' })
      else if (data.age == null) setDestination({ path: '/(onboarding)/age' })
      else if (!data.base_city) setDestination({ path: '/(onboarding)/city' })
      else if (!data.current_thinking) setDestination({ path: '/(onboarding)/prompt' })
      else setDestination({ path: '/(app)' })
    }
    resolve()
    return () => { cancelled = true }
  }, [])

  // After STANDBY settles, branch: signed-out goes to welcome cycle, signed-in
  // does the morph-to-section-header animation.
  useEffect(() => {
    if (!destination) return
    const wait = SETTLE_MS + BEAT_MS
    const t = setTimeout(() => {
      if (destination.path === '/(auth)') {
        // Fade STANDBY out, then begin welcome cycle.
        Animated.timing(fade, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }).start(() => {
          setPhase('welcome')
          Animated.timing(welcomeFade, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }).start()
        })
      } else {
        setPhase('morph')
      }
    }, wait)
    return () => clearTimeout(t)
  }, [destination])

  // Welcome cycle: advance through lines, then route to auth.
  useEffect(() => {
    if (phase !== 'welcome') return
    if (welcomeIdx >= WELCOME_LINES.length) {
      const t = setTimeout(() => router.replace('/(auth)'), WELCOME_TAIL_MS)
      return () => clearTimeout(t)
    }
    const letters = WELCOME_LINES[welcomeIdx].replace(/[^A-Z]/g, '').length
    const settle = WELCOME_INITIAL_MS + Math.max(0, letters - 1) * WELCOME_STAGGER_MS
    const total = settle + WELCOME_HOLD_MS
    const t = setTimeout(() => setWelcomeIdx(i => i + 1), total)
    return () => clearTimeout(t)
  }, [phase, welcomeIdx])

  // Morph animation for signed-in users.
  useEffect(() => {
    if (phase !== 'morph' || !destination) return
    const node = wrapRef.current
    if (!node) {
      router.replace(destination.path as any)
      return
    }
    node.measure((_x, _y, w, h, pageX, pageY) => {
      const SCALE_TO = HEADER_CELL_SIZE / BIG_CELL
      const targetTopLeftX = HEADER_PADDING_X
      const targetTopLeftY = insets.top + HEADER_PADDING_TOP
      const currentCenterX = pageX + w / 2
      const currentCenterY = pageY + h / 2
      const scaledW = w * SCALE_TO
      const scaledH = h * SCALE_TO
      const targetCenterX = targetTopLeftX + scaledW / 2
      const targetCenterY = targetTopLeftY + scaledH / 2
      const tx = targetCenterX - currentCenterX
      const ty = targetCenterY - currentCenterY

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: tx, duration: MORPH_MS,
          easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: ty, duration: MORPH_MS,
          easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: SCALE_TO, duration: MORPH_MS,
          easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(fade, {
          toValue: 0, duration: 120, useNativeDriver: true,
        }).start(() => {
          router.replace(destination.path as any)
        })
      })
    })
  }, [phase])

  return (
    <View style={styles.container}>
      {phase !== 'welcome' && (
        <Animated.View
          ref={wrapRef}
          collapsable={false}
          style={[
            styles.wrap,
            { opacity: fade, transform: [{ translateX }, { translateY }, { scale }] },
          ]}
        >
          <FlipBoard
            label={LABEL}
            cellSize={BIG_CELL}
            initialFlipMs={INITIAL_FLIP_MS}
            staggerMs={STAGGER_MS}
          />
        </Animated.View>
      )}

      {phase === 'welcome' && welcomeIdx < WELCOME_LINES.length && (
        <Animated.View style={[styles.wrap, { opacity: welcomeFade }]}>
          <FlipBoard
            key={`welcome-${welcomeIdx}`}
            label={WELCOME_LINES[welcomeIdx]}
            cellSize={WELCOME_CELL}
            initialFlipMs={WELCOME_INITIAL_MS}
            staggerMs={WELCOME_STAGGER_MS}
          />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
