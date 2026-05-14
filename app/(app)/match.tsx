import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../lib/theme'
import { fonts, type } from '../../lib/typography'
import { haptics } from '../../lib/haptics'
import { supabase } from '../../lib/supabase'
import { FlipBoard } from '../../components/FlipBoard'

// Per app_plan §4.5: the match screen reveals exactly one curated point of
// connection in natural language. No name, no industry, no destination — only
// the one reason to sit down across from each other. Same shape for high-
// confidence and curiosity matches; the philosophy says one reason, period.

const REVEAL_CELL_SIZE = 22
const MAX_CHARS_PER_LINE = 14
const PER_CELL_STAGGER_MS = 70
const PER_LINE_DELAY_MS = 260
const FIRST_LINE_OFFSET_MS = 500

type MatchData = {
  id: string
  pointOfConnection: string | null
  theirIntent: string
  theirPurpose: string | null
  destinationIata: string | null
}

const PURPOSE_LABEL: Record<string, string> = {
  conference: 'a conference',
  work_trip: 'a work trip',
  solo_travel: 'solo travel',
  relocating: 'relocating',
  other: 'travel',
}

const INTENT_LABEL: Record<string, string> = {
  professional: 'professional connections',
  social: 'social connections',
  open: 'open to anything',
}

// Server-side `point_of_connection` is the canonical reason. If the algorithm
// hasn't provided one, fall back to a single short sentence built from intent
// + destination — never expose name, industry, or other identifying detail.
function buildOneReason(match: MatchData): string {
  if (match.pointOfConnection) return match.pointOfConnection
  const intentStr = INTENT_LABEL[match.theirIntent] ?? 'something new'
  const purposeStr = match.theirPurpose ? PURPOSE_LABEL[match.theirPurpose] : null
  const destStr = match.destinationIata ? ` to ${match.destinationIata}` : ''
  if (purposeStr) return `someone heading${destStr} for ${purposeStr}`
  return `someone open to ${intentStr}`
}

// Greedy word-wrap into lines of at most maxLen characters. Keeps words intact.
function wrapLines(text: string, maxLen: number): string[] {
  const words = text.toUpperCase().replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if (!current) { current = w; continue }
    if (current.length + 1 + w.length <= maxLen) current += ' ' + w
    else { lines.push(current); current = w }
  }
  if (current) lines.push(current)
  return lines
}

export default function MatchScreen() {
  const { match_id } = useLocalSearchParams<{ match_id: string }>()
  const [match, setMatch] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState(false)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => { loadMatch() }, [match_id])

  async function loadMatch() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error: matchErr } = await supabase
        .from('matches')
        .select(`
          id, point_of_connection,
          session_id_a, session_id_b,
          session_a:sessions!session_id_a(user_id, connection_intent, travel_purpose, destination_iata),
          session_b:sessions!session_id_b(user_id, connection_intent, travel_purpose, destination_iata)
        `)
        .eq('id', match_id)
        .single()

      if (matchErr) throw matchErr

      const sessionA = Array.isArray(data.session_a) ? data.session_a[0] : data.session_a
      const sessionB = Array.isArray(data.session_b) ? data.session_b[0] : data.session_b
      const iAmA = sessionA?.user_id === session.user.id
      const theirSession = iAmA ? sessionB : sessionA

      setMatch({
        id: data.id,
        pointOfConnection: data.point_of_connection ?? null,
        theirIntent: theirSession?.connection_intent ?? 'open',
        theirPurpose: theirSession?.travel_purpose ?? null,
        destinationIata: theirSession?.destination_iata ?? null,
      })
    } catch (err: any) {
      setError(err.message ?? 'Could not load match.')
    } finally {
      setLoading(false)
    }
  }

  async function respond(interested: boolean) {
    if (!match || acting) return
    setActing(true)
    if (interested) haptics.success()
    else haptics.selection()
    await supabase
      .from('matches')
      .update({ status: interested ? 'accepted' : 'declined' })
      .eq('id', match.id)
    if (interested) {
      router.replace({ pathname: '/(app)/meetup', params: { match_id: match.id } })
    } else {
      router.replace('/(app)/')
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <FlipBoard label="STANDBY" cellSize={32} initialFlipMs={900} staggerMs={120} />
      </View>
    )
  }

  if (error || !match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <Pressable
          onPress={() => router.replace('/(app)/')}
          hitSlop={14}
          style={styles.backBtn}
        >
          <Text style={styles.triangleSubtle}>{'◀'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={styles.body}>
          <Text style={[type.subhead, styles.errorLine]}>
            {error || 'Could not load match.'}
          </Text>
        </View>
      </View>
    )
  }

  const reason = buildOneReason(match)
  const lines = wrapLines(reason, MAX_CHARS_PER_LINE)

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
      {/* Top chrome */}
      <View style={styles.topRow}>
        <Text style={[type.eyebrow, styles.eyebrow]}>MATCH · 01</Text>
      </View>

      {/* Body — sentence flips in */}
      <View style={styles.body}>
        <Text style={[type.subhead, styles.subhead]}>
          one reason to sit down across from each other.
        </Text>

        <View style={styles.reveal}>
          {lines.map((line, idx) => (
            <View key={`l-${idx}-${line}`} style={styles.lineWrap}>
              <FlipBoard
                label={line}
                cellSize={REVEAL_CELL_SIZE}
                staggerMs={PER_CELL_STAGGER_MS}
                initialFlipMs={
                  FIRST_LINE_OFFSET_MS +
                  idx * (MAX_CHARS_PER_LINE * PER_CELL_STAGGER_MS + PER_LINE_DELAY_MS)
                }
              />
            </View>
          ))}
        </View>

        <Text style={styles.privacyNote}>
          THEIR NAME STAYS HIDDEN UNTIL YOU BOTH SAY YES.
        </Text>
      </View>

      {/* Footer — MEET THEM / SKIP */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={() => respond(false)}
          disabled={acting}
          hitSlop={14}
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>

        <Pressable
          onPress={() => respond(true)}
          disabled={acting}
          style={({ pressed }) => [
            styles.meetBtn,
            pressed && { opacity: 0.85 },
            acting && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.meetTriangle}>{'▶'}</Text>
          <Text style={styles.meetText}>MEET THEM</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topRow: { alignItems: 'center' },
  eyebrow: { color: colors.subtle },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  subhead: {
    color: colors.subtle,
    textAlign: 'center',
  },
  reveal: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 4,
  },
  lineWrap: {
    alignItems: 'center',
  },
  privacyNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.subtle,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  skipText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
    letterSpacing: 1.4,
  },
  meetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    minWidth: 160,
  },
  meetTriangle: {
    fontSize: 10,
    color: colors.bg,
    includeFontPadding: false,
  },
  meetText: {
    fontFamily: fonts.mono,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  triangleSubtle: {
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
  errorLine: { color: colors.text, textAlign: 'center' },
})
