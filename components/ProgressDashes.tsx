import { View, StyleSheet } from 'react-native'
import { colors } from '../lib/theme'

export function ProgressDashes({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dash, i < step ? styles.dashFilled : styles.dashEmpty]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 2, borderRadius: 1 },
  dashFilled: { backgroundColor: colors.text },
  dashEmpty: { backgroundColor: colors.text, opacity: 0.15 },
})
