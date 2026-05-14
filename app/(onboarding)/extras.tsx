import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { ProgressDashes } from '../../components/ProgressDashes'
import { EnrichmentRow, EnrichmentState } from '../../components/EnrichmentRow'

// Optional enrichment — the user is technically done. Each row is a soft
// invitation: "more shots on goal." Tapping a placeholder shows an inline
// "coming soon" note (no OAuth wired up yet per app_plan §3 / §14).
// The EMAIL row is real — it uses Supabase's updateUser flow which sends a
// confirmation link to verify the email.

type RowKey = 'spotify' | 'goodreads' | 'letterboxd' | 'beli' | 'email'

interface RowConfig {
  key: RowKey
  provider: string
  tagline: string
  comingSoon: boolean
}

const ROWS: RowConfig[] = [
  { key: 'spotify',    provider: 'Spotify',    tagline: 'what you’ve been playing',    comingSoon: true },
  { key: 'goodreads',  provider: 'Goodreads',  tagline: 'what you’re reading',         comingSoon: true },
  { key: 'letterboxd', provider: 'Letterboxd', tagline: 'what you’ve been watching',   comingSoon: true },
  { key: 'beli',       provider: 'Beli',       tagline: 'where you eat',               comingSoon: true },
  { key: 'email',      provider: 'Email',      tagline: 'verifies your .edu',          comingSoon: false },
]

export default function Extras() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [states, setStates] = useState<Record<RowKey, EnrichmentState>>({
    spotify: 'idle', goodreads: 'idle', letterboxd: 'idle', beli: 'idle', email: 'idle',
  })
  const [notes, setNotes] = useState<Partial<Record<RowKey, string>>>({})

  const [emailExpanded, setEmailExpanded] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  // Reflect existing verified email on mount.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data } = await supabase
        .from('users')
        .select('email, email_verified')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (data?.email_verified) {
        setStates(s => ({ ...s, email: 'connected' }))
        setNotes(n => ({ ...n, email: `verified · ${data.email}` }))
      } else if (data?.email) {
        setEmailInput(data.email)
        setNotes(n => ({ ...n, email: `pending · check ${data.email}` }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleRowPress(key: RowKey) {
    const row = ROWS.find(r => r.key === key)!
    if (row.comingSoon) {
      // Quick flash that lets the user feel the row was touched without claiming
      // anything was actually persisted.
      setStates(s => ({ ...s, [key]: 'connecting' }))
      setNotes(n => ({ ...n, [key]: 'available soon — helps us match you on this signal' }))
      setTimeout(() => {
        setStates(s => ({ ...s, [key]: 'coming_soon' }))
      }, 350)
      return
    }
    if (key === 'email') {
      setEmailExpanded(v => !v)
    }
  }

  async function sendEmailLink() {
    const trimmed = emailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('That doesn’t look like a valid email.')
      return
    }
    setEmailError('')
    setStates(s => ({ ...s, email: 'connecting' }))
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    if (error) {
      setStates(s => ({ ...s, email: 'idle' }))
      setEmailError(error.message)
      return
    }
    // Mirror onto the users row for downstream queries.
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase
        .from('users')
        .update({ email: trimmed, email_verified: false })
        .eq('id', session.user.id)
    }
    setStates(s => ({ ...s, email: 'connecting' }))
    setNotes(n => ({ ...n, email: `pending · check ${trimmed}` }))
    setEmailExpanded(false)
  }

  function done() {
    router.replace('/(app)')
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.topChrome}>
          <ProgressDashes step={4} total={4} />
          <Text style={[type.eyebrow, styles.eyebrow]}>Duty Free · Optional</Text>
        </View>

        <View style={styles.scroll}>
          <Text style={[type.headline, styles.title]}>
            A few more shots on goal.
          </Text>
          <Text style={[type.subhead, styles.subtitle]}>
            Each connection gives us one more reason to introduce you to someone.
          </Text>

          <View style={styles.list}>
            {ROWS.map(row => (
              <View key={row.key}>
                <EnrichmentRow
                  provider={row.provider}
                  tagline={row.tagline}
                  state={states[row.key]}
                  onPress={() => handleRowPress(row.key)}
                  note={notes[row.key]}
                />
                {row.key === 'email' && emailExpanded ? (
                  <View style={styles.emailPanel}>
                    <TextInput
                      style={styles.emailInput}
                      placeholder="you@school.edu"
                      placeholderTextColor={colors.subtle}
                      value={emailInput}
                      onChangeText={setEmailInput}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      selectionColor={colors.accent}
                      onSubmitEditing={sendEmailLink}
                    />
                    <Pressable
                      onPress={sendEmailLink}
                      disabled={states.email === 'connecting'}
                      style={({ pressed }) => [
                        styles.emailBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {states.email === 'connecting' ? (
                        <ActivityIndicator color={colors.bg} />
                      ) : (
                        <Text style={styles.emailBtnText}>Send link  →</Text>
                      )}
                    </Pressable>
                    {emailError ? (
                      <Text style={styles.emailError}>{emailError}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable
            onPress={done}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.doneText}>Take me home  →</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topChrome: { gap: 12, marginBottom: 24 },
  eyebrow: { color: colors.subtle },
  scroll: { flex: 1 },
  title: { color: colors.text },
  subtitle: { color: colors.subtle, marginTop: 10 },
  list: { marginTop: 28 },

  emailPanel: {
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  emailInput: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingVertical: 8,
  },
  emailBtn: {
    backgroundColor: colors.text,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  emailBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  emailError: {
    ...type.bodyItalic,
    fontSize: 13,
    color: colors.error,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10,10,10,0.08)',
  },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
})
