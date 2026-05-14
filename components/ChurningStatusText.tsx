import { useEffect, useRef } from 'react'
import { Animated, Easing, Text, StyleSheet, TextStyle } from 'react-native'

// A single line of mono text that quietly re-flips on itself at a fixed cadence.
// Used for the STATUS caption on the waiting screen — the word never changes,
// but the board "refreshes" every {intervalMs} like a real departure board.
export function ChurningStatusText({
  text,
  intervalMs = 6000,
  style,
}: {
  text: string
  intervalMs?: number
  style?: TextStyle | TextStyle[]
}) {
  const scaleY = useRef(new Animated.Value(1)).current

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      Animated.timing(scaleY, {
        toValue: 0,
        duration: 95,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return
        Animated.timing(scaleY, {
          toValue: 1,
          duration: 130,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start()
      })
    }
    const id = setInterval(tick, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [intervalMs])

  return (
    <Animated.Text style={[styles.base, style, { transform: [{ scaleY }] }]}>
      {text}
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  base: {},
})
