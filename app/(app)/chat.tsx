import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { BackButton } from '../../components/BackButton'

// Logistics-only chat for matched users. Per app_plan §3.4 the framing is
// "in case you can't find each other" — a fallback thread, not a chat product.
// Realtime subscription on INSERTs scoped to this match's messages.

type Message = {
  id: string
  sender_id: string
  content: string
  sent_at: string
}

export default function ChatScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string>('Them')
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Initial load: resolve which side of the match I'm on (for the partner's
  // name) and pull the existing message history. Mirrors the partner-name
  // pattern in meetup.tsx — query matches → session_a/session_b →
  // users!user_id(first_name).
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      setMyUserId(session.user.id)

      const { data: match } = await supabase
        .from('matches')
        .select(`
          session_id_a, session_id_b,
          session_a:sessions!session_id_a(
            user_id,
            users!user_id(first_name)
          ),
          session_b:sessions!session_id_b(
            user_id,
            users!user_id(first_name)
          )
        `)
        .eq('id', match_id)
        .single()

      if (!cancelled && match) {
        const sa = Array.isArray(match.session_a) ? match.session_a[0] : match.session_a
        const sb = Array.isArray(match.session_b) ? match.session_b[0] : match.session_b
        const amA = sa?.user_id === session.user.id
        const theirSession = amA ? sb : sa
        const theirUser = theirSession?.users
          ? (Array.isArray(theirSession.users) ? theirSession.users[0] : theirSession.users)
          : null
        setPartnerName(theirUser?.first_name ?? 'Them')
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('messages')
        .select('id, sender_id, content, sent_at')
        .eq('match_id', match_id)
        .order('sent_at', { ascending: true })

      if (cancelled) return
      if (msgsErr) setError(msgsErr.message)
      setMessages(msgs ?? [])
      setLoading(false)
      // Initial scroll-to-bottom; the layout isn't measured yet so wait a tick.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80)
    }
    load()
    return () => { cancelled = true }
  }, [match_id])

  // Realtime: append new INSERTs for this match. Dedupe by id because the
  // sender adds the row locally on send, and the realtime echo would
  // otherwise produce a duplicate.
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${match_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match_id}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [match_id])

  async function send() {
    const content = draft.trim()
    if (!content || !myUserId || sending) return
    setSending(true)
    setError('')

    const { data, error: insertErr } = await supabase
      .from('messages')
      .insert({
        match_id,
        sender_id: myUserId,
        content,
        sent_at: new Date().toISOString(),
      })
      .select('id, sender_id, content, sent_at')
      .single()

    if (insertErr) {
      haptics.error()
      setError(insertErr.message)
      setSending(false)
      return
    }

    if (data) {
      setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]))
    }
    setDraft('')
    setSending(false)
    haptics.success()
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.topRow, { paddingTop: insets.top + 14 }]}>
        <BackButton />
      </View>

      <View style={styles.header}>
        <Text style={[type.headline, styles.headline]}>{partnerName}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.subtle} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>
              For finding each other. Not for small talk.
            </Text>
          ) : (
            messages.map((m, i) => {
              const mine = m.sender_id === myUserId
              const prev = messages[i - 1]
              const newBlock = !prev || prev.sender_id !== m.sender_id
              return (
                <View
                  key={m.id}
                  style={[
                    styles.msgRow,
                    mine ? styles.msgRowMine : styles.msgRowTheirs,
                    { marginTop: newBlock ? 14 : 4 },
                  ]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                      {m.content}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>{formatTime(m.sent_at)}</Text>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Where are you?"
          placeholderTextColor={colors.subtle}
          multiline
          maxLength={400}
          selectionColor={colors.accent}
          editable={!sending}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtn,
            (!draft.trim() || sending) && styles.sendBtnDisabled,
            pressed && draft.trim() && !sending && { opacity: 0.85 },
          ]}
        >
          {sending
            ? <ActivityIndicator color={colors.onAccent} />
            : <Text style={styles.sendBtnText}>SEND</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 6,
  },
  eyebrow: { color: colors.subtle },
  headline: { color: colors.text },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.subtle,
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  msgRow: { width: '100%' },
  msgRowMine: { alignItems: 'flex-end' },
  msgRowTheirs: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: colors.text },
  bubbleTheirs: { backgroundColor: colors.periwinkle },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  },
  bubbleTextMine: { color: colors.onAccent },
  bubbleTextTheirs: { color: colors.text },
  timeText: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.subtle,
    marginTop: 4,
    paddingHorizontal: 4,
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.error,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.text, opacity: 0.18 },
  sendBtnText: {
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
})
