/** Design tokens from docs/DESIGN.md §3. */
import type { TextStyle } from 'react-native';

export type Palette = {
  bg: string;
  surface: string;
  surfaceSunken: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  line: string;
  marigold: string;
  marigoldSoft: string;
  /** Text and icons on a `marigold` (primary) fill. */
  onMarigold: string;
  /** Text and icons on an `ink` fill (toasts, checked boxes). */
  onInk: string;
  rani: string;
  raniSoft: string;
  peacock: string;
  peacockSoft: string;
  headsup: string;
  low: string;
  info: string;
  jar: { mint: string; sky: string; peach: string; lilac: string; haldi: string; rose: string };
};

export const light: Palette = {
  bg: '#F3F4F8',
  surface: '#FFFFFF',
  surfaceSunken: '#E8EAF2',
  ink: '#1B1847',
  inkMuted: '#5B5878',
  inkSubtle: '#8D8AA6',
  line: '#DCDEE9',
  marigold: '#FFB000',
  marigoldSoft: '#FFF1CC',
  onMarigold: '#1B1847',
  onInk: '#FFFFFF',
  rani: '#E5007D',
  raniSoft: '#FFE0F0',
  peacock: '#0B7F82',
  peacockSoft: '#D4F1F1',
  headsup: '#C27400',
  low: '#B8441C',
  info: '#4B47C4',
  jar: { mint: '#BDEBD3', sky: '#C3DBFF', peach: '#FFD3BD', lilac: '#DCCFFF', haldi: '#FFE79A', rose: '#FFCCDA' },
};

/**
 * Dark mode: deep black and white with frosted-glass surfaces (translucent white over black,
 * hairline white edges). White is the hero colour, so the primary action is a white button with
 * black text; colour appears only as a small signal (income, wins, heads-ups).
 */
export const dark: Palette = {
  bg: '#050505',
  surface: 'rgba(255,255,255,0.06)',
  surfaceSunken: 'rgba(255,255,255,0.07)',
  ink: '#FFFFFF',
  inkMuted: 'rgba(255,255,255,0.66)',
  inkSubtle: 'rgba(255,255,255,0.42)',
  line: 'rgba(255,255,255,0.12)',
  marigold: '#FFFFFF',
  marigoldSoft: 'rgba(255,255,255,0.14)',
  onMarigold: '#050505',
  onInk: '#050505',
  rani: '#FF6FB5',
  raniSoft: 'rgba(255,111,181,0.14)',
  peacock: '#6FE3C8',
  peacockSoft: 'rgba(111,227,200,0.12)',
  headsup: '#F7C860',
  low: '#FF9478',
  info: '#B8B5FF',
  // Monochrome glass tiles: the icon tells categories apart, so colour is kept for signals only.
  jar: {
    mint: 'rgba(255,255,255,0.10)',
    sky: 'rgba(255,255,255,0.10)',
    peach: 'rgba(255,255,255,0.10)',
    lilac: 'rgba(255,255,255,0.10)',
    haldi: 'rgba(255,255,255,0.10)',
    rose: 'rgba(255,255,255,0.10)',
  },
};


// Font files live in android/app/src/main/assets/fonts; fontFamily must match the file name.
export const fontFamily = {
  display: 'Bricolage-SemiBold',
  displayBold: 'Bricolage-Bold',
  body: 'Atkinson-Regular',
  bodyBold: 'Atkinson-Bold',
};

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** DESIGN.md §3.2. Colour is applied by the caller. */
export const type = {
  amountHero: { fontFamily: fontFamily.displayBold, fontSize: 48, lineHeight: 56, ...tabular },
  story: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fontFamily.bodyBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  /** Amounts inside lists and rows. */
  amount: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 24, ...tabular },
  /** Mid-size amounts (cards, tiles). */
  amountMedium: { fontFamily: fontFamily.displayBold, fontSize: 24, lineHeight: 30, ...tabular },
} satisfies Record<string, TextStyle>;

/** 4-point scale (DESIGN.md §3.3): space[4] = 16. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const SCREEN_PADDING = space[5];
export const SECTION_GAP = space[8];

export const radius = { s: 8, m: 14, l: 24, xl: 32, pill: 999 } as const;

export const TOUCH_TARGET = 44;

const JAR_KEYS: (keyof Palette['jar'])[] = ['mint', 'sky', 'peach', 'lilac', 'haldi', 'rose'];

/** A stable jar colour for any name (category, payee), so it looks the same on every screen. */
export function jarColorFor(key: string, c: Palette): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.toLowerCase().charCodeAt(i)) % 1000003;
  }
  return c.jar[JAR_KEYS[hash % JAR_KEYS.length]];
}
