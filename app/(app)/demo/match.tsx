import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../../lib/theme'
import { fonts, type } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { trackDemo } from '../../../lib/demo'
import { demoMatch, DEMO_ROUTES } from '../../../lib/demoData'
import { BetaDemoBanner } from '../../../components/BetaDemoBanner'
import { FeedbackButton } from '../../../components/FeedbackButton'
import { BoardingPass } from '../../../components/BoardingPass'
import { BackButton } from '../../../components/BackButton'

// Demo match reveal. Entirely simulated — no supabase, matcher, ably, or
// session logic. Renders the fake `demoMatch` person as a full product preview
// and continues to the demo meetup screen. Reached only from the demo flow.

export default function DemoMatchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    trackDemo('demo_match_shown')
  }, [])

  function continueToMeetup() {
    haptics.buttonTap()
    router.push(DEMO_ROUTES.meetup)
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />
        <BetaDemoBanner />

        {/* Point of connection — the headline reveal. */}
        <Text style={[type.headline, styles.poc]}>{demoMatch.pointOfConnection}</Text>

        {/* Sample-traveler chip so it's unmistakably a demo person. */}
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{demoMatch.sampleLabel}</Text>
          </View>
          <Text style={styles.intentText}>{demoMatch.intentLabel}</Text>
        </View>

        <Text style={styles.context}>{demoMatch.sharedContext}</Text>

        {/* The other person's pass. */}
        <BoardingPass
          classLabel="MEETUP PASS"
          passenger={demoMatch.firstName}
          origin={demoMatch.originIata}
          destination={demoMatch.destinationIata}
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

        <Pressable
          onPress={continueToMeetup}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryBtnText}>CONTINUE TO MEETUP</Text>
        </Pressable>

        <FeedbackButton style={styles.feedback} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 20, gap: 16 },

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
  chip: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
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
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },

  feedback: { alignSelf: 'center', marginTop: 4 },
})
