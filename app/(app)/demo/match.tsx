import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { trackDemo } from '../../../lib/demo'
import { demoMatch, DEMO_ROUTES } from '../../../lib/demoData'
import { BetaDemoBanner } from '../../../components/BetaDemoBanner'
import { FeedbackButton } from '../../../components/FeedbackButton'
import { BoardingPass } from '../../../components/BoardingPass'
import { BackButton } from '../../../components/BackButton'
import { Screen, GlassButton, Badge } from '../../../components/ui'

// Demo match reveal. Entirely simulated — no supabase, matcher, ably, or
// session logic. Renders the fake `demoMatch` person as a full product preview
// and continues to the demo meetup screen. Reached only from the demo flow.

export default function DemoMatchScreen() {
  const router = useRouter()

  useEffect(() => {
    trackDemo('demo_match_shown')
  }, [])

  function continueToMeetup() {
    router.push(DEMO_ROUTES.meetup)
  }

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.inner}>
      <BackButton />
      <BetaDemoBanner />

      {/* Point of connection — the headline reveal. */}
      <Text style={[type.headline, styles.poc]}>{demoMatch.pointOfConnection}</Text>

      {/* Sample-traveler chip so it's unmistakably a demo person. */}
      <View style={styles.chipRow}>
        <Badge label={demoMatch.sampleLabel} tone="scarlet" />
        <Text style={styles.intentText}>{demoMatch.intentLabel}</Text>
      </View>

      <Text style={styles.context}>{demoMatch.sharedContext}</Text>

      {/* The other person's pass. */}
      <BoardingPass
        classLabel="MEETUP PASS"
        passenger={demoMatch.firstName}
        origin={demoMatch.originIata}
        destination={demoMatch.destinationIata}
        originCity="San Francisco"
        destinationCity={demoMatch.destinationName}
        flight={demoMatch.flightIata}
        date={demoMatch.date}
        time={demoMatch.time}
        gate={demoMatch.gate}
        terminal={demoMatch.terminal}
        status="MATCHED"
      />

      {/* What they're wearing — recognition detail, static in the demo. */}
      <View style={styles.wearingField}>
        <Text style={styles.boxLabel}>THEY'RE WEARING</Text>
        <Text style={styles.wearingValue}>{demoMatch.wearing}</Text>
      </View>

      <GlassButton
        label="CONTINUE TO MEETUP"
        onPress={continueToMeetup}
        variant="primary"
        size="lg"
        style={styles.primaryBtn}
      />

      <FeedbackButton style={styles.feedback} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  poc: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -4,
  },
  intentText: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.subtle,
  },

  context: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },

  boxLabel: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  wearingField: {
    gap: 5,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wearingValue: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
    paddingVertical: 2,
  },

  primaryBtn: {
    marginTop: 4,
  },

  feedback: { alignSelf: 'center', marginTop: 4 },
})
