import { useMemo, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, FlatList,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { type, fonts } from '../../lib/typography'
import { OnboardingChrome } from '../../components/OnboardingChrome'
import { InputFlipBoard } from '../../components/InputFlipBoard'
import { searchCities, CityEntry } from '../../lib/cities'

// Start at 10 cells; grow as the user types. Cap at 24 to keep the board on screen.
const CITY_MIN_SLOTS = 10
const CITY_MAX = 24
const CELL_HEIGHT = 36
const CELL_WIDTH = 28

export default function City() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<CityEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Board reflects either the picked city or the user's raw typed query.
  const boardValue = (picked?.name ?? query).toUpperCase()

  const suggestions = useMemo(
    () => (picked ? [] : searchCities(query, 6)),
    [query, picked],
  )

  const valid = !!picked || query.trim().length >= 2

  function pick(c: CityEntry) {
    setPicked(c)
    setQuery(c.name)
  }

  async function next() {
    if (!valid) return
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      router.replace('/(auth)')
      return
    }
    const cityName = picked?.name ?? query.trim()
    const { error } = await supabase
      .from('users')
      .update({ base_city: cityName })
      .eq('id', session.user.id)
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/(onboarding)/prompt')
  }

  return (
    <OnboardingChrome
      eyebrow="Origin · 03 / 04"
      step={3}
      total={4}
      title="Where do you call home?"
      subtitle="The city you fly out of more than any other."
      onContinue={next}
      continueDisabled={!valid}
      continueLoading={loading}
      error={error}
    >
      <View style={styles.boardWrap}>
        <InputFlipBoard
          value={boardValue}
          minSlots={CITY_MIN_SLOTS}
          maxLength={CITY_MAX}
          onChangeText={(t) => {
            setPicked(null)
            setQuery(t)
          }}
          cellSize={CELL_HEIGHT}
          cellWidth={CELL_WIDTH}
          gap={3}
          autoCapitalize="characters"
          filter={(t) => t.replace(/[^a-zA-Z .]/g, '')}
        />
        <Text style={styles.hint}>Tap to edit</Text>
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.suggestionsWrap}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => `${item.name}-${item.state}`}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.suggestion,
                  pressed && { opacity: 0.55 },
                ]}
              >
                <Text style={styles.suggestionLeft} numberOfLines={1}>
                  {item.name}, {item.state}
                </Text>
                <Text style={styles.suggestionRight} numberOfLines={1}>
                  {item.airports.join(' · ')}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {picked ? (
        <View style={styles.pickedRow}>
          <Text style={styles.pickedLabel}>Serving </Text>
          <Text style={styles.pickedAirports}>{picked.airports.join(' · ')}</Text>
        </View>
      ) : null}
    </OnboardingChrome>
  )
}

const styles = StyleSheet.create({
  boardWrap: { gap: 12, alignItems: 'flex-start' },
  hint: {
    ...type.hint,
    color: colors.subtle,
  },
  suggestionsWrap: { marginTop: 22 },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  suggestionLeft: {
    ...type.bodyItalic,
    color: colors.text,
    flexShrink: 1,
  },
  suggestionRight: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.subtle,
    letterSpacing: 1.2,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(10,10,10,0.06)',
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 22,
  },
  pickedLabel: {
    ...type.bodyItalic,
    fontSize: 14,
    color: colors.subtle,
  },
  pickedAirports: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.text,
    letterSpacing: 1.4,
  },
})
