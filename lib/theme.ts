// STANDBY design system — a modern glassmorphism visual language.
//
// Direction: premium airport social layer. Off-white/white backgrounds,
// frosted translucent grey/white glass panels, soft blur, mixed opacity,
// and subtle red / blue / lilac gradient lighting drawn from the logo.
// Deep charcoal for text — never harsh pure black. Pill-shaped glass buttons.
//
// Tokens are defined once here and reused everywhere. Screens read the
// semantic aliases (bg, surface, border, text, subtle, accent, …) so a change
// here propagates across the whole app; the shared glass components in
// components/ui/ layer the frosted surfaces + gradients on top.

// ---------------------------------------------------------------------------
// Brand palette — exact hex values.
// ---------------------------------------------------------------------------
const brand = {
  scarlet: '#DE1717',       // primary — CTAs, active/current state, errors
  skyBlue: '#97D0E3',       // secondary — selected states, cool accent
  white: '#FFFFFF',
  alabasterGrey: '#E7E7E7', // light neutral surface / hairlines
  lilacAsh: '#A796AE',      // tertiary accent — gradient midtone
  offWhite: '#F6F5F8',      // clean off-white screen background
  charcoal: '#1C1B20',      // deep, soft black — primary text
}

export const colors = {
  // Raw brand tokens (use these when you specifically want a brand hue).
  scarlet: brand.scarlet,
  skyBlue: brand.skyBlue,
  alabasterGrey: brand.alabasterGrey,
  lilacAsh: brand.lilacAsh,
  offWhite: brand.offWhite,
  charcoal: brand.charcoal,
  white: brand.white,
  black: brand.charcoal, // legacy key → soft charcoal, never harsh #000

  // A slightly deeper scarlet for pressed states / gradient starts.
  scarletDeep: '#B71212',
  skyBlueDeep: '#6FB6CE',

  // Glass surfaces — translucent fills meant to sit over the off-white
  // background or a gradient glow, with a BlurView behind them.
  glassWhite: 'rgba(255,255,255,0.62)',
  glassWhiteStrong: 'rgba(255,255,255,0.78)',
  glassGrey: 'rgba(231,231,231,0.45)',
  glassGreyStrong: 'rgba(231,231,231,0.62)',

  // Tinted glass glows (very low opacity, for gradient washes).
  glassScarlet: 'rgba(222,23,23,0.10)',
  glassSky: 'rgba(151,208,227,0.16)',
  glassLilac: 'rgba(167,150,174,0.14)',

  // Borders — soft, translucent. A light hairline for glass edges, plus a
  // brighter white edge for panels that sit over a gradient/dark board.
  borderGlass: 'rgba(255,255,255,0.55)',
  borderGlassStrong: 'rgba(255,255,255,0.72)',
  borderHair: 'rgba(28,27,32,0.10)',

  // Text.
  textPrimary: brand.charcoal,
  textSecondary: 'rgba(28,27,32,0.56)',
  textTertiary: 'rgba(28,27,32,0.38)',
  onAccent: '#FFFFFF',        // text/icons on scarlet or gradient fills

  // ------------------------------------------------------------------
  // Semantic aliases — the keys existing screens already import. Remapped
  // to the new system so the whole app shifts without touching each file.
  // ------------------------------------------------------------------
  accent: brand.scarlet,      // was #D12D35 → brand scarlet
  periwinkle: brand.skyBlue,  // was #7AA5C8 → brand sky blue
  bg: brand.offWhite,         // screen background — off-white, not pure white
  surface: 'rgba(255,255,255,0.62)', // card/surface → glass
  border: 'rgba(28,27,32,0.10)',     // was #000000 → soft glass hairline
  text: brand.charcoal,       // was #000000 → deep charcoal
  subtle: 'rgba(28,27,32,0.56)',
  error: brand.scarlet,

  // Split-flap / boarding board — modernized into a deep slate "grey glass"
  // rather than heavy pure black, while keeping the airport-board contrast.
  board: '#26262C',
  boardSeam: 'rgba(0,0,0,0.32)',
  boardText: '#F4F3F6',
  boardDim: 'rgba(244,243,246,0.46)',
}

// ---------------------------------------------------------------------------
// Gradient tokens — arrays consumed by expo-linear-gradient (`colors` prop).
// The red→blue logo gradient is the signature accent treatment.
// ---------------------------------------------------------------------------
export const gradients = {
  redToBlue: ['#DE1717', '#97D0E3'] as const,
  redToLilacToBlue: ['#DE1717', '#A796AE', '#97D0E3'] as const,
  scarlet: ['#E5352F', '#C21212'] as const,        // button fill (subtle depth)
  sky: ['#A9D8E8', '#7FBFD6'] as const,
  // Soft, near-transparent washes for background glows behind glass.
  softGlassGlow: ['rgba(222,23,23,0.12)', 'rgba(151,208,227,0.12)'] as const,
  scarletGlow: ['rgba(222,23,23,0.18)', 'rgba(222,23,23,0.0)'] as const,
  skyGlow: ['rgba(151,208,227,0.22)', 'rgba(151,208,227,0.0)'] as const,
  lilacGlow: ['rgba(167,150,174,0.20)', 'rgba(167,150,174,0.0)'] as const,
  // A very light top-to-bottom sheen for glass card surfaces.
  glassSheen: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.04)'] as const,
}

// Standard diagonal for the signature gradient (top-left → bottom-right).
export const gradientDirection = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const

// ---------------------------------------------------------------------------
// Spacing — 4pt base scale.
// ---------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  screenX: 24, // default screen horizontal padding
}

// ---------------------------------------------------------------------------
// Radius — generous, pill-forward.
// ---------------------------------------------------------------------------
export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  '2xl': 34,
  pill: 999,
}

// ---------------------------------------------------------------------------
// Blur — intensities for BlurView (expo-blur).
// ---------------------------------------------------------------------------
export const blur = {
  subtle: 18,
  card: 32,
  panel: 44,
  heavy: 60,
  // Tint used on BlurView; 'light' reads best over the off-white bg.
  tint: 'light' as const,
}

// ---------------------------------------------------------------------------
// Opacity tokens — interaction + layering.
// ---------------------------------------------------------------------------
export const opacity = {
  pressed: 0.85,
  pressedGhost: 0.5,
  disabled: 0.4,
  glassFill: 0.62,
}

// ---------------------------------------------------------------------------
// Elevation / shadow presets. Soft, diffuse — premium, not harsh.
// Spread as `...shadow.card` into a style object.
// ---------------------------------------------------------------------------
export const shadow = {
  none: {},
  sm: {
    shadowColor: '#1C1B20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    shadowColor: '#1C1B20',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 6,
  },
  panel: {
    shadowColor: '#1C1B20',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 40,
    elevation: 14,
  },
  // Coloured glow — a scarlet-tinted lift for primary CTAs.
  accentGlow: {
    shadowColor: brand.scarlet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 8,
  },
}

export const theme = { colors, gradients, gradientDirection, spacing, radius, blur, opacity, shadow }
export default theme
