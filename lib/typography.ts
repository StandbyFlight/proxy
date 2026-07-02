import { Platform, TextStyle } from 'react-native'

// Type system:
//   display — Anton Regular: all major page titles and headings.
//   body    — Roc Grotesk: all normal text, labels, buttons, tabs, body copy.
//             Roc Grotesk is a licensed font; the family names resolve once
//             the .otf files are added to assets/fonts and registered in
//             app/_layout.tsx. Until then RN falls back to the system sans
//             (the documented fallback), with weights preserved.
//   mono    — Menlo: flip-board / mechanical text only.

export const fonts = {
  display: 'Anton_400Regular',
  body: 'RocGrotesk-Regular',
  bodyBold: 'RocGrotesk-Bold',
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Menlo, Consolas, monospace',
  }) as string,
}

export const type: Record<string, TextStyle> = {
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  display: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Small Anton section titles (e.g. "Upcoming & Live").
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subhead: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
  },
  bodyBold: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 23,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
}
