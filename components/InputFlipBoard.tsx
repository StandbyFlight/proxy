import { useRef } from 'react'
import { View, Pressable, TextInput, StyleSheet, Platform } from 'react-native'
import { InputFlipCell } from './InputFlipCell'

// Renders flip cells that grow with the typed value.
// Visible cells = max(minSlots, min(maxLength, value.length)).
// Tapping anywhere on the row focuses a hidden input so the keyboard opens.
// Cells past the typed value render dim placeholders.
export function InputFlipBoard({
  value,
  minSlots,
  maxLength,
  onChangeText,
  cellSize = 46,
  cellWidth,
  gap = 4,
  autoFocus = false,
  autoCapitalize = 'characters',
  keyboardType = 'default',
  filter,
}: {
  value: string
  minSlots: number
  maxLength: number
  onChangeText: (text: string) => void
  cellSize?: number
  cellWidth?: number
  gap?: number
  autoFocus?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: 'default' | 'number-pad' | 'email-address'
  filter?: (raw: string) => string
}) {
  const inputRef = useRef<TextInput>(null)

  const visibleSlots = Math.max(minSlots, Math.min(maxLength, value.length))
  const chars: string[] = []
  for (let i = 0; i < visibleSlots; i++) {
    chars.push(value[i] ?? '')
  }

  const focus = () => inputRef.current?.focus()

  return (
    <Pressable onPress={focus} style={styles.wrap}>
      <View style={[styles.row, { gap }]}>
        {chars.map((c, i) => (
          <InputFlipCell key={i} char={c} cellSize={cellSize} cellWidth={cellWidth} />
        ))}
      </View>

      <TextInput
        ref={inputRef}
        style={styles.hidden}
        value={value}
        onChangeText={(t) => {
          const next = filter ? filter(t) : t
          onChangeText(next.slice(0, maxLength))
        }}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        maxLength={maxLength}
        caretHidden
        // Avoid native suggestion bar covering the screen on iOS
        spellCheck={false}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    // On Android, fully off-screen elements can lose focus; keep within view.
    top: Platform.OS === 'android' ? 0 : -1000,
  },
})
