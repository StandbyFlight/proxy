import { ReactNode } from 'react'
import { View, Text, StyleSheet, ViewStyle, Image } from 'react-native'
import { colors, radius, shadow } from '../lib/theme'
import { fonts } from '../lib/typography'

// The boarding pass — a light "printed ticket" module. White card, charcoal
// ink, the Standby logo + wordmark up top, a city→city route with big IATA
// codes, printed field rows (FLIGHT / DATE / DOOR CLOSES, PASSENGER /
// BOARDING / SERVICES), a large colored status word (blue when matched, red
// when declined), and a full-height vertical barcode down the right edge.
//
// All data fields are optional; missing fields render as a dim placeholder so
// an incomplete pass still reads as a pass.

const DASH = '──'

// The logo asset. Drop your logo at assets/logo.png (already wired here) and
// the boarding-pass header renders it instead of the old triangle shapes. To
// swap it, replace that file — no code change needed. Set LOGO to null to fall
// back to the <StandbyMark> stand-in.
const LOGO: number | null = require('../assets/logo.png')

export type BoardingPassProps = {
  airline?: string            // header wordmark; defaults to 'Standby'
  classLabel?: string         // subheader — e.g. 'BOARDING PASS', 'MEETUP PASS'
  passenger?: string | null
  origin?: string | null           // IATA, e.g. 'BOS'
  destination?: string | null      // IATA, e.g. 'RDU'
  originCity?: string | null       // small label above origin IATA, e.g. 'Boston'
  destinationCity?: string | null  // small label above destination IATA
  flight?: string | null
  date?: string | null
  time?: string | null             // shown under DOOR CLOSES
  boarding?: string | null         // shown under BOARDING (falls back to time)
  gate?: string | null
  terminal?: string | null
  services?: string | null         // shown under SERVICES (falls back to gate/terminal)
  status?: string | null           // big status word, colored by meaning
  stampSlot?: ReactNode            // legacy; no longer rendered (status word replaces it)
  style?: ViewStyle
  compact?: boolean
}

// Map a status string to a printed tone: positive (matched → blue), negative
// (declined/expired → red), or neutral (pending / standby → charcoal).
function statusTone(status: string): string {
  const s = status.toUpperCase()
  const positive = ['MATCH', 'MEETUP', 'MET', 'COMPLETE', 'CONFIRM', 'ACCEPT']
  const negative = ['DECLIN', 'PASS', 'EXPIR', 'CANCEL', 'NO MATCH', 'MISS']
  if (negative.some(k => s.includes(k))) return colors.scarlet
  if (positive.some(k => s.includes(k))) return colors.skyBlueDeep
  return colors.textSecondary
}

// Turn an all-caps brand token like 'STANDBY' into the title-case wordmark.
function wordmark(airline: string): string {
  if (airline.toUpperCase() === 'STANDBY') return 'Standby'
  return airline
}

export function BoardingPass({
  airline = 'Standby',
  passenger,
  origin,
  destination,
  originCity,
  destinationCity,
  flight,
  date,
  time,
  boarding,
  gate,
  terminal,
  services,
  status,
  style,
  compact = false,
}: BoardingPassProps) {
  const iataSize = compact ? 30 : 42

  const servicesValue =
    services ?? ([gate, terminal].filter(Boolean).join(', ') || null)

  const topFields: Array<{ label: string; value: string | null | undefined; flex?: number }> = [
    { label: 'FLIGHT', value: flight, flex: 1.1 },
    { label: 'DATE', value: date, flex: 0.9 },
    { label: 'DOOR CLOSES', value: time, flex: 1.2 },
  ]

  return (
    <View style={[styles.pass, style]}>
      <View style={styles.row}>
        {/* ── Left: printed content ── */}
        <View style={[styles.content, compact && styles.contentCompact]}>
          {/* Header — logo + wordmark */}
          <View style={styles.header}>
            {LOGO ? (
              <Image source={LOGO} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <StandbyMark />
            )}
            <Text style={[styles.wordmark, compact && styles.wordmarkCompact]} numberOfLines={1}>
              {wordmark(airline)}
            </Text>
          </View>

          {/* Route — city name over big IATA, plane glyph between */}
          <View style={styles.routeRow}>
            <View style={styles.routeCol}>
              {originCity ? <Text style={styles.cityName} numberOfLines={1}>{originCity}</Text> : null}
              <Text style={[styles.iata, { fontSize: iataSize }]}>{origin || DASH}</Text>
            </View>
            <Text style={[styles.plane, compact && styles.planeCompact]}>✈</Text>
            <View style={[styles.routeCol, styles.routeColRight]}>
              {destinationCity ? <Text style={[styles.cityName, styles.cityNameRight]} numberOfLines={1}>{destinationCity}</Text> : null}
              <Text style={[styles.iata, { fontSize: iataSize }]}>{destination || DASH}</Text>
            </View>
          </View>

          {/* FLIGHT / DATE / DOOR CLOSES */}
          <View style={styles.fieldRow}>
            {topFields.map(f => (
              <View key={f.label} style={[styles.fieldCell, { flex: f.flex ?? 1 }]}>
                <FieldLabel>{f.label}</FieldLabel>
                <Text style={styles.fieldValue}>{f.value || DASH}</Text>
              </View>
            ))}
          </View>

          {/* PASSENGER / BOARDING */}
          <View style={styles.fieldRow}>
            <View style={[styles.fieldCell, { flex: 2 }]}>
              <FieldLabel>PASSENGER</FieldLabel>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {(passenger && passenger.length > 0) ? passenger : DASH}
              </Text>
            </View>
            <View style={[styles.fieldCell, { flex: 1.2 }]}>
              <FieldLabel>BOARDING</FieldLabel>
              <Text style={styles.fieldValue}>{boarding || time || DASH}</Text>
            </View>
          </View>

          {/* SERVICES + big status word */}
          <View style={styles.servicesRow}>
            <View style={styles.fieldCell}>
              <FieldLabel>SERVICES</FieldLabel>
              <Text style={styles.fieldValue}>{servicesValue || DASH}</Text>
            </View>
            {status ? (
              <Text
                style={[styles.statusWord, compact && styles.statusWordCompact, { color: statusTone(status) }]}
                numberOfLines={1}
              >
                {titleCase(status)}
              </Text>
            ) : null}
          </View>
        </View>

        {/* ── Right: vertical barcode ── */}
        <View style={styles.barcode}>
          {BARS.map((h, i) => (
            <View key={i} style={{ height: h, backgroundColor: colors.charcoal, width: '100%' }} />
          ))}
        </View>
      </View>
    </View>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
}

// Title-case a status token for the big word ('MATCHED' → 'Matched',
// 'MEETUP · COMPLETE' → 'Meetup · Complete').
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, c => c.toUpperCase())
}

