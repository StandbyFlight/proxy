import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

const BOARD_FONT = fonts.mono

// A flip cell driven by an external `char` prop.
// When `char` changes, plays a single fast flip-out / flip-in animation.
// Empty cells render a dim placeholder character (en-dash) and don't animate.
export function InputFlipCell({
  char,
  cellSize = 46,
  cellWidth,
  placeholder = '–',
}: {
  char: string
  cellSize?: number
  cellWidth?: number
  placeholder?: string
}) {
  const isEmpty = char === '' || char === ' '
  const display = isEmpty ? placeholder : char.toUpperCase()

  // Always mount at the placeholder so newly-added cells (from dynamic
  // growth in InputFlipBoard) flip in instead of appearing instantly.
  const [rendered, setRendered] = useState(placeholder)
  const scaleY = useRef(new Animated.Value(1)).current
  const prevRef = useRef(placeholder)

  useEffect(() => {
    if (display === prevRef.current) return
    prevRef.current = display

    Animated.timing(scaleY, {
      toValue: 0,
      duration: 80,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRendered(display)
      Animated.timing(scaleY, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    })
  }, [display])

  // Whether the *rendered* glyph is the dim placeholder. We use this to
  // dim the text — driven by what's currently shown, not what's incoming —
  // so the dim/bright transition stays in sync with the flip animation.
  const renderedIsEmpty = rendered === placeholder

  const s = stylesFor(cellSize, cellWidth)
  return (
    <View style={s.cell}>
      <Animated.View style={{ transform: [{ scaleY }] }}>
        <Text style={[s.cellChar, renderedIsEmpty && s.cellCharDim]}>{rendered}</Text>
      </Animated.View>
      <View style={s.cellSeam} />
    </View>
  )
}

type StyleCacheKey = string
const cache: Record<StyleCacheKey, ReturnType<typeof StyleSheet.create<any>>> = {}
function stylesFor(cellSize: number, cellWidth?: number) {
  const key = `${cellSize}_${cellWidth ?? 'auto'}`
  if (cache[key]) return cache[key]
  const width = cellWidth ?? Math.round(cellSize * 0.69)
  const fontSize = Math.round(cellSize * 0.62)
  const lineHeight = Math.round(cellSize * 0.78)
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
      // Softer tile corners + a faint top-light inner edge, matching FlipCell.
      borderRadius: Math.max(2, Math.round(cellSize * 0.1)),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    cellChar: {
      color: colors.boardText,
      fontSize,
      fontFamily: BOARD_FONT,
      lineHeight,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    cellCharDim: { opacity: 0.22 },
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
