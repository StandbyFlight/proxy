import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BOARD_FONT = fonts.board

export function FlipCell({
  targetChar,
  stopAfter,
  cellSize = 58,
  cellWidth,
  instant = false,
  reveal = false,
}: {
  targetChar: string
  stopAfter: number
  cellSize?: number
  cellWidth?: number
  // Render the final character immediately — no scramble, no flip, no haptics.
  // Used by static boards (searching) that should just populate.
  instant?: boolean
  // Start blank, then do ONE clean flip to the target char at `stopAfter` ms.
  // Used by the home board to populate letters one at a time after it loads.
  reveal?: boolean
}) {
  const [char, setChar] = useState(() =>
    instant ? targetChar : reveal ? '' : CHARS[Math.floor(Math.random() * CHARS.length)],
  )
  const scaleY = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Static render: keep the target char, run no animation at all.
    if (instant) {
      setChar(targetChar)
      return
    }

    // Reveal: sit blank until our staggered slot, then a single flip in.
    if (reveal) {
      let cancelled = false
      const timer = setTimeout(() => {
        if (cancelled) return
        Animated.timing(scaleY, {
          toValue: 0,
          duration: 90,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (cancelled) return
          setChar(targetChar)
          Animated.timing(scaleY, {
            toValue: 1,
            duration: 120,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start()
        })
      }, stopAfter)
      return () => { cancelled = true; clearTimeout(timer) }
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const start = Date.now()

    const cycle = () => {
      if (cancelled) return
      const elapsed = Date.now() - start
      const settle = elapsed >= stopAfter

      if (settle) {
        haptics.splitFlapFlipStart()
      } else {
        haptics.scrambleTick()
      }

      Animated.timing(scaleY, {
        toValue: 0,
        duration: settle ? 90 : 45,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return
        const next = settle ? targetChar : CHARS[Math.floor(Math.random() * CHARS.length)]
        setChar(next)
        if (settle) haptics.splitFlapFlipMid()
        Animated.timing(scaleY, {
          toValue: 1,
          duration: settle ? 110 : 55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (!settle && !cancelled) {
            timer = setTimeout(cycle, 12)
          }
          if (settle) haptics.splitFlapFlipSettle()
        })
      })
    }

    cycle()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [targetChar, stopAfter, instant, reveal])

  const s = stylesFor(cellSize, cellWidth)
  return (
    <View style={s.cell}>
      <Animated.View style={{ transform: [{ scaleY }] }}>
        <Text style={s.cellChar}>{char}</Text>
      </Animated.View>
      <View style={s.cellSeam} />
    </View>
  )
}

const cache: Record<string, ReturnType<typeof StyleSheet.create<any>>> = {}
function stylesFor(cellSize: number, cellWidth?: number) {
  const key = cellWidth != null ? `${cellSize}_${cellWidth}` : `${cellSize}`
  if (cache[key]) return cache[key]
  const width = cellWidth ?? Math.round(cellSize * 0.69)
  const fontSize = cellWidth != null ? Math.round(cellWidth * 1.1) : Math.round(cellSize * 0.66)
  const lineHeight = cellWidth != null ? Math.round(cellWidth * 1.4) : Math.round(cellSize * 0.79)
  const seamTop = Math.round(cellSize * 0.48)
  const seamHeight = Math.max(1, Math.round(cellSize * 0.034))
  cache[key] = StyleSheet.create({
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
  return cache[key]
}
