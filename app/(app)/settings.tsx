import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { disconnectAbly } from '../../lib/ably'
import { haptics } from '../../lib/haptics'
import { BackButton } from '../../components/BackButton'

// Account-level settings. Profile fields are edited directly on the Profile
// page, not here.

export default function Settings() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  async function signOut() {
    haptics.buttonTap()
    disconnectAbly()
    await supabase.auth.signOut()
    router.replace('/(auth)')
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <BackButton />
        <View style={styles.spacer} />
      </View>

      <View style={styles.rows}>
        <Pressable
          onPress={() => { haptics.selection(); router.push('/(app)/profile/integrations') }}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.rowLabel}>INTEGRATIONS</Text>
          <Text style={styles.rowHint}>Spotify & more</Text>
        </Pressable>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.rowLabel}>SIGN OUT</Text>
          <Text style={styles.rowHint}>Step away</Text>
        </Pressable>

        <Pressable
          onPress={() => { haptics.selection(); router.push('/(app)/dev') }}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.rowLabel}>DEV TOOLS</Text>
          <Text style={styles.rowHint}>Internal</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  rows: { marginTop: 24, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1.2,
  },
  rowHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.subtle,
  },
})
