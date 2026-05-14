import { ReactNode } from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

// A printed-paper boarding pass. The app's record / artifact language —
// pairs with the flip board (identity) and the rubber stamp (approval).
//
// All fields are optional; missing fields render as dim placeholders ('──')
// so an incomplete pass still reads as a pass. Pass an `accent` to change the
// top band color; pass `stamp` children to overlay a rubber stamp.

const DASH = '──'

export type BoardingPassProps = {
  // Top band header — replaces airline name. Defaults to 'STANDBY'.
  airline?: string
  // Subheader on the top band — e.g. 'BOARDING PASS' or 'MEETUP PASS'.
  classLabel?: string

  // Passenger name. Pass null/undefined to show as blanked.
  passenger?: string | null

  // Route. Either IATA codes or '──' fallback.
  origin?: string | null
  destination?: string | null

  // Optional flight metadata. Missing → dim placeholder.
  flight?: string | null
  date?: string | null
  time?: string | null
  gate?: string | null
  terminal?: string | null
  seat?: string | null

  // Visual treatments.
  accent?: string             // top band color; defaults to colors.accent (TWA red)
  stampSlot?: ReactNode       // optional stamp/decoration overlay
  style?: ViewStyle

  // Compact layout: smaller padding, smaller IATA codes. Used on the match screen.
  compact?: boolean
}

export function BoardingPass({
  airline = 'STANDBY',
  classLabel = 'BOARDING PASS',
  passenger,
  origin,
  destination,
  flight,
  date,
  time,
  gate,
  terminal,
  seat,
  accent = colors.accent,
  stampSlot,
  style,
  compact = false,
}: BoardingPassProps) {
  const iataSize = compact ? 32 : 42
  const passengerSize = compact ? 18 : 22

  const fields: Array<{ label: string; value: string | null | undefined; flex?: number }> = [
    { label: 'FLIGHT', value: flight, flex: 1.2 },
    { label: 'DATE', value: date, flex: 1 },
    { label: 'DEPART', value: time, flex: 1 },
  ]

  const stubFields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'GATE', value: gate },
    { label: 'TERM', value: terminal },
    { label: 'SEAT', value: seat },
  ]

  return (
    <View style={[styles.pass, style]}>
      {/* Top band — airline color */}
      <View style={[styles.topBand, { backgroundColor: accent }]}>
        <Text style={styles.airline}>{airline}</Text>
        <Text style={styles.classLabel}>{classLabel}</Text>
      </View>

      {/* Body */}
      <View style={[styles.body, compact && styles.bodyCompact]}>
        {/* Passenger line */}
        <FieldLabel>PASSENGER</FieldLabel>
        <Text style={[styles.passengerName, { fontSize: passengerSize }]} numberOfLines={1}>
          {(passenger && passenger.length > 0) ? passenger.toUpperCase() : DASH}
        </Text>

        {/* Route — big IATA codes with an arrow */}
        <View style={styles.routeRow}>
          <View style={styles.routeCol}>
            <FieldLabel>FROM</FieldLabel>
            <Text style={[styles.iata, { fontSize: iataSize }]}>
              {origin || DASH}
            </Text>
          </View>
          <View style={styles.routeArrow}>
            <Text style={styles.arrow}>{'→'}</Text>
          </View>
          <View style={[styles.routeCol, styles.routeColRight]}>
            <FieldLabel>TO</FieldLabel>
            <Text style={[styles.iata, { fontSize: iataSize }]}>
              {destination || DASH}
            </Text>
          </View>
        </View>

        {/* Flight / Date / Depart row */}
        <View style={styles.fieldRow}>
          {fields.map((f, i) => (
            <View key={f.label} style={[styles.fieldCell, { flex: f.flex ?? 1 }, i < fields.length - 1 && styles.fieldCellSep]}>
              <FieldLabel>{f.label}</FieldLabel>
              <Text style={styles.fieldValue}>{f.value || DASH}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Perforated edge */}
      <View style={styles.perforation}>
        <Text style={styles.perforationDots} numberOfLines={1}>
          {'· · · · · · · · · · · · · · · · · · · · · · · · · · ·'}
        </Text>
      </View>

      {/* Stub — gate / term / seat */}
      <View style={[styles.stub, compact && styles.stubCompact]}>
        {stubFields.map((f, i) => (
          <View key={f.label} style={[styles.stubCell, i < stubFields.length - 1 && styles.stubCellSep]}>
            <FieldLabel>{f.label}</FieldLabel>
            <Text style={styles.stubValue}>{f.value || DASH}</Text>
          </View>
        ))}
      </View>

      {/* Faint barcode strip */}
      <View style={styles.barcodeRow}>
        <View style={styles.barcode}>
          {Array.from({ length: 38 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.barcodeBar,
                {
                  width: i % 3 === 0 ? 3 : i % 4 === 0 ? 1 : 2,
                  opacity: i % 5 === 0 ? 0.35 : 0.85,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.barcodeText}>STBY · {origin || '···'} {destination ? `· ${destination}` : ''}</Text>
      </View>

      {/* Stamp overlay (absolute) */}
      {stampSlot ? <View style={styles.stampLayer} pointerEvents="none">{stampSlot}</View> : null}
    </View>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
}

const styles = StyleSheet.create({
  pass: {
    backgroundColor: '#FAF8F3', // very faint cream — paper feel
    borderWidth: 1,
    borderColor: 'rgba(10,10,10,0.12)',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  topBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  airline: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  classLabel: {
    fontFamily: fonts.mono,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    letterSpacing: 2,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  bodyCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.subtle,
    marginBottom: 3,
  },
  passengerName: {
    fontFamily: fonts.serifBold,
    color: colors.text,
    letterSpacing: 0.3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  routeCol: {
    flex: 1,
  },
  routeColRight: {
    alignItems: 'flex-end',
  },
  routeArrow: {
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  arrow: {
    fontFamily: fonts.mono,
    fontSize: 22,
    color: colors.subtle,
  },
  iata: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,10,0.12)',
    paddingTop: 10,
  },
  fieldCell: {
    paddingHorizontal: 4,
  },
  fieldCellSep: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(10,10,10,0.10)',
  },
  fieldValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 0.6,
  },
  perforation: {
    height: 16,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FAF8F3',
  },
  perforationDots: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: 'rgba(10,10,10,0.35)',
    letterSpacing: 1,
    textAlign: 'center',
  },
  stub: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  stubCompact: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  stubCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  stubCellSep: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(10,10,10,0.10)',
  },
  stubValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 0.6,
  },
  barcodeRow: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 6,
  },
  barcode: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
    gap: 1,
  },
  barcodeBar: {
    height: '100%',
    backgroundColor: '#0A0A0A',
  },
  barcodeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.subtle,
    letterSpacing: 1.5,
  },
  stampLayer: {
    position: 'absolute',
    top: 60,
    right: 14,
    pointerEvents: 'none',
  },
})
