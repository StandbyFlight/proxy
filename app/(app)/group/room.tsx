import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Pressable, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { supabase } from '../../../lib/supabase'
import { getAblyClient, groupChannelName } from '../../../lib/ably'
import type Ably from 'ably'

// The active group room — terminal screen for event mode. Lands here from
// either the seed-pair formation (is_seed=true) or from group/join.
//
// Window state: the join window is "open" while time remains and member count
// is < 8. The same UI collapse happens whether the timer ran out or the cap
// closed it — both hide the countdown + spots line.
//
// Chat is a placeholder: the messages table doesn't carry group_id in the live
// DB yet, so the input is disabled and the empty state explains it.

const GROUP_CAP = 8
const DEFAULT_WINDOW_MS = 29 * 60_000
const DEFAULT_LOCATION = 'Hudson News café, Terminal B.'
const PLACEHOLDER_MEMBERS = ['MAYA', 'JORDAN']

export default function GroupRoom() {
  const params = useLocalSearchParams<{
    group_id?: string
    event_name?: string
    meetup_location?: string
    member_names?: string
    window_expires_at?: string
    is_seed?: string
  }>()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/(auth)'); return }
    }
    check()
  }, [])

  const groupId = params.group_id ?? ''
  const eventName = (params.event_name?.trim() || 'YOUR EVENT').toUpperCase()
  const isSeed = params.is_seed === 'true'

  // Resolve window_expires_at to a real Date. Spec says: if not passed, use
  // now + 29 min (≈ the seed window) so local testing isn't immediate-zero.
  const windowExpiresAt = useMemo(() => {
    if (params.window_expires_at) {
      const t = Date.parse(params.window_expires_at)
      if (!isNaN(t)) return t
    }
    return Date.now() + DEFAULT_WINDOW_MS
  }, [params.window_expires_at])

  // Members. The list passed in is everyone *but* you — we tack YOU on the end.
  const [members, setMembers] = useState<string[]>(() => {
    const passed = params.member_names
      ? params.member_names.split(',').map(s => s.trim()).filter(Boolean)
      : PLACEHOLDER_MEMBERS
    return [...passed, 'YOU']
  })

  // Meetup location, mutable for the seed pair only.
  const [location, setLocation] = useState<string>(
    params.meetup_location?.trim() || DEFAULT_LOCATION
  )
  const [editing, setEditing] = useState(false)
  const [draftLocation, setDraftLocation] = useState(location)

  // Countdown.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Forced-closed flag — set when Ably tells us the backend closed the window
  // for a reason we couldn't infer client-side. The countdown / spots also
  // collapse on their own when timer == 0 or members.length >= cap.
  const [windowClosed, setWindowClosed] = useState(false)

  const memberCount = members.length
  const timeLeftMs = Math.max(0, windowExpiresAt - now)
  const windowOpen = !windowClosed && timeLeftMs > 0 && memberCount < GROUP_CAP
  const spotsLeft = Math.max(0, GROUP_CAP - memberCount)
  const isGroupChat = memberCount >= 3

  // Ably listener — stubbed at MVP. Channel name + events are the contract
  // the backend will implement against.
  useEffect(() => {
    if (!groupId) return
    let cancelled = false

    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      const ably = getAblyClient(session.user.id)
      const channel = ably.channels.get(groupChannelName(groupId))
      channelRef.current = channel

      channel.subscribe('member.joined', (msg) => {
        const data = msg.data as { first_name?: string }
        const name = (data.first_name ?? '').trim().toUpperCase()
        if (!name) return
        setMembers(prev => (
          prev.includes(name) ? prev : [...prev.slice(0, -1), name, 'YOU']
        ))
      })

      channel.subscribe('location.updated', (msg) => {
        const data = msg.data as { meetup_location?: string }
        if (typeof data.meetup_location === 'string' && data.meetup_location.trim()) {
          setLocation(data.meetup_location)
        }
      })

      channel.subscribe('window.closed', () => {
        setWindowClosed(true)
      })
    }

    subscribe()
    return () => {
      cancelled = true
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [groupId])

  function startEdit() {
    if (!isSeed) return
    haptics.selection()
    setDraftLocation(location)
    setEditing(true)
  }

  const saveEdit = useCallback(() => {
    const next = draftLocation.trim()
    if (!next) { setEditing(false); return }
    haptics.buttonTap()
    setLocation(next)
    setEditing(false)
    // Stubbed broadcast — backend will replace with a server-validated write.
    channelRef.current?.publish('location.updated', { meetup_location: next })
      .catch(() => {})
  }, [draftLocation])

  function cancelEdit() {
    haptics.selection()
    setEditing(false)
    setDraftLocation(location)
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => { haptics.buttonTap(); router.replace('/(app)/') }}
          hitSlop={14}
          style={({ pressed }) => [styles.leaveBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.leaveText}>LEAVE</Text>
        </Pressable>

        <Text style={[type.eyebrow, styles.eyebrow]}>EVENT · {eventName}</Text>

        {editing ? (
          <View style={styles.editBlock}>
            <TextInput
              value={draftLocation}
              onChangeText={setDraftLocation}
              autoFocus
              multiline
              maxLength={140}
              selectionColor={colors.accent}
              style={[type.headline, styles.headline, styles.editInput]}
              placeholder="Where should everyone meet?"
              placeholderTextColor={colors.subtle}
            />
            <View style={styles.editActions}>
              <Pressable
                onPress={cancelEdit}
                hitSlop={14}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.5 }]}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={saveEdit}
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.saveText}>SAVE LOCATION</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={startEdit}
            disabled={!isSeed}
            style={({ pressed }) => [styles.locationBlock, isSeed && pressed && { opacity: 0.5 }]}
          >
            <Text style={[type.headline, styles.headline]}>{location}</Text>
            {isSeed ? (
              <Text style={styles.editHint}>TAP TO EDIT</Text>
            ) : null}
          </Pressable>
        )}

        {windowOpen ? (
          <View style={styles.windowBlock}>
            <View style={styles.countdownRow}>
              <Text style={styles.countdownLabel}>OTHERS CAN JOIN FOR</Text>
              <Text style={styles.countdownValue}>{formatCountdown(timeLeftMs)}</Text>
            </View>
            <Text style={styles.spotsText}>
              {spotsLeft} {spotsLeft === 1 ? 'SPOT' : 'SPOTS'} LEFT
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHO'S HERE</Text>
          <View style={styles.memberList}>
            {members.map((name, i) => (
              <View key={name + i} style={styles.memberRow}>
                <Text style={styles.memberName}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MESSAGES</Text>
          <View style={styles.chatBox}>
            <Text style={styles.chatEmpty}>
              {isGroupChat
                ? 'Chat coming once the group is set.'
                : 'Just the two of you for now.'}
            </Text>
          </View>
          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              editable={false}
              placeholder={isGroupChat ? 'Group chat is on its way.' : 'A logistics line for the two of you.'}
              placeholderTextColor={colors.subtle}
            />
            <View style={styles.sendBtnDisabled}>
              <Text style={styles.sendBtnText}>SEND</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 18 },

  eyebrow: { color: colors.subtle },

  leaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  triangleSubtle: { fontSize: 10, color: colors.subtle, includeFontPadding: false },
  leaveText: { fontFamily: fonts.mono, fontSize: 12, color: colors.subtle, letterSpacing: 1.4 },

  locationBlock: { gap: 4 },
  headline: { color: colors.text },
  editHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
    marginTop: 2,
  },

  editBlock: { gap: 10 },
  editInput: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
  },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  cancelText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.bg,
  },

  windowBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.16)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.16)',
    paddingVertical: 12,
    gap: 6,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  countdownValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  spotsText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },

  section: { gap: 10 },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
  },
  memberList: { gap: 0 },
  memberRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10,10,10,0.08)',
  },
  memberName: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 1.2,
  },

  chatBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,10,10,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 24,
    alignItems: 'center',
  },
  chatEmpty: {
    fontFamily: fonts.serifItalic,
    fontSize: 14,
    color: colors.subtle,
    textAlign: 'center',
  },

  composerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.subtle,
    borderWidth: 1,
    borderColor: 'rgba(10,10,10,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    backgroundColor: 'rgba(10,10,10,0.03)',
  },
  sendBtnDisabled: {
    backgroundColor: colors.text,
    opacity: 0.18,
    paddingHorizontal: 18,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
})
