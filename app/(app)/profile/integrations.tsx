import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { type } from '../../../lib/typography'
import { EnrichmentRow, type EnrichmentState } from '../../../components/EnrichmentRow'
import { BackButton } from '../../../components/BackButton'

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
          <BackButton fallback="/(app)/settings" />
          <Text style={[type.eyebrow, styles.eyebrow]}>INTEGRATIONS</Text>
          <View style={styles.spacer} />
        </View>

        <Text style={[type.headline, styles.headline]}>Connect what's yours.</Text>
        <Text style={[type.subhead, styles.subhead]}>
          Connections sharpen the matcher — nothing is shown to other travelers.
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
  eyebrow: { color: colors.subtle },
  spacer: { width: 64 },

  headline: { color: colors.text, marginTop: 4 },
  subhead: { color: colors.subtle, marginTop: -2 },
  list: { marginTop: 14 },
})
