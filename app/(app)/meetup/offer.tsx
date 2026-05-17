import { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { FlipBoard } from '../../../components/FlipBoard'

// Per group_plan §"meetup/offer": shows the partner venue, the perk, and a
// unique redemption code derived from the match (last 8 chars of match_id) or
// group_id. Venue partnerships are a phase-3 GTM lever (app_plan §21).
// At MVP this is honestly a placeholder: the venue list is not wired up.

export default function MeetupOffer() {
  const params = useLocalSearchParams<{ match_id?: string; group_id?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [redeemed, setRedeemed] = useState(false)

  const code = useMemo(() => {
    const id = params.match_id || params.group_id || ''
    return (id.replace(/-/g, '').slice(-8) || '00000000').toUpperCase()
  }, [params.match_id, params.group_id])

  function redeem() {
    if (redeemed) return
    haptics.standbyStamp()
    setRedeemed(true)
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
        <Text style={[type.eyebrow, styles.eyebrow]}>OFFER · DUTY FREE</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        <Text style={[type.subhead, styles.subhead]}>On the house, sort of.</Text>
        <Text style={[type.headline, styles.headline]}>Hudson News café{'\n'}has you covered.</Text>
        <Text style={[type.subhead, styles.detail]}>
          Two coffees or pastries, on us, when you meet at the table near gate B17.
        </Text>

        <View style={styles.codeWrap}>
          <Text style={styles.codeLabel}>SHOW AT REGISTER</Text>
          <FlipBoard
            label={code}
            cellSize={26}
            initialFlipMs={500}
            staggerMs={70}
          />
        </View>

        <Text style={styles.expires}>VALID ONCE · EXPIRES AT FLIGHT DEPARTURE</Text>

        <View style={styles.placeholderBlock}>
          <Text style={styles.placeholderLabel}>HEADS UP</Text>
          <Text style={styles.placeholderBody}>
            Venue partnerships are still being lined up. Treat this offer as a preview of what these meetups will eventually unlock.
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={redeem}
          disabled={redeemed}
          style={({ pressed }) => [
            styles.primaryBtn,
            redeemed && styles.primaryBtnRedeemed,
            pressed && !redeemed && { opacity: 0.85 },
          ]}
        >
          <Text style={[styles.primaryBtnText, redeemed && { color: colors.subtle }]}>
            {redeemed ? 'REDEEMED' : 'MARK AS REDEEMED'}
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

  body: { flex: 1, gap: 16, paddingTop: 16 },
  subhead: { color: colors.subtle },
  headline: { color: colors.text },
  detail: { color: colors.text, marginTop: 4 },

  codeWrap: { alignItems: 'flex-start', gap: 8, marginTop: 20 },
  codeLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  expires: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginTop: 8,
  },

  placeholderBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 14,
    marginTop: 8,
    gap: 6,
  },
  placeholderLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  placeholderBody: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
  },

  footer: { paddingTop: 12 },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnRedeemed: { backgroundColor: colors.bg, borderWidth: 1, borderColor: 'rgba(10,10,10,0.18)' },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
})
