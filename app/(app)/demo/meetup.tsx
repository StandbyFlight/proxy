import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../../../lib/theme'
import { fonts } from '../../../lib/typography'
import { haptics } from '../../../lib/haptics'
import { trackDemo } from '../../../lib/demo'
import { demoMatch, demoMeetup } from '../../../lib/demoData'
import { BetaDemoBanner } from '../../../components/BetaDemoBanner'
import { FeedbackButton } from '../../../components/FeedbackButton'
import { DemoMapPreview } from '../../../components/DemoMapPreview'
import { BoardingPass } from '../../../components/BoardingPass'
import { BackButton } from '../../../components/BackButton'
import { Screen, GlassCard, GlassButton } from '../../../components/ui'

// Demo meetup preview. Entirely simulated — no live location, no maps SDK, no
// supabase. Uses a static DemoMapPreview card in place of the real MeetupMap.
// The user can always return home, so they're never stuck.

export default function DemoMeetupScreen() {
  const router = useRouter()

  useEffect(() => {
    trackDemo('demo_meetup_opened')
  }, [])

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.inner}>
      <BackButton />
      <BetaDemoBanner />

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

      {/* Suggested meet spot. */}
      <GlassCard rounded="lg" padding={16} style={styles.infoBox}>
        <Text style={styles.infoValue}>{demoMeetup.spotName}</Text>
        <Text style={styles.infoBody}>
          Meet near {demoMeetup.spotContext} — a central place for both of you.
        </Text>
        <Text style={styles.walkText}>
          {demoMeetup.walkingMinutes} min walk from Gate {demoMeetup.gate}
        </Text>
      </GlassCard>

      {/* Static, no-SDK map preview stand-in. */}
      <DemoMapPreview
        spotName={demoMeetup.spotName}
        nearGate={demoMeetup.nearGate}
        walkingMinutes={demoMeetup.walkingMinutes}
        terminal={demoMeetup.terminal}
      />

      {/* Airport / terminal / gate context. */}
      <View style={styles.contextRow}>
        <ContextCell label="AIRPORT" value={demoMeetup.airport} />
        <ContextCell label="TERMINAL" value={demoMeetup.terminal} />
        <ContextCell label="YOUR GATE" value={demoMeetup.gate} />
      </View>

      {/* Safety / location copy. */}
      <GlassCard rounded="lg" padding={16} tint="sky" style={styles.safetyBox}>
        <Text style={styles.safetyPrimary}>{demoMeetup.safetyPrimary}</Text>
        <Text style={styles.safetySecondary}>{demoMeetup.safetySecondary}</Text>
      </GlassCard>

      <FeedbackButton variant="button" label="REPORT CONFUSION / BUG" />

      <GlassButton
        label="BACK TO HOME"
        onPress={() => { haptics.selection(); router.replace('/(app)/') }}
        variant="ghost"
        haptic={false}
        style={styles.homeBtn}
      />
    </Screen>
  )
}

function ContextCell({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard rounded="md" padding={12} style={styles.contextCell}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue}>{value}</Text>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  infoBox: {
    gap: 6,
  },
  infoValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.text,
  },
  infoBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  walkText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.accent,
  },

  contextRow: {
    flexDirection: 'row',
    gap: 12,
  },
  contextCell: {
    flex: 1,
    gap: 4,
  },
  contextLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
  contextValue: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.4,
    color: colors.text,
  },

  safetyBox: {
    gap: 6,
  },
  safetyPrimary: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.text,
  },
  safetySecondary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtle,
  },

  homeBtn: { alignSelf: 'center', marginTop: 4 },
})
