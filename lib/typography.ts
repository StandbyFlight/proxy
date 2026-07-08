import { Platform, TextStyle } from 'react-native'

// STANDBY typography — one centralized system, Zalando Sans SemiExpanded everywhere.
//
//   Zalando Sans SemiExpanded (@expo-google-fonts/zalando-sans-semiexpanded) is
//   the single brand family for ALL UI text — headings, titles, body, labels,
//   captions, buttons, tabs. Weights are loaded in app/_layout.tsx.
//
//   mono — DepartureMono / Menlo: the split-flap flip-board components ONLY
//   (FlipCell, InputFlipCell, ManifestBoard, EnrichmentRow). This is the
//   "airport board" character and is intentionally kept.

export const fonts = {
  // Weighted Zalando Sans SemiExpanded families. (No 100 Thin — nearest is
  // 200 ExtraLight.)
  thin: 'ZalandoSansSemiExpanded_200ExtraLight',
  light: 'ZalandoSansSemiExpanded_300Light',
  regular: 'ZalandoSansSemiExpanded_400Regular',
  medium: 'ZalandoSansSemiExpanded_500Medium',
  semibold: 'ZalandoSansSemiExpanded_600SemiBold',
  bold: 'ZalandoSansSemiExpanded_700Bold',
  extrabold: 'ZalandoSansSemiExpanded_800ExtraBold',
  black: 'ZalandoSansSemiExpanded_900Black',

  // Semantic roles (what most styles reference).
  display: 'Anton_400Regular',      // big page titles / headlines — Anton
  heading: 'ZalandoSansSemiExpanded_700Bold',
  title: 'ZalandoSansSemiExpanded_600SemiBold',
  body: 'ZalandoSansSemiExpanded_400Regular',
  bodyMedium: 'ZalandoSansSemiExpanded_500Medium',
  bodyBold: 'ZalandoSansSemiExpanded_700Bold',
  label: 'ZalandoSansSemiExpanded_600SemiBold',

  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Menlo, Consolas, monospace',
  }) as string,

  // Board font — Inter, used by the split-flap flip-board components
  // (FlipCell, InputFlipCell, ManifestBoard, EnrichmentRow). Replaces the old
  // DepartureMono/Menlo "airport board" mono for a cleaner modern read.
  board: 'Inter_700Bold',

  // Elms Sans (@expo-google-fonts/elms-sans) — the boarding pass text and the
  // bottom nav bar. Per-weight families are loaded in app/_layout.tsx; custom
  // fonts need distinct family names per weight rather than `fontWeight`.
  elmsSans: {
    regular: 'ElmsSans_400Regular',
    medium: 'ElmsSans_500Medium',
    bold: 'ElmsSans_700Bold',
    extrabold: 'ElmsSans_800ExtraBold',
  },
}

// Centralized type scale. Existing keys (eyebrow, display, headline,
// sectionTitle, subhead, body, bodyBold, hint, monoSmall) are preserved so no
// screen breaks; the requested roles (heading, title, label, caption) are
// added. Headings are Zalando Sans SemiExpanded in sentence case for a modern,
// softer feel —
// uppercase is reserved for eyebrow/label/hint chips.
export const type: Record<string, TextStyle> = {
  // Small uppercase kicker above titles.
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
  // Largest page title — Anton.
  display: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Primary screen headline — Anton.
  headline: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Section / card heading.
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  // Medium title (e.g. list rows, card titles).
  title: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  // Small uppercase section title (legacy — kept for existing callers).
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subhead: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  bodyBold: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 23,
  },
  // Button / chip label.
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  // Small caption / meta.
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  // Uppercase micro-label (legacy).
  hint: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
}
