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
  tile = false,
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
  // Curved grey box (no seam) + a fuller 3D rotateX flip. Home board look.
  tile?: boolean
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
  // Tile mode swaps the flat squash for a fuller 3D flap flip (rotateX with
  // perspective), which reads as much "flippier".
  const flipStyle = tile
    ? {
        transform: [
          { perspective: 320 },
          { rotateX: scaleY.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
        ],
      }
    : { transform: [{ scaleY }] }
  return (
    <View style={s.cell}>
      <Animated.View style={flipStyle}>
        <Text style={s.cellChar}>{char}</Text>
      </Animated.View>
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
  cache[key] = StyleSheet.create({
    // Grey box, square corners, no seam — the tile used across every board.
    cell: {
      width,
      height: cellSize,
      backgroundColor: colors.boardTile,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: 0,
    },
    cellChar: {
      color: colors.boardText,
      fontSize,
      fontFamily: BOARD_FONT,
      lineHeight,
      textAlign: 'center',
      textAlignVertical: 'center',
      includeFontPadding: false,
    },
  })
  return cache[key]
}
