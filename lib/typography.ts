import { Platform, TextStyle } from 'react-native'

export const fonts = {
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifBold: 'Fraunces_600SemiBold',
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Menlo, Consolas, monospace',
  }) as string,
}

export const type: Record<string, TextStyle> = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.serifBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  subhead: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: 0,
  },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 26,
  },
  bodyItalic: {
    fontFamily: fonts.serifItalic,
    fontSize: 17,
    lineHeight: 24,
  },
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
}
