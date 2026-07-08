import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { FlipCell } from './FlipCell'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'
import { ChurningStatusText } from './ChurningStatusText'

const BOARD_FONT = fonts.board

// Departure-board row for the profile-preview screen. Three columns —
// FLIGHT (placeholder dashes), PASSENGER, ORIGIN — fit comfortably on
// standard phone widths. The STANDBY brand moment lives in a small
// mono caption below the board, in accent red.

const CELL = 22
const CELL_WIDTH = Math.round(CELL * 0.69)
const CELL_GAP = 2
const NAME_MIN_SLOTS = 6
const ORIGIN_SLOTS = 3
const COL_GAP = 14
const ROW_WRAP_GAP = 10
const STAGGER_MS = 90
const COLUMN_DELAY = 350
// Per-cell delay for the home board's one-at-a-time populate reveal.
const POPULATE_STAGGER = 60

const FLIGHT_SLOTS = 6
const FLIGHT_CELL_GAP = 0
const flightColWidth = FLIGHT_SLOTS * CELL_WIDTH + (FLIGHT_SLOTS - 1) * FLIGHT_CELL_GAP

// The board must stay on a single line. Compute how many passenger cells can
// fit alongside the fixed FLIGHT and ORIGIN columns on the narrowest realistic
// width, and cap the name to that — longer names are cut short rather than
// wrapping the ORIGIN column onto a second line.
//   screen padding (24 each side) + board padding (14 each side) = 76
const HORIZONTAL_CHROME = 24 * 2 + 14 * 2
const FIXED_COLS_WIDTH = flightColWidth + (ORIGIN_SLOTS * CELL_WIDTH + (ORIGIN_SLOTS - 1) * CELL_GAP) + 2 * COL_GAP
const nameSlotBudget = Dimensions.get('window').width - HORIZONTAL_CHROME - FIXED_COLS_WIDTH
const NAME_MAX_SLOTS = Math.max(
  NAME_MIN_SLOTS,
  Math.floor((nameSlotBudget + CELL_GAP) / (CELL_WIDTH + CELL_GAP)),
)
const FLIGHT_START = 0   // flight column settles first, before name
const NAME_START = 500
const STATUS_PAD = 250

export type ManifestStatus = 'standby' | 'scanning' | 'gate-quiet' | 'none'

