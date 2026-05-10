import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'

export default function PostMeetupScreen() {
  const router = useRouter()

  function respond(_met: boolean) {
    // TODO: update matches table with confirmation
    router.replace('/(app)/')
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.heading}>Did you meet Alex?</Text>
        <Text style={styles.sub}>Just between us — this helps us get better.</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.yes} onPress={() => respond(true)}>
            <Text style={styles.yesText}>Yes, we met</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.no} onPress={() => respond(false)}>
            <Text style={styles.noText}>No, it didn't work out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  heading: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: colors.subtle, marginTop: -12 },
  actions: { gap: 12, marginTop: 8 },
  yes: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  yesText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  no: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  noText: { color: colors.subtle, fontSize: 16 },
})
