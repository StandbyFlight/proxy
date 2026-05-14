import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native'
import { colors } from '../lib/theme'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BOARD_FONT = Platform.select({
  ios: 'AvenirNext-Medium',
  android: 'sans-serif',
  default: 'Avenir Next, Avenir, Helvetica, Arial, sans-serif',
})

export function FlipCell({
  targetChar,
  stopAfter,
  cellSize = 58,
}: {
  targetChar: string
  stopAfter: number
  cellSize?: number
}) {
  const [char, setChar] = useState(CHARS[Math.floor(Math.random() * CHARS.length)])
  const scaleY = useRef(new Animated.Value(1)).current

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const start = Date.now()

    const cycle = () => {
      if (cancelled) return
      const elapsed = Date.now() - start
      const settle = elapsed >= stopAfter

      Animated.timing(scaleY, {
        toValue: 0,
        duration: settle ? 90 : 45,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return
        const next = settle ? targetChar : CHARS[Math.floor(Math.random() * CHARS.length)]
        setChar(next)
        Animated.timing(scaleY, {
          toValue: 1,
          duration: settle ? 110 : 55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (!settle && !cancelled) {
            timer = setTimeout(cycle, 12)
          }
        })
      })
    }

    cycle()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [targetChar, stopAfter])

  const s = stylesFor(cellSize)
  return (
    <View style={s.cell}>
      <Animated.View style={{ transform: [{ scaleY }] }}>
        <Text style={s.cellChar}>{char}</Text>
      </Animated.View>
      <View style={s.cellSeam} />
    </View>
  )
}

const cache: Record<number, ReturnType<typeof StyleSheet.create<any>>> = {}
function stylesFor(cellSize: number) {
  if (cache[cellSize]) return cache[cellSize]
  const width = Math.round(cellSize * 0.69)
  const fontSize = Math.round(cellSize * 0.66)
  const lineHeight = Math.round(cellSize * 0.79)
  const seamTop = Math.round(cellSize * 0.48)
  const seamHeight = Math.max(1, Math.round(cellSize * 0.034))
  cache[cellSize] = StyleSheet.create({
    cell: {
      width,
      height: cellSize,
      backgroundColor: colors.board,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: Math.max(1, Math.round(cellSize * 0.034)),
    },
    cellChar: {
      color: colors.boardText,
      fontSize,
      fontFamily: BOARD_FONT,
      lineHeight,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    cellSeam: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: seamTop,
      height: seamHeight,
      backgroundColor: colors.boardSeam,
    },
  })
  return cache[cellSize]
}
