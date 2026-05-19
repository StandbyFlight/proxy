import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { EnrichmentRow, type EnrichmentState } from '../../../components/EnrichmentRow'

// Per group_plan §"profile/integrations". Mirrors the duty-free enrichment list
// shape from onboarding — same EnrichmentRow primitive, same "coming soon"
// honesty for providers whose OAuth flows aren't wired yet.

type Provider = {
  key: string
  label: string
  tagline: string
}

const PROVIDERS: Provider[] = [
  { key: 'spotify',    label: 'SPOTIFY',    tagline: 'Music taste. Shows up when it matters.' },
  { key: 'goodreads',  label: 'GOODREADS',  tagline: 'What you read says a lot.' },
  { key: 'letterboxd', label: 'LETTERBOXD', tagline: 'Film taste, no judgement.' },
  { key: 'beli',       label: 'BELI',       tagline: 'Restaurants you love. Helps us suggest where to meet.' },
  { key: 'linkedin',   label: 'LINKEDIN',   tagline: 'Headline only. We do not surface your job to strangers.' },
  { key: 'twitter',    label: 'TWITTER / X', tagline: 'Who you follow as a quiet interest signal.' },
]

export default function Integrations() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [states, setStates] = useState<Record<string, EnrichmentState>>({})

  function tap(key: string) {
    setStates(prev => ({ ...prev, [key]: 'coming_soon' }))
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => { haptics.buttonTap(); router.back() }}
            hitSlop={14}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.triangleSubtle}>{'◀'}</Text>
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
          <Text style={[type.eyebrow, styles.eyebrow]}>INTEGRATIONS</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Connect what's yours.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Each connection sharpens the matcher. None of it is shown to other travelers, only the single point of connection it produces.
        </Text>

        <View style={styles.list}>
          {PROVIDERS.map(p => (
            <EnrichmentRow
              key={p.key}
              provider={p.label}
              tagline={p.tagline}
              state={states[p.key] ?? 'idle'}
              onPress={() => tap(p.key)}
              note={states[p.key] === 'coming_soon' ? 'Wiring this up. Not live yet.' : undefined}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 24, gap: 14 },
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

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },
  list: { marginTop: 14 },
})
