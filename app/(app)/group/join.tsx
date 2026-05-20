import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'

// A group is already forming for this event. Newcomer sees who's there
// (headcount + first names) but not the location — that's revealed on join.
// JOIN THEM commits + enters the room; FIND MY OWN drops back to the seed pool.

const PLACEHOLDER_MEMBERS = ['MAYA', 'JORDAN']

export default function GroupJoin() {
  const {
    group_id,
    event_id,
    event_name,
    meetup_location,
    window_expires_at,
    member_names,
  } = useLocalSearchParams<{
    group_id?: string
    event_id?: string
    event_name?: string
    meetup_location?: string
    window_expires_at?: string
    member_names?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const eventName = event_name?.trim() || 'YOUR EVENT'
  const members = member_names
    ? member_names.split(',').map(s => s.trim()).filter(Boolean)
    : PLACEHOLDER_MEMBERS

  function joinThem() {
    haptics.buttonTap()
    // TODO(backend): write group_members row for this user, then navigate.
    // For now the room renders with the params it gets; the backend fills in
    // meetup_location once the join handler ships.
    router.replace({
      pathname: '/(app)/group/room',
      params: {
        group_id: group_id ?? '',
        event_name: eventName,
        meetup_location: meetup_location ?? '',
        member_names: members.join(','),
        window_expires_at: window_expires_at ?? '',
        is_seed: 'false',
      },
    })
  }

  function findMyOwn() {
    haptics.selection()
    router.replace({
      pathname: '/(app)/group/searching',
      params: {
        event_id: event_id ?? '',
        event_name: eventName,
      },
    })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      <View style={styles.topRow}>
        <Text style={[type.eyebrow, styles.eyebrow]}>EVENT MODE · JOIN</Text>
      </View>

      <View style={styles.body}>
        <Text style={[type.headline, styles.headline]}>{eventName}</Text>
        <Text style={[type.subhead, styles.subhead]}>
          People are already gathering. Step in.
        </Text>

        <View style={styles.memberBlock}>
          <Text style={styles.sectionLabel}>
            {members.length} ALREADY HERE
          </Text>
          <View style={styles.memberList}>
            {members.map((name, i) => (
              <View key={name + i} style={styles.memberRow}>
                <Text style={styles.memberName}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          The meeting spot shows up once you're in.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={joinThem}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.triangleOnRed}>{'▶'}</Text>
          <Text style={styles.primaryBtnText}>JOIN THEM</Text>
        </Pressable>

        <Pressable
          onPress={findMyOwn}
          hitSlop={14}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.secondaryBtnText}>FIND MY OWN</Text>
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
    paddingVertical: 10,
  },
  eyebrow: { color: colors.subtle },

  body: { flex: 1, justifyContent: 'center', gap: 18 },
  headline: { color: colors.text },
  subhead: { color: colors.subtle },

  memberBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.16)',
    paddingTop: 14,
    gap: 10,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  memberList: { gap: 6 },
  memberRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  memberName: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1.2,
  },

  note: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    lineHeight: 20,
    marginTop: 8,
  },

  footer: { paddingTop: 12, gap: 12, alignItems: 'stretch' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },
  triangleOnRed: { fontSize: 10, color: colors.bg, includeFontPadding: false },

  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
})
