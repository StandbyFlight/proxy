import { useRef } from 'react'
import { View, PanResponder, StyleSheet } from 'react-native'
import { InputFlipCell } from './InputFlipCell'

// A flip cell that responds to vertical swipes to change a digit (0-9).
// Swipe up → increment, swipe down → decrement. Wraps at boundaries.
export function DigitFlipCell({
  value,
  onChange,
  cellSize = 92,
  cellWidth = 64,
}: {
  value: number
  onChange: (next: number) => void
  cellSize?: number
  cellWidth?: number
}) {
  const valueRef = useRef(value)
  valueRef.current = value
  const lastStepAt = useRef(0)

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,

      onPanResponderMove: (_e, g) => {
        // Step every 24px of vertical drag, throttled so users can't blast through digits.
        const STEP_PX = 24
        const now = Date.now()
        if (now - lastStepAt.current < 90) return

        const dir = g.dy < -STEP_PX ? -1 : g.dy > STEP_PX ? 1 : 0
        if (dir === 0) return

        // dy negative = swipe up = increment
        const next = ((valueRef.current - dir) + 10) % 10
        onChange(next)
        valueRef.current = next
        lastStepAt.current = now

        // Reset gesture origin by zeroing dy
        g.dy = 0
      },

      onPanResponderRelease: () => {
        lastStepAt.current = 0
      },
    })
  ).current

  return (
    <View {...responder.panHandlers} style={styles.touch}>
      <InputFlipCell char={String(value)} cellSize={cellSize} cellWidth={cellWidth} />
    </View>
  )
}

const styles = StyleSheet.create({
  touch: { padding: 4 },
})
