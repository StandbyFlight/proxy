import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FlipBoard } from './FlipBoard'

export const HEADER_CELL_SIZE = 16
export const HEADER_PADDING_X = 24
export const HEADER_PADDING_TOP = 8

export function SectionHeader({ label }: { label: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + HEADER_PADDING_TOP },
      ]}
    >
      <FlipBoard
        label={label}
        cellSize={HEADER_CELL_SIZE}
        initialFlipMs={500}
        staggerMs={70}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: HEADER_PADDING_X,
    paddingBottom: 8,
  },
})