export function ManifestBoard({
  firstName,
  iata,
  iataLabel = 'ORIGIN',
  flightIata,
  mode = 'cinematic',
  stranger,
  status = 'standby',
  tiled = false,
}: {
  firstName: string
  iata: string
  iataLabel?: string
  flightIata?: string | null
  mode?: 'cinematic' | 'static' | 'populate'
  stranger?: { flightIata: string; originIata: string } | null
  status?: ManifestStatus
  // Curved grey boxes (no seams) + a flippier 3D animation — the home board.
  tiled?: boolean
}) {
  const nameUpper = firstName.toUpperCase()
  // Clamp between the minimum column and the one-line maximum — a long name is
  // truncated (slice below) so ORIGIN never wraps to a second line.
  const nameSlots = Math.min(NAME_MAX_SLOTS, Math.max(NAME_MIN_SLOTS, nameUpper.length))
  const namePadded = nameUpper.padEnd(nameSlots, ' ').slice(0, nameSlots)
  const passengerColWidth = colWidth(nameSlots)
  const iataPadded = iata.toUpperCase().padEnd(ORIGIN_SLOTS, ' ').slice(0, ORIGIN_SLOTS)

  // Origin cells start settling after the last name cell does, plus a beat.
  const originStart = NAME_START + nameSlots * STAGGER_MS + COLUMN_DELAY
  const statusRevealMs =
    originStart + ORIGIN_SLOTS * STAGGER_MS + STATUS_PAD

  const isStatic = mode === 'static'
  const isPopulate = mode === 'populate'

  // Only the cinematic board fires the standby-stamp payoff. The static board is
  // silent; the populate board does its own quiet single tick when it finishes.
  useEffect(() => {
    if (isStatic || isPopulate) return
    const t = setTimeout(haptics.standbyStamp, statusRevealMs)
    return () => clearTimeout(t)
  }, [statusRevealMs, isStatic, isPopulate])

  // One soft tick once every letter has flipped in.
  useEffect(() => {
    if (!isPopulate) return
    const total = (FLIGHT_SLOTS + nameSlots + ORIGIN_SLOTS) * POPULATE_STAGGER
    const t = setTimeout(haptics.selection, total)
    return () => clearTimeout(t)
  }, [isPopulate, nameSlots])

  return (
    <View>
      <View style={styles.board}>
        {/* Column headers — wrap as units, mirrors the data row below so the
            FLIGHT label sits above its cells even after wrap. */}
        <View style={[styles.row, { marginBottom: 8 }]}>
          <View style={{ width: flightColWidth }}>
            <Text style={styles.colLabel}>FLIGHT</Text>
          </View>
          <View style={{ width: passengerColWidth }}>
            <Text style={styles.colLabel}>PASSENGER</Text>
          </View>
          <View style={{ width: colWidth(ORIGIN_SLOTS) }}>
            <Text style={styles.colLabel}>{iataLabel}</Text>
          </View>
        </View>

        {/* Your row — FLIGHT / PASSENGER / ORIGIN as flex children of a
            wrapping row. When the trio overflows the board, the right-most
            column drops to a new line starting at the left edge. */}
        <View style={styles.row}>
          {/* FLIGHT — full-size cells packed tight so the code reads as one block */}
          <View style={[styles.cellsRow, { width: flightColWidth, gap: FLIGHT_CELL_GAP }]}>
            {flightIata
              ? flightIata.toUpperCase().padEnd(FLIGHT_SLOTS, ' ').slice(0, FLIGHT_SLOTS).split('').map((c, i) =>
                  c === ' ' ? (
                    <View key={`f-${i}`} style={styles.manifestEmpty}>
                      <Text style={styles.dimGlyph}>·</Text>
                    </View>
                  ) : (
                    <FlipCell
                      key={`f-${i}`}
                      targetChar={c}
                      stopAfter={
                        isStatic ? 0
                          : isPopulate ? i * POPULATE_STAGGER
                          : FLIGHT_START + i * STAGGER_MS
                      }
                      cellSize={CELL}
                      instant={isStatic}
                      reveal={isPopulate}
                      tile={tiled}
                    />
                  )
                )
              : <Text style={styles.flightDashes}>─ ─ ─</Text>
            }
          </View>

          {/* PASSENGER */}
          <View style={[styles.cellsRow, { width: passengerColWidth }]}>
            {namePadded.split('').map((c, i) =>
              c === ' ' ? (
                <View key={`n-${i}`} style={styles.manifestEmpty}>
                  <Text style={styles.dimGlyph}>·</Text>
                </View>
              ) : (
                <FlipCell
                  key={`n-${i}`}
                  targetChar={c}
                  stopAfter={
                    isStatic ? 0
                      : isPopulate ? (FLIGHT_SLOTS + i) * POPULATE_STAGGER
                      : NAME_START + i * STAGGER_MS
                  }
                  cellSize={CELL}
                  instant={isStatic}
                  reveal={isPopulate}
                  tile={tiled}
                />
              )
            )}
          </View>

          {/* ORIGIN */}
          <View style={[styles.cellsRow, { width: colWidth(ORIGIN_SLOTS) }]}>
            {iataPadded.split('').map((c, i) =>
              c === ' ' || c === '·' ? (
                <View
                  key={`o-${i}`}
                  style={styles.manifestEmpty}
                >
                  <Text style={styles.dimGlyph}>·</Text>
                </View>
              ) : (
                <FlipCell
                  key={`o-${i}`}
                  targetChar={c}
                  stopAfter={
                    isStatic ? 0
                      : isPopulate ? (FLIGHT_SLOTS + nameSlots + i) * POPULATE_STAGGER
                      : originStart + i * STAGGER_MS
                  }
                  cellSize={CELL}
                  instant={isStatic}
                  reveal={isPopulate}
                  tile={tiled}
                />
              )
            )}
          </View>
        </View>

        {/* Stranger row — flips in below yours when a curiosity match lands. */}
        {stranger ? (
          <StrangerRow
            flightIata={stranger.flightIata}
            originIata={stranger.originIata}
            passengerColWidth={passengerColWidth}
            passengerSlots={nameSlots}
          />
        ) : null}
      </View>

      {/* STATUS caption */}
      {status === 'none' ? null : (
        <StatusCaption
          status={status}
          revealAt={isStatic ? 0 : statusRevealMs}
        />
      )}
    </View>
  )
}