// View-only stand-in for the logo until the PNG is dropped in. Two overlapping
// paper-fold triangles in the brand blue + scarlet.
function StandbyMark() {
  return (
    <View style={mark.wrap}>
      <View style={[mark.tri, mark.triBlue]} />
      <View style={[mark.tri, mark.triRed]} />
    </View>
  )
}

// Deterministic vertical barcode: a stack of horizontal bars with varying
// heights and white gaps between them.
const BARS: number[] = (() => {
  const pattern = [3, 6, 2, 4, 2, 5, 3, 2, 6, 3, 4, 2, 3, 5, 2, 4, 3, 6, 2, 3, 4, 2, 5, 3, 2, 4, 6, 2, 3, 5, 2, 4, 3, 2]
  return pattern
})()

const styles = StyleSheet.create({
  pass: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderHair,
    alignSelf: 'stretch',
    overflow: 'hidden',
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    paddingLeft: 22,
    paddingRight: 16,
    paddingVertical: 20,
    gap: 18,
  },
  contentCompact: {
    paddingLeft: 16,
    paddingVertical: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImg: {
    width: 40,
    height: 32,
  },
  wordmark: {
    fontFamily: fonts.elmsSans.extrabold,
    color: colors.charcoal,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  wordmarkCompact: {
    fontSize: 22,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  routeCol: { flex: 1 },
  routeColRight: { alignItems: 'flex-end' },
  cityName: {
    fontFamily: fonts.elmsSans.medium,
    fontSize: 12,
    color: colors.charcoal,
    marginBottom: 2,
  },
  cityNameRight: { textAlign: 'right' },
  iata: {
    fontFamily: fonts.elmsSans.extrabold,
    color: colors.charcoal,
    letterSpacing: 1,
  },
  plane: {
    fontSize: 22,
    color: colors.charcoal,
    marginHorizontal: 10,
    marginBottom: 12,
  },
  planeCompact: {
    fontSize: 16,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
  },
  servicesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  fieldCell: { flex: 1, paddingRight: 8 },
  fieldLabel: {
    fontFamily: fonts.elmsSans.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.charcoal,
    marginBottom: 3,
  },
  fieldValue: {
    fontFamily: fonts.elmsSans.regular,
    fontSize: 15,
    color: colors.charcoal,
  },
  statusWord: {
    fontFamily: fonts.elmsSans.extrabold,
    fontSize: 26,
    letterSpacing: -0.4,
    marginLeft: 8,
  },
  statusWordCompact: {
    fontSize: 20,
  },
  barcode: {
    width: 46,
    marginVertical: 20,
    marginRight: 18,
    justifyContent: 'center',
    gap: 3,
  },
})

const mark = StyleSheet.create({
  wrap: {
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tri: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  triBlue: {
    borderTopWidth: 0,
    borderRightWidth: 22,
    borderBottomWidth: 16,
    borderLeftWidth: 0,
    borderRightColor: 'transparent',
    borderBottomColor: colors.skyBlue,
    top: 2,
    left: 6,
    transform: [{ rotate: '12deg' }],
  },
  triRed: {
    borderTopWidth: 16,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 22,
    borderLeftColor: 'transparent',
    borderTopColor: colors.scarlet,
    bottom: 2,
    left: 2,
    transform: [{ rotate: '12deg' }],
  },
})
