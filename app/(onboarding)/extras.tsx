import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, ScrollView,
} from 'react-native'
import * as AuthSession from 'expo-auth-session'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { ProgressDashes } from '../../components/ProgressDashes'
import { EnrichmentRow, EnrichmentState } from '../../components/EnrichmentRow'
import { haptics } from '../../lib/haptics'
import {
  exchangeSpotifyCode,
  fetchTopArtists,
  saveSpotifyData,
} from '../../lib/spotify'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
}

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'proxy-app',
  path: 'spotify-callback',
})

type RowKey = 'spotify' | 'goodreads' | 'letterboxd' | 'beli' | 'email'

interface RowConfig {
  key: RowKey
  provider: string
  tagline: string
  comingSoon: boolean
}

const ROWS: RowConfig[] = [
  { key: 'spotify',    provider: 'Spotify',    tagline: "what you've been playing",    comingSoon: false },
  { key: 'goodreads',  provider: 'Goodreads',  tagline: "what you're reading",         comingSoon: true },
  { key: 'letterboxd', provider: 'Letterboxd', tagline: "what you've been watching",   comingSoon: true },
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

  // Spotify OAuth — PKCE, no client secret needed
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!,
      scopes: ['user-top-read'],
      usePKCE: true,
      redirectUri,
    },
    SPOTIFY_DISCOVERY,
  )

  useEffect(() => {
    if (!response) return
    if (response.type === 'cancel' || response.type === 'dismiss' || response.type === 'error') {
      setStates(s => ({ ...s, spotify: 'idle' }))
      return
    }
    if (response.type !== 'success') return

    const successResponse = response

    async function handleSuccess() {
      try {
        const { accessToken, refreshToken, expiresIn } = await exchangeSpotifyCode(
          successResponse.params.code,
          request!.codeVerifier!,
          redirectUri,
        )
        const artists = await fetchTopArtists(accessToken)
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await saveSpotifyData(session.user.id, accessToken, refreshToken, expiresIn, artists)
        }
        setStates(s => ({ ...s, spotify: 'connected' }))
        setNotes(n => ({
          ...n,
          spotify: artists.length > 0 ? artists.slice(0, 3).join(', ') : 'connected',
        }))
      } catch {
        setStates(s => ({ ...s, spotify: 'idle' }))
      }
    }

    handleSuccess()
  }, [response])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data } = await supabase
        .from('users')
        .select('email, email_verified, spotify_top_artists')
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
      const artists = data?.spotify_top_artists as string[] | null
      if (artists && artists.length > 0) {
        setStates(s => ({ ...s, spotify: 'connected' }))
        setNotes(n => ({ ...n, spotify: artists.slice(0, 3).join(', ') }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleRowPress(key: RowKey) {
    if (key === 'spotify') {
      if (states.spotify === 'connected' || states.spotify === 'connecting') return
      setStates(s => ({ ...s, spotify: 'connecting' }))
      promptAsync()
      return
    }

    const row = ROWS.find(r => r.key === key)!
    if (row.comingSoon) {
      if (states[key] === 'coming_soon') return
      setStates(s => ({ ...s, [key]: 'connecting' }))
      setNotes(n => ({ ...n, [key]: 'available soon, helps us match you on this signal' }))
      setTimeout(async () => {
        setStates(s => ({ ...s, [key]: 'coming_soon' }))
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const col = `${key}_interest` as const
          await supabase.from('users').update({ [col]: true }).eq('id', session.user.id)
        }
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
      setEmailError("That doesn't look like a valid email.")
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
    router.replace('/(app)/flight')
  }

  function handleBackTap(e: { nativeEvent: { pageX: number } }) {
    if (e.nativeEvent.pageX < SCREEN_WIDTH * 0.4) {
      haptics.buttonTap()
      if (router.canGoBack()) router.back()
      else router.replace('/(onboarding)/preview')
    }
  }

  const anyEngaged = Object.values(states).some(s => s !== 'idle')

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        {/* Header — left-tap = back only; right side does nothing on this page */}
        <Pressable onPress={handleBackTap} style={styles.topChrome} android_ripple={null}>
          <ProgressDashes step={4} total={4} />
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[type.headline, styles.title]}>
            A few more departures to log.
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
                        <Text style={styles.emailBtnText}>Send link</Text>
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
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable
            onPress={() => {
              haptics.buttonTap()
              if (router.canGoBack()) router.back()
              else router.replace('/(onboarding)/preview')
            }}
            hitSlop={16}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.triangleBack}>{'◀'}</Text>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Pressable
            onPress={done}
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.doneBtnText}>
              {anyEngaged ? 'TO YOUR FLIGHT' : 'SKIP FOR NOW'}
            </Text>
            <Text style={styles.triangleFwd}>{'▶'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topChrome: { marginBottom: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
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
    fontWeight: '600',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
  },
  backText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  triangleBack: { fontSize: 10, color: colors.subtle },
  triangleFwd: { fontSize: 10, color: colors.bg },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  doneBtnText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
})
