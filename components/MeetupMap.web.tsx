import { StyleSheet, View, Text } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

// Web fallback for MeetupMap. @rnmapbox/maps has no web implementation, so on
// web we render a lightweight placeholder instead of a live map. Metro picks
// this file over MeetupMap.tsx automatically for the web platform, which keeps
// @rnmapbox/maps out of the web bundle entirely. Props mirror the native
// component so the route screen needs no platform branching.

type LatLng = { latitude: number; longitude: number }

type Props = {
  destination: LatLng & { name?: string }
  userLocation?: LatLng | null
  partnerLocation?: LatLng | null
  showUser?: boolean
}

export function MeetupMap({ destination }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>MAP PREVIEW</Text>
      <Text style={styles.body}>
        The live map is available in the mobile app.
      </Text>
      {destination.name ? (
        <Text style={styles.dest}>Destination: {destination.name}</Text>
      ) : null}
      <Text style={styles.coords}>
        {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: colors.glassGrey,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 0.5,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.subtle,
    textAlign: 'center',
  },
  dest: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  coords: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.subtle,
  },
})
