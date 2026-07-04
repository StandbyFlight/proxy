import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

// Demo meetup preview. Entirely simulated — no live location, no maps SDK, no
// supabase. Uses a static DemoMapPreview card in place of the real MeetupMap.
// The user can always return home, so they're never stuck.

export default function DemoMeetupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    trackDemo('demo_meetup_opened')
  }, [])

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

        {/* Suggested meet spot. */}
        <View style={styles.infoBox}>
          <Text style={styles.infoValue}>{demoMeetup.spotName}</Text>
          <Text style={styles.infoBody}>
            Meet near {demoMeetup.spotContext} — a central place for both of you.
          </Text>
          <Text style={styles.walkText}>
            {demoMeetup.walkingMinutes} min walk from Gate {demoMeetup.gate}
          </Text>
        </View>

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
        <View style={styles.safetyBox}>
          <Text style={styles.safetyPrimary}>{demoMeetup.safetyPrimary}</Text>
          <Text style={styles.safetySecondary}>{demoMeetup.safetySecondary}</Text>
        </View>

        <FeedbackButton variant="button" label="REPORT CONFUSION / BUG" />

        <Pressable
          onPress={() => { haptics.selection(); router.replace('/(app)/') }}
          style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.5 }]}
        >
          <Text style={styles.homeBtnText}>BACK TO HOME</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

function ContextCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contextCell}>
      <Text style={styles.contextLabel}>{label}</Text>
      <Text style={styles.contextValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: { paddingHorizontal: 20, gap: 16 },

  infoBox: {
    borderWidth: 1,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 14,
    gap: 6,
    backgroundColor: colors.surface,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
    backgroundColor: colors.surface,
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
    borderRadius: 8,
    padding: 14,
    gap: 6,
    backgroundColor: 'rgba(122,165,200,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(122,165,200,0.4)',
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

  homeBtn: { alignSelf: 'center', paddingVertical: 8 },
  homeBtnText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.subtle,
  },
})
