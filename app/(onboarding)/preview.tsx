import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { type } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { ManifestBoard } from '../../components/ManifestBoard'
import { primaryIataForCity } from '../../lib/cities'

// Profile preview — the onboarding payoff. The user's assembled row flips
// onto a departure board with STATUS settling on STANDBY last. No input;
// pure declaration: "you're on the board now."

export default function Preview() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [iata, setIata] = useState('···')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      const { data } = await supabase
        .from('users')
        .select('first_name, base_city')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (data?.first_name) setFirstName(data.first_name)
      if (data?.base_city) setIata(primaryIataForCity(data.base_city))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  function next() {
    router.push('/(onboarding)/extras')
  }

  return (
    <OnboardingChrome
      eyebrow=""
      step={4}
      total={4}
      title="You're on the board."
      subtitle="We'll find someone the next time you fly."
      onContinue={next}
      continueLabel="Next"
    >
      {loading ? (
        <View style={{ minHeight: 140 }} />
      ) : (
        <View style={styles.boardWrap}>
          <ManifestBoard firstName={firstName} iata={iata} />
          <Text style={styles.hint}>
            This is how you'll be listed. Add a flight any time.
          </Text>
        </View>
      )}
    </OnboardingChrome>
  )
}

const styles = StyleSheet.create({
  boardWrap: { gap: 16 },
  hint: {
    ...type.bodyItalic,
    fontSize: 14,
    color: colors.subtle,
  },
})
