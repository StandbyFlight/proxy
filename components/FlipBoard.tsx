import { View, StyleSheet } from 'react-native'
import { FlipCell } from './FlipCell'
import { colors } from '../lib/theme'

export function FlipBoard({
  label,
  cellSize = 58,
  gap,
  padding,
  initialFlipMs = 2000,
  staggerMs = 200,
  framed = true,
}: {
  label: string
  cellSize?: number
  gap?: number
  padding?: number
  initialFlipMs?: number
  staggerMs?: number
  framed?: boolean
}) {
  const cellGap = gap ?? Math.max(1, Math.round(cellSize * 0.05))
  const boardPad = padding ?? Math.round(cellSize * 0.24)
  const chars = label.toUpperCase().split('')

  return (
    <View
      style={[
        styles.board,
        {
          gap: cellGap,
          paddingVertical: framed ? boardPad * 0.5 : 0,
          paddingHorizontal: framed ? boardPad * 0.4 : 0,
          backgroundColor: framed ? colors.board : 'transparent',
          borderRadius: Math.max(2, Math.round(cellSize * 0.1)),
        },
      ]}
    >
      {chars.map((c, i) => {
        if (c === ' ') {
          return <View key={`s-${i}-${label}`} style={{ width: Math.round(cellSize * 0.35) }} />
        }
        return (
          <FlipCell
            key={`c-${i}-${label}`}
            targetChar={c}
            stopAfter={initialFlipMs + i * staggerMs}
            cellSize={cellSize}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
})
