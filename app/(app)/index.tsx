import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'

export default function HomeScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.wordmark}>proxy</Text>
        <View style={styles.status}>
          <Text style={styles.statusText}>Looking for someone on your flight.</Text>
          <Text style={styles.statusSub}>We'll let you know when we find a match.</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(app)/flight')}>
          <Text style={styles.link}>Change flight</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 16 },
  wordmark: { fontSize: 34, fontWeight: '700', color: colors.text, letterSpacing: -1, marginBottom: 24 },
  status: { gap: 8 },
  statusText: { fontSize: 22, fontWeight: '600', color: colors.text, letterSpacing: -0.3 },
  statusSub: { fontSize: 16, color: colors.subtle },
  link: { fontSize: 15, color: colors.subtle, textDecorationLine: 'underline' },
})
