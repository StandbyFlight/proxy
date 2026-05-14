import { useRef } from 'react'
import { View, Pressable, TextInput, StyleSheet, Platform } from 'react-native'
import { InputFlipCell } from './InputFlipCell'

// Renders `length` flip cells filled by the characters of `value`.
// Tapping anywhere on the row focuses a hidden input so the keyboard opens.
// Empty slots render dim placeholders so the user can see how many remain.
export function InputFlipBoard({
  value,
  length,
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
  length: number
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

  const chars: string[] = []
  for (let i = 0; i < length; i++) {
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
          onChangeText(next.slice(0, length))
        }}
        autoFocus={autoFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        maxLength={length}
        caretHidden
        // Avoid native suggestion bar covering the screen on iOS
        spellCheck={false}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center' },
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    // On Android, fully off-screen elements can lose focus; keep within view.
    top: Platform.OS === 'android' ? 0 : -1000,
  },
})
