import { ReactNode } from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

// The boarding pass — a dark flip-board-style module. Monospace data on a
// black surface, status readout in accent red, no decorative borders. All
// fields optional; missing fields render as dim placeholders so an incomplete
// pass still reads as a pass.

const DASH = '──'

export type BoardingPassProps = {
  airline?: string            // header wordmark; defaults to 'STANDBY'
  classLabel?: string         // subheader — e.g. 'BOARDING PASS', 'MEETUP PASS'
  passenger?: string | null
  origin?: string | null
  destination?: string | null
  flight?: string | null
  date?: string | null
  time?: string | null
  gate?: string | null
  terminal?: string | null
  status?: string | null      // status readout in accent red, e.g. 'ON STANDBY'
  stampSlot?: ReactNode
  style?: ViewStyle
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
  status,
  stampSlot,
  style,
  compact = false,
}: BoardingPassProps) {
  const iataSize = compact ? 30 : 40

  const fields: Array<{ label: string; value: string | null | undefined; flex?: number }> = [
    { label: 'FLIGHT', value: flight, flex: 1.2 },
    { label: 'DATE', value: date, flex: 1 },
    { label: 'DEPART', value: time, flex: 1 },
  ]

  const stubFields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'GATE', value: gate },
    { label: 'TERM', value: terminal },
  ]

  return (
    <View style={[styles.pass, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.airline}>{airline}</Text>
        <Text style={styles.classLabel}>{classLabel}</Text>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <FieldLabel>PASSENGER</FieldLabel>
        <Text style={styles.passengerName} numberOfLines={1}>
          {(passenger && passenger.length > 0) ? passenger.toUpperCase() : DASH}
        </Text>

        {/* Route — big IATA codes */}
        <View style={styles.routeRow}>
          <View style={styles.routeCol}>
            <FieldLabel>FROM</FieldLabel>
            <Text style={[styles.iata, { fontSize: iataSize }]}>{origin || DASH}</Text>
          </View>
          <View style={[styles.routeCol, styles.routeColRight]}>
            <FieldLabel>TO</FieldLabel>
            <Text style={[styles.iata, { fontSize: iataSize }]}>{destination || DASH}</Text>
          </View>
        </View>

        <View style={styles.fieldRow}>
          {fields.map(f => (
            <View key={f.label} style={[styles.fieldCell, { flex: f.flex ?? 1 }]}>
              <FieldLabel>{f.label}</FieldLabel>
              <Text style={styles.fieldValue}>{f.value || DASH}</Text>
            </View>
          ))}
        </View>

        <View style={styles.fieldRow}>
          {stubFields.map(f => (
            <View key={f.label} style={styles.fieldCell}>
              <FieldLabel>{f.label}</FieldLabel>
              <Text style={styles.fieldValue}>{f.value || DASH}</Text>
            </View>
          ))}
        </View>

        {status ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>STATUS</Text>
            <Text style={styles.statusValue}>{status.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {/* Barcode strip */}
      <View style={styles.barcodeRow}>
        <View style={styles.barcode}>
          {Array.from({ length: 38 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.barcodeBar,
                {
                  width: i % 3 === 0 ? 3 : i % 4 === 0 ? 1 : 2,
                  opacity: i % 5 === 0 ? 0.3 : 0.8,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.barcodeText}>STBY · {origin || '···'}{destination ? ` · ${destination}` : ''}</Text>
      </View>

      {stampSlot ? <View style={styles.stampLayer} pointerEvents="none">{stampSlot}</View> : null}
    </View>
  )
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>
}

const styles = StyleSheet.create({
  pass: {
    backgroundColor: colors.board,
    borderRadius: 6,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  airline: {
    fontFamily: fonts.display,
    color: colors.boardText,
    fontSize: 18,
    letterSpacing: 3,
  },
  classLabel: {
    fontFamily: fonts.body,
    color: colors.boardDim,
    fontSize: 10,
    letterSpacing: 2,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 14,
  },
  bodyCompact: {
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.boardDim,
    marginBottom: 3,
  },
  passengerName: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.boardText,
    letterSpacing: 1.2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  routeCol: { flex: 1 },
  routeColRight: { alignItems: 'flex-end' },
  iata: {
    fontFamily: fonts.body,
    fontWeight: '700',
    color: colors.boardText,
    letterSpacing: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  fieldCell: { flex: 1, paddingRight: 8 },
  fieldValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.boardText,
    letterSpacing: 0.6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 2,
  },
  statusLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.boardDim,
  },
  statusValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.accent,
  },
  barcodeRow: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 6,
  },
  barcode: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 26,
    gap: 1,
  },
  barcodeBar: {
    height: '100%',
    backgroundColor: colors.boardText,
  },
  barcodeText: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.boardDim,
    letterSpacing: 1.5,
  },
  stampLayer: {
    position: 'absolute',
    top: 56,
    right: 14,
    pointerEvents: 'none',
  },
})
