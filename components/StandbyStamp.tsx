import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, Text } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'

// Rubber-stamp moment. An angled label that scales + rotates in with a thunk.
// Used for STANDBY (profile complete), MATCH (mutual yes), PASS / DECLINED.
//
// Props:
//   label    — text to stamp
//   color    — ink color (defaults to TWA red)
//   delayMs  — wait before the stamp lands
//   angle    — rotation in degrees (defaults to -8)
//   onLand   — optional callback after the thunk

export function StandbyStamp({
  label,
  color = colors.accent,
  delayMs = 0,
  angle = -8,
  onLand,
}: {
  label: string
  color?: string
  delayMs?: number
  angle?: number
  onLand?: () => void
}) {
  const scale = useRef(new Animated.Value(2.2)).current
  const opacity = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return
        haptics.standbyStamp()
        if (onLand) onLand()
      })
    }, delayMs)
    return () => clearTimeout(t)
  }, [delayMs])

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${angle}deg`],
  })

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ scale }, { rotate: spin }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.frame, { borderColor: color }]}>
        <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
  },
  frame: {
    borderWidth: 2.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    // slight ink-bleed feel via faint inner shadow approximation
    opacity: 0.92,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3.5,
  },
})