// Second row: flight + dim passenger placeholder + origin. Slides in from below.
function StrangerRow({
  flightIata,
  originIata,
  passengerColWidth,
  passengerSlots,
}: {
  flightIata: string
  originIata: string
  passengerColWidth: number
  passengerSlots: number
}) {
  const translateY = useRef(new Animated.Value(8)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  const flightPadded = flightIata.toUpperCase().padEnd(FLIGHT_SLOTS, ' ').slice(0, FLIGHT_SLOTS)
  const origin = originIata.toUpperCase().padEnd(ORIGIN_SLOTS, ' ').slice(0, ORIGIN_SLOTS)
  // Match the visual width of the live passenger column — never the raw name
  // length, since that would re-introduce the right-edge overflow.
  const passengerPlaceholder = '─'.repeat(passengerSlots)

  return (
    <Animated.View style={[styles.row, styles.strangerRow, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.cellsRow, { width: flightColWidth, gap: FLIGHT_CELL_GAP }]}>
        {flightPadded.split('').map((c, i) =>
          c === ' ' ? (
            <View key={`sf-${i}`} style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.boardTile }}>
              <Text style={styles.dimGlyph}>·</Text>
            </View>
          ) : (
            <FlipCell key={`sf-${i}`} targetChar={c} stopAfter={120 + i * STAGGER_MS} cellSize={CELL} />
          )
        )}
      </View>

      <View style={[styles.cellsRow, { width: passengerColWidth }]}>
        <Text style={styles.passengerPlaceholder}>{passengerPlaceholder}</Text>
      </View>

      <View style={[styles.cellsRow, { width: colWidth(ORIGIN_SLOTS) }]}>
        {origin.split('').map((c, i) =>
          c === ' ' ? (
            <View
              key={`s-${i}`}
              style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.boardTile }}
            >
              <Text style={styles.dimGlyph}>·</Text>
            </View>
          ) : (
            <FlipCell key={`s-${i}`} targetChar={c} stopAfter={120 + i * STAGGER_MS} cellSize={CELL} />
          )
        )}
      </View>
    </Animated.View>
  )
}

// Renders "STATUS · {word}" with the word fading in after the board settles
// and then quietly churning in place every ~6s (standby/scanning) or sitting
// dim and still (gate-quiet).
function StatusCaption({
  status,
  revealAt,
}: {
  status: ManifestStatus
  revealAt: number
}) {
  const word = status === 'gate-quiet' ? 'GATE QUIET' : status === 'scanning' ? 'SCANNING' : 'STANDBY'
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }).start()
    }, revealAt)
    return () => clearTimeout(t)
  }, [revealAt])

  const isQuiet = status === 'gate-quiet'

  return (
    <Animated.View style={[styles.caption, { opacity }]}>
      <Text style={styles.captionLabel}>STATUS  ·  </Text>
      {isQuiet ? (
        <Text style={[styles.captionStandby, styles.captionQuiet]}>{word}</Text>
      ) : (
        <ChurningStatusText text={word} style={styles.captionStandby} />
      )}
    </Animated.View>
  )
}

const colWidth = (slots: number) => slots * Math.round(CELL * 0.69) + (slots - 1) * CELL_GAP

const styles = StyleSheet.create({
  // Empty flap slot — a grey square box, matching the populated FlipCells.
  manifestEmpty: { width: CELL_WIDTH, height: CELL, backgroundColor: colors.boardTile },
  board: {
    backgroundColor: colors.board,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderRadius: 4,
    // Hard right boundary — the board cannot grow past its parent's content
    // width, regardless of what's inside. Combined with flexWrap on the row,
    // any column that doesn't fit drops to a new line starting at the left.
    maxWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    // Single line always — the passenger column is capped (NAME_MAX_SLOTS) so
    // the trio fits without wrapping; a long name is truncated instead.
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    columnGap: COL_GAP,
    rowGap: ROW_WRAP_GAP,
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
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
    paddingLeft: 4,
  },
  captionLabel: {
    fontFamily: fonts.board,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 1.8,
  },
  captionStandby: {
    fontFamily: fonts.board,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 2,
    fontWeight: '600',
  },
  captionQuiet: {
    color: colors.subtle,
    opacity: 0.55,
  },
  strangerRow: {
    marginTop: 6,
  },
  flightCode: {
    color: colors.boardText,
    opacity: 0.85,
    fontFamily: BOARD_FONT,
    fontSize: 13,
    letterSpacing: 1,
  },
  passengerPlaceholder: {
    color: colors.boardText,
    opacity: 0.32,
    fontFamily: BOARD_FONT,
    fontSize: 14,
    letterSpacing: 1.5,
  },
})
