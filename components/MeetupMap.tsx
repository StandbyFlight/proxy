import { StyleSheet, View } from 'react-native'
import Mapbox, { MapView, Camera, PointAnnotation, UserLocation } from '@rnmapbox/maps'
import { colors } from '../lib/theme'

// Set the public Mapbox access token once, at module load, on native only. The
// secret DOWNLOAD token (build-time SDK fetch) comes from the
// RNMAPBOX_MAPS_DOWNLOAD_TOKEN env var during prebuild/build.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN
if (MAPBOX_TOKEN) Mapbox.setAccessToken(MAPBOX_TOKEN)

// Presentational Mapbox surface for the meetup screen. Owns all @rnmapbox/maps
// JSX so the route screen stays orchestration-only. Renders the destination
// pin (always), an optional partner pin (periwinkle), and the OS blue-dot user
// location when `showUser` is granted — falling back to a plain marker if a
// manual `userLocation` is supplied instead. Never fetches or subscribes.

type LatLng = { latitude: number; longitude: number }

type Props = {
  destination: LatLng & { name?: string }
  userLocation?: LatLng | null
  partnerLocation?: LatLng | null
  showUser?: boolean
}

// Mapbox expects [longitude, latitude] tuples.
function coord({ latitude, longitude }: LatLng): [number, number] {
  return [longitude, latitude]
}

export function MeetupMap({ destination, userLocation, partnerLocation, showUser }: Props) {
  return (
    <MapView
      style={styles.map}
      styleURL={Mapbox.StyleURL.Light}
      logoEnabled={false}
      attributionEnabled
      scaleBarEnabled={false}
      compassEnabled
    >
      <Camera
        centerCoordinate={coord(destination)}
        zoomLevel={16}
        animationDuration={0}
      />

      {/* Destination — red accent pin, always shown. */}
      <PointAnnotation id="destination" coordinate={coord(destination)}>
        <View style={styles.destPin}>
          <View style={styles.destPinInner} />
        </View>
        {destination.name ? (
          <Mapbox.Callout title={destination.name} />
        ) : <></>}
      </PointAnnotation>

      {/* Partner — periwinkle pin, only when a live location was passed in. */}
      {partnerLocation ? (
        <PointAnnotation id="partner" coordinate={coord(partnerLocation)}>
          <View style={styles.partnerPin}>
            <View style={styles.partnerPinInner} />
          </View>
        </PointAnnotation>
      ) : null}

      {/* Current user — prefer the OS blue dot once permission is granted;
          fall back to a plain marker if the screen hands us a manual fix. */}
      {showUser ? (
        <UserLocation visible androidRenderMode="normal" />
      ) : userLocation ? (
        <PointAnnotation id="user" coordinate={coord(userLocation)}>
          <View style={styles.userPin} />
        </PointAnnotation>
      ) : null}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: { flex: 1 },

  // Destination pin — filled red disc with a white core.
  destPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },

  // Partner pin — periwinkle, visually distinct from the destination.
  partnerPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.periwinkle,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerPinInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.white,
  },

  // Fallback manual user marker (used only when showUser is false).
  userPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.black,
    borderWidth: 2,
    borderColor: colors.white,
  },
})
