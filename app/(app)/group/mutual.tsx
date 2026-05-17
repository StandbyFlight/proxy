import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'

// Group mutual: the table has locked. Each member sees first names + the
// suggested meetup spot and confirms with "I'll be there."

// Placeholder seat list until the group backend ships. Real implementation
// reads group_members and updates `confirmed` per row.
const PLACEHOLDER_SEATS = ['YOU', 'MAYA', 'JORDAN', 'ALEX']

export default function GroupMutual() {
  const { event_name } = useLocalSearchParams<{ event_name?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [confirmed, setConfirmed] = useState(false)

  function confirm() {
    if (confirmed) return
    haptics.standbyStamp()
    setConfirmed(true)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => { haptics.buttonTap(); router.back() }}
          hitSlop={14}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <Text style={[type.eyebrow, styles.eyebrow]}>GROUP · LOCKED</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.subhead, styles.subhead]}>The table is set.</Text>
        {event_name ? (
          <Text style={[type.headline, styles.headline]}>{event_name}</Text>
        ) : (
          <Text style={[type.headline, styles.headline]}>Four strangers, same flight cluster.</Text>
        )}

        <View style={styles.seatList}>
          <Text style={styles.seatHeader}>YOUR TABLE</Text>
          {PLACEHOLDER_SEATS.map((name, idx) => (
            <View key={name + idx} style={styles.seatRow}>
              <Text style={styles.seatName}>{name}</Text>
              <Text style={styles.seatStatus}>
                {idx === 0 && confirmed ? 'CONFIRMED' : idx === 0 ? '—' : 'PENDING'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.locationBlock}>
          <Text style={styles.locationLabel}>SUGGESTED SPOT</Text>
          <Text style={styles.locationText}>Hudson News café, between B14 and B20.</Text>
          <Text style={styles.locationTime}>45 MIN BEFORE EARLIEST DEPARTURE</Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={confirm}
          disabled={confirmed}
          style={({ pressed }) => [
            styles.primaryBtn,
            confirmed && styles.primaryBtnConfirmed,
            pressed && !confirmed && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.triangleOnRed, confirmed && { color: colors.accent }]}>
            {confirmed ? '✓' : '▶'}
          </Text>
          <Text style={[styles.primaryBtnText, confirmed && { color: colors.accent }]}>
            {confirmed ? "YOU'RE IN" : "I'LL BE THERE"}
          </Text>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  backText: { fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, letterSpacing: 1.4 },
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  body: { flex: 1, gap: 18, paddingTop: 12 },
  subhead: { color: colors.subtle },
  headline: { color: colors.text },

  seatList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.16)',
    paddingTop: 14,
    gap: 10,
    marginTop: 4,
  },
  seatHeader: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginBottom: 4,
  },
  seatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  seatName: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1.2,
  },
  seatStatus: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.subtle,
    letterSpacing: 1.4,
  },

  locationBlock: { gap: 6, marginTop: 4 },
  locationLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  locationText: {
    fontFamily: fonts.serifBold,
    fontSize: 17,
    color: colors.text,
  },
  locationTime: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.subtle,
  },

  footer: { paddingTop: 12, alignItems: 'stretch' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 14,
  },
  primaryBtnConfirmed: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },
})
