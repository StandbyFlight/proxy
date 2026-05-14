import { View, StyleSheet } from 'react-native'
import { Slot } from 'expo-router'
import { colors } from '../../lib/theme'

export default function OnboardingLayout() {
  return (
    <View style={styles.container}>
      <Slot />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
})
