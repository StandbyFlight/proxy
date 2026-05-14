import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native'

const TARGET = 'STANDBY'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BOARD_FONT = Platform.select({
  ios: 'AvenirNext-Medium',
  android: 'sans-serif',
  default: 'Avenir Next, Avenir, Helvetica, Arial, sans-serif',
})

function FlipCell({ targetChar, stopAfter }: { targetChar: string; stopAfter: number }) {
  const [char, setChar] = useState(CHARS[Math.floor(Math.random() * CHARS.length)])
  const scaleY = useRef(new Animated.Value(1)).current

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    const start = Date.now()

    const cycle = () => {
      if (cancelled) return
      const elapsed = Date.now() - start
      const settle = elapsed >= stopAfter

      Animated.timing(scaleY, {
        toValue: 0,
        duration: settle ? 90 : 45,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return
        const next = settle ? targetChar : CHARS[Math.floor(Math.random() * CHARS.length)]
        setChar(next)
        Animated.timing(scaleY, {
          toValue: 1,
          duration: settle ? 110 : 55,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (!settle && !cancelled) {
            timer = setTimeout(cycle, 12)
          }
        })
      })
    }

    cycle()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <View style={styles.cell}>
      <Animated.View style={{ transform: [{ scaleY }] }}>
        <Text style={styles.cellChar}>{char}</Text>
      </Animated.View>
      <View style={styles.cellSeam} />
    </View>
  )
}

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.board}>
        <View style={styles.row}>
          {TARGET.split('').map((c, i) => (
            <FlipCell key={i} targetChar={c} stopAfter={2000 + i * 200} />
          ))}
        </View>
      </View>
    </View>
  )
}

const CELL_WIDTH = 40
const CELL_HEIGHT = 58

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    backgroundColor: '#0A0A0A',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  row: {
    flexDirection: 'row',
    gap: 3,
  },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 2,
  },
  cellChar: {
    color: '#F2F2F0',
    fontSize: 38,
    fontFamily: BOARD_FONT,
    lineHeight: 46,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cellSeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 28,
    height: 2,
    backgroundColor: '#000',
  },
})
