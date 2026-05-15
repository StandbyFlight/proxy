import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { FlipBoard } from '../components/FlipBoard'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

const LABEL = 'STANDBY'
const BIG_CELL = 58
const INITIAL_FLIP_MS = 2000
const STAGGER_MS = 200
const SETTLE_MS = INITIAL_FLIP_MS + (LABEL.length - 1) * STAGGER_MS + 200
const BEAT_MS = 600
const MORPH_MS = 400

// Splash tagline — shown only to signed-out users. Mono, not flip cells, so
// STANDBY stays the singular flip-board moment on this screen. Two lines so
// "HAS A STORY" gets to land as the punchline.
const TAGLINE_LINE_1 = 'YOU\'VE FLOWN NEXT TO INTERESTING PEOPLE YOUR WHOLE LIFE.'
const TAGLINE_LINE_2 = 'NOW YOU CAN MEET ONE.'
const TAGLINE_FADE_DELAY_MS = 400   // beat after STANDBY settles
const TAGLINE_FADE_MS = 500
const TAGLINE_HOLD_MS = 1800
const TAGLINE_OUT_MS = 280

type Destination =
  | { path: '/(auth)' }
  | { path: '/(onboarding)/name' }
  | { path: '/(onboarding)/age' }
  | { path: '/(onboarding)/city' }
  | { path: '/(onboarding)/prompt' }
  | { path: '/(app)' }

type Phase = 'standby' | 'tagline' | 'morph'

export default function Loading() {
  const router = useRouter()
  const fade = useRef(new Animated.Value(1)).current
  const taglineOpacity = useRef(new Animated.Value(0)).current

  const [destination, setDestination] = useState<Destination | null>(null)
  const [phase, setPhase] = useState<Phase>('standby')

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

  // After STANDBY settles + beat: signed-out users see the tagline, then route
  // to auth. Signed-in users skip tagline and run the morph-to-section-header.
  useEffect(() => {
    if (!destination) return
    const wait = SETTLE_MS + BEAT_MS
    const t = setTimeout(() => {
      if (destination.path === '/(auth)') {
        setPhase('tagline')
      } else {
        setPhase('morph')
      }
    }, wait)
    return () => clearTimeout(t)
  }, [destination])

  // Tagline animation: fade in, hold, fade out together with STANDBY, then route.
  useEffect(() => {
    if (phase !== 'tagline') return

    Animated.sequence([
      Animated.delay(TAGLINE_FADE_DELAY_MS),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: TAGLINE_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.delay(TAGLINE_HOLD_MS),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 0,
          duration: TAGLINE_OUT_MS,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: TAGLINE_OUT_MS,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      router.replace('/(auth)')
    })
  }, [phase])

  // Fade out and navigate for signed-in users.
  useEffect(() => {
    if (phase !== 'morph' || !destination) return
    Animated.timing(fade, {
      toValue: 0,
      duration: MORPH_MS,
      useNativeDriver: true,
    }).start(() => {
      router.replace(destination.path as any)
    })
  }, [phase])

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.wrap, { opacity: fade }]}>
        <FlipBoard
          label={LABEL}
          cellSize={BIG_CELL}
          initialFlipMs={INITIAL_FLIP_MS}
          staggerMs={STAGGER_MS}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.tagline, { opacity: taglineOpacity }]}
      >
        <Text style={styles.taglineLine}>{TAGLINE_LINE_1}</Text>
        <Text style={styles.taglineLine}>{TAGLINE_LINE_2}</Text>
      </Animated.View>
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
  tagline: {
    marginTop: 32,
    alignItems: 'center',
    gap: 4,
  },
  taglineLine: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 2.4,
    color: colors.subtle,
    textAlign: 'center',
  },
})
