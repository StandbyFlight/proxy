import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { supabase } from '../../lib/supabase'
import { disconnectAbly } from '../../lib/ably'
import { haptics } from '../../lib/haptics'

// Minimal settings page — host for sign-out + dev tools so the waiting-screen
// gear icon has somewhere to land. Will grow into a real settings surface later.

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
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={[type.eyebrow, styles.eyebrow]}>SETTINGS</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>Off the board.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Step away from the gate, or peek at the developer tools.
        </Text>

        <View style={styles.rows}>
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={styles.rowLabel}>SIGN OUT</Text>
            <Text style={styles.rowHint}>End this session</Text>
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangle: {
    fontSize: 10,
    color: colors.subtle,
    includeFontPadding: false,
  },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  eyebrow: { color: colors.subtle },
  spacer: { width: 60 },
  body: {
    marginTop: 32,
    gap: 16,
  },
  headline: { color: colors.text },
  subhead: { color: colors.subtle, marginTop: -4 },
  rows: { marginTop: 24, gap: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  rowPressed: { opacity: 0.5 },
  rowLabel: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1.4,
  },
  rowHint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1,
  },
})
