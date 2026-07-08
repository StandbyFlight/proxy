import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors, radius, spacing, shadow } from '../../lib/theme'
import { type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { disconnectAbly } from '../../lib/ably'
import { haptics } from '../../lib/haptics'
import { BackButton } from '../../components/BackButton'
import { GradientBackground } from '../../components/ui'

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
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.topRow}>
          <BackButton />
          <View style={styles.spacer} />
        </View>

        <View style={styles.rows}>
          <Pressable
            onPress={() => { haptics.selection(); router.push('/(app)/profile/integrations') }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowLabel}>INTEGRATIONS</Text>
            <Text style={styles.rowHint}>Spotify & more</Text>
          </Pressable>

          <Pressable
            onPress={signOut}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowLabel}>SIGN OUT</Text>
            <Text style={styles.rowHint}>Step away</Text>
          </Pressable>

          <Pressable
            onPress={() => { haptics.selection(); router.push('/(app)/dev') }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowLabel}>DEV TOOLS</Text>
            <Text style={styles.rowHint}>Internal</Text>
          </Pressable>
        </View>
      </View>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: { width: 64 },

  rows: { marginTop: 24, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: colors.glassWhite,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 18,
    ...shadow.sm,
  },
  rowPressed: { opacity: 0.6, transform: [{ scale: 0.99 }] },
  rowLabel: {
    ...type.label,
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  rowHint: {
    ...type.caption,
    color: colors.textSecondary,
  },
})
