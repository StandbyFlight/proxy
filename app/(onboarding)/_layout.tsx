import { View, StyleSheet } from 'react-native'
import { Slot, useSegments } from 'expo-router'
import { SectionHeader } from '../../components/SectionHeader'
import { colors } from '../../lib/theme'

function labelFor(segment: string | undefined): string {
  if (segment === 'prompt') return 'ON YOUR MIND'
  return 'ABOUT YOU'
}

export default function OnboardingLayout() {
  const segments = useSegments()
  const last = segments[segments.length - 1] as string | undefined
  return (
    <View style={styles.container}>
      <SectionHeader label={labelFor(last)} />
      <View style={styles.body}>
        <Slot />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
})
