import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Platform, Animated } from 'react-native'
import { FlipCell } from './FlipCell'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'

const BOARD_FONT = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'Menlo, Consolas, monospace',
}) as string

// Departure-board row for the profile-preview screen. Three columns —
// FLIGHT (placeholder dashes), PASSENGER, ORIGIN — fit comfortably on
// standard phone widths. The STANDBY brand moment lives in a small
// mono caption below the board, in accent red.

const CELL = 22
const CELL_GAP = 2
const NAME_MIN_SLOTS = 6
const ORIGIN_SLOTS = 3
const COL_GAP = 14
const STAGGER_MS = 90
const COLUMN_DELAY = 350

const NAME_START = 500
const STATUS_PAD = 250

export function ManifestBoard({
  firstName,
  iata,
}: {
  firstName: string
  iata: string
}) {
  const nameUpper = firstName.toUpperCase()
  const nameSlots = Math.max(NAME_MIN_SLOTS, nameUpper.length)
  const namePadded = nameUpper.padEnd(nameSlots, ' ').slice(0, nameSlots)
  const iataPadded = iata.toUpperCase().padEnd(ORIGIN_SLOTS, ' ').slice(0, ORIGIN_SLOTS)

  // Origin cells start settling after the last name cell does, plus a beat.
  const originStart = NAME_START + nameSlots * STAGGER_MS + COLUMN_DELAY
  const statusRevealMs =
    originStart + ORIGIN_SLOTS * STAGGER_MS + STATUS_PAD

  return (
    <View>
      <View style={styles.board}>
        {/* Column headers */}
        <View style={[styles.row, { marginBottom: 8 }]}>
          <View style={styles.flightCol}>
            <Text style={styles.colLabel}>FLIGHT</Text>
          </View>
          <View style={styles.colSep} />
          <View style={{ width: colWidth(nameSlots) }}>
            <Text style={styles.colLabel}>PASSENGER</Text>
          </View>
          <View style={styles.colSep} />
          <View style={{ width: colWidth(ORIGIN_SLOTS) }}>
            <Text style={styles.colLabel}>ORIGIN</Text>
          </View>
        </View>

        {/* Row */}
        <View style={styles.row}>
          {/* FLIGHT — static dim dashes; placeholder for "no flight yet" */}
          <View style={[styles.flightCol, styles.rowAlign]}>
            <Text style={styles.flightDashes}>─ ─ ─ ─</Text>
          </View>
          <View style={styles.colSep} />

          {/* PASSENGER */}
          <View style={[styles.cellsRow, { width: colWidth(nameSlots) }]}>
            {namePadded.split('').map((c, i) =>
              c === ' ' ? (
                <View key={`n-${i}`} style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.board }}>
                  <Text style={styles.dimGlyph}>·</Text>
                </View>
              ) : (
                <FlipCell
                  key={`n-${i}`}
                  targetChar={c}
                  stopAfter={NAME_START + i * STAGGER_MS}
                  cellSize={CELL}
                />
              )
            )}
          </View>
          <View style={styles.colSep} />

          {/* ORIGIN */}
          <View style={[styles.cellsRow, { width: colWidth(ORIGIN_SLOTS) }]}>
            {iataPadded.split('').map((c, i) =>
              c === ' ' || c === '·' ? (
                <View
                  key={`o-${i}`}
                  style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.board }}
                >
                  <Text style={styles.dimGlyph}>·</Text>
                </View>
              ) : (
                <FlipCell
                  key={`o-${i}`}
                  targetChar={c}
                  stopAfter={originStart + i * STAGGER_MS}
                  cellSize={CELL}
                />
              )
            )}
          </View>
        </View>
      </View>

      {/* STANDBY caption — the brand payoff, in accent red mono. */}
      <StatusCaption revealAt={statusRevealMs} />
    </View>
  )
}

// Renders "STATUS · STANDBY" with STANDBY fading in after the board settles.
function StatusCaption({ revealAt }: { revealAt: number }) {
  return (
    <View style={styles.caption}>
      <Text style={styles.captionLabel}>STATUS  ·  </Text>
      <RevealText text="STANDBY" delayMs={revealAt} style={styles.captionStandby} />
    </View>
  )
}

function RevealText({
  text,
  delayMs,
  style,
}: {
  text: string
  delayMs: number
  style: any
}) {
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start()
    }, delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  return <Animated.Text style={[style, { opacity }]}>{text}</Animated.Text>
}

const colWidth = (slots: number) => slots * Math.round(CELL * 0.69) + (slots - 1) * CELL_GAP

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.board,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAlign: { height: CELL, justifyContent: 'center' },
  colSep: { width: COL_GAP },
  flightCol: { width: 56 },
  cellsRow: { flexDirection: 'row', gap: CELL_GAP, alignItems: 'center' },
  colLabel: {
    color: colors.boardText,
    opacity: 0.45,
    fontFamily: BOARD_FONT,
    fontSize: 8,
    letterSpacing: 1.4,
  },
  flightDashes: {
    color: colors.boardText,
    opacity: 0.35,
    fontFamily: BOARD_FONT,
    fontSize: 13,
    letterSpacing: 1,
  },
  dimGlyph: {
    color: colors.boardText,
    opacity: 0.22,
    fontFamily: BOARD_FONT,
    fontSize: Math.round(CELL * 0.62),
    lineHeight: Math.round(CELL * 0.78),
    textAlign: 'center',
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
    paddingLeft: 4,
  },
  captionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1.8,
  },
  captionStandby: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 2,
    fontWeight: '600',
  },
})
