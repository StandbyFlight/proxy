import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Platform, Animated, Easing } from 'react-native'
import { FlipCell } from './FlipCell'
import { colors } from '../lib/theme'
import { fonts } from '../lib/typography'
import { haptics } from '../lib/haptics'
import { ChurningStatusText } from './ChurningStatusText'

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

const FLIGHT_SLOTS = 3
const FLIGHT_START = 0   // flight column settles first, before name
const NAME_START = 500
const STATUS_PAD = 250

export type ManifestStatus = 'standby' | 'scanning' | 'gate-quiet' | 'none'

export function ManifestBoard({
  firstName,
  iata,
  flightIata,
  mode = 'cinematic',
  stranger,
  status = 'standby',
}: {
  firstName: string
  iata: string
  flightIata?: string | null
  mode?: 'cinematic' | 'static'
  stranger?: { flightIata: string; originIata: string } | null
  status?: ManifestStatus
}) {
  const nameUpper = firstName.toUpperCase()
  const nameSlots = Math.max(NAME_MIN_SLOTS, nameUpper.length)
  const namePadded = nameUpper.padEnd(nameSlots, ' ').slice(0, nameSlots)
  const iataPadded = iata.toUpperCase().padEnd(ORIGIN_SLOTS, ' ').slice(0, ORIGIN_SLOTS)

  // Origin cells start settling after the last name cell does, plus a beat.
  const originStart = NAME_START + nameSlots * STAGGER_MS + COLUMN_DELAY
  const statusRevealMs =
    originStart + ORIGIN_SLOTS * STAGGER_MS + STATUS_PAD

  const isStatic = mode === 'static'

  useEffect(() => {
    if (isStatic) return
    const t = setTimeout(haptics.standbyStamp, statusRevealMs)
    return () => clearTimeout(t)
  }, [statusRevealMs, isStatic])

  return (
    <View>
      <View style={styles.board}>
        {/* Column headers */}
        <View style={[styles.row, { marginBottom: 8 }]}>
          <View style={{ width: colWidth(FLIGHT_SLOTS) }}>
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

        {/* Your row */}
        <View style={styles.row}>
          {/* FLIGHT — FlipCells when we have a flight, dim dots otherwise */}
          <View style={[styles.cellsRow, { width: colWidth(FLIGHT_SLOTS) }]}>
            {flightIata
              ? flightIata.toUpperCase().padEnd(FLIGHT_SLOTS, ' ').slice(0, FLIGHT_SLOTS).split('').map((c, i) =>
                  c === ' ' ? (
                    <View key={`f-${i}`} style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.board }}>
                      <Text style={styles.dimGlyph}>·</Text>
                    </View>
                  ) : (
                    <FlipCell
                      key={`f-${i}`}
                      targetChar={c}
                      stopAfter={isStatic ? 0 : FLIGHT_START + i * STAGGER_MS}
                      cellSize={CELL}
                    />
                  )
                )
              : <Text style={styles.flightDashes}>─ ─ ─ ─</Text>
            }
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
                  stopAfter={isStatic ? 0 : NAME_START + i * STAGGER_MS}
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
                  stopAfter={isStatic ? 0 : originStart + i * STAGGER_MS}
                  cellSize={CELL}
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
            nameSlots={nameSlots}
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
  nameSlots,
}: {
  flightIata: string
  originIata: string
  nameSlots: number
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
  const passengerPlaceholder = '─'.repeat(nameSlots)

  return (
    <Animated.View style={[styles.row, styles.strangerRow, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.cellsRow, { width: colWidth(FLIGHT_SLOTS) }]}>
        {flightPadded.split('').map((c, i) =>
          c === ' ' ? (
            <View key={`sf-${i}`} style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.board }}>
              <Text style={styles.dimGlyph}>·</Text>
            </View>
          ) : (
            <FlipCell key={`sf-${i}`} targetChar={c} stopAfter={120 + i * STAGGER_MS} cellSize={CELL} />
          )
        )}
      </View>
      <View style={styles.colSep} />

      <View style={[styles.cellsRow, { width: colWidth(nameSlots) }]}>
        <Text style={styles.passengerPlaceholder}>{passengerPlaceholder}</Text>
      </View>
      <View style={styles.colSep} />

      <View style={[styles.cellsRow, { width: colWidth(ORIGIN_SLOTS) }]}>
        {origin.split('').map((c, i) =>
          c === ' ' ? (
            <View
              key={`s-${i}`}
              style={{ width: Math.round(CELL * 0.69), height: CELL, backgroundColor: colors.board }}
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
