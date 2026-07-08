import { Platform, TextStyle } from 'react-native'

// STANDBY typography — one centralized system, Elms Sans everywhere.
//
//   Elms Sans (@expo-google-fonts/elms-sans) is the single brand family for
//   ALL UI text — headings, titles, body, labels, captions, buttons, tabs.
//   Weights are loaded in app/_layout.tsx.
//
//   mono — DepartureMono / Menlo: the split-flap flip-board components ONLY
//   (FlipCell, InputFlipCell, ManifestBoard, EnrichmentRow). This is the
//   "airport board" character and is intentionally kept.

export const fonts = {
  // Weighted Elms Sans families.
  thin: 'ElmsSans_100Thin',
  light: 'ElmsSans_300Light',
  regular: 'ElmsSans_400Regular',
  medium: 'ElmsSans_500Medium',
  semibold: 'ElmsSans_600SemiBold',
  bold: 'ElmsSans_700Bold',
  extrabold: 'ElmsSans_800ExtraBold',
  black: 'ElmsSans_900Black',

  // Semantic roles (what most styles reference).
  display: 'ElmsSans_800ExtraBold', // big page titles / headlines
  heading: 'ElmsSans_700Bold',
  title: 'ElmsSans_600SemiBold',
  body: 'ElmsSans_400Regular',
  bodyMedium: 'ElmsSans_500Medium',
  bodyBold: 'ElmsSans_700Bold',
  label: 'ElmsSans_600SemiBold',

  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Menlo, Consolas, monospace',
  }) as string,
}

// Centralized type scale. Existing keys (eyebrow, display, headline,
// sectionTitle, subhead, body, bodyBold, hint, monoSmall) are preserved so no
// screen breaks; the requested roles (heading, title, label, caption) are
// added. Headings are Elms Sans in sentence case for a modern, softer feel —
// uppercase is reserved for eyebrow/label/hint chips.
export const type: Record<string, TextStyle> = {
  // Small uppercase kicker above titles.
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
  // Largest page title.
  display: {
    fontFamily: fonts.black,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  // Primary screen headline.
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
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
