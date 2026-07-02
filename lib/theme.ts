// STANDBY palette — exact hex values, defined once and reused everywhere.
// The app theme is WHITE: screens default to #FFFFFF, cards/surfaces are
// #FFFFFF with #000000 borders/text. The four accent colors are used only as
// intentional accents, highlights, selected states, and status blocks.

// Four colors only: red accent, blue-gray secondary, black, white.
// (subtle/board dims are black or white with alpha, not new hues.)
export const colors = {
  white: '#FFFFFF',
  black: '#000000',
  accent: '#D12D35',      // red — CTAs, active/current state, errors
  periwinkle: '#7AA5C8',  // blue-gray — selected states, highlight/status blocks

  // Semantic aliases.
  bg: '#FFFFFF',          // screen background
  surface: '#FFFFFF',     // card/surface background
  border: '#000000',      // card/surface borders
  text: '#000000',
  subtle: 'rgba(0,0,0,0.55)',
  // Foreground (text/icons) on the red accent fill — white for contrast.
  onAccent: '#FFFFFF',
  board: '#000000',       // flip-board / boarding-pass module background
  boardSeam: '#000000',   // seam line between flip-cell halves
  boardText: '#FFFFFF',
  boardDim: 'rgba(255,255,255,0.45)',
  error: '#D12D35',
}
