import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'

export default function MatchScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.label}>Your connection</Text>
        <Text style={styles.connection}>
          "You're both heading to the same conference in Austin."
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.accept}
            onPress={() => router.push('/(app)/meetup')}
          >
            <Text style={styles.acceptText}>I'm interested</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.decline} onPress={() => router.back()}>
            <Text style={styles.declineText}>Not for me</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          Their name won't be shared until you both say yes.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 24 },
  label: { fontSize: 12, fontWeight: '600', color: colors.subtle, letterSpacing: 1, textTransform: 'uppercase' },
  connection: { fontSize: 26, fontWeight: '600', color: colors.text, lineHeight: 34, letterSpacing: -0.3 },
  actions: { gap: 12, marginTop: 8 },
  accept: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  acceptText: { color: colors.bg, fontSize: 16, fontWeight: '600' },
  decline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  declineText: { color: colors.subtle, fontSize: 16 },
  note: { fontSize: 13, color: colors.subtle, textAlign: 'center', lineHeight: 19 },
})
