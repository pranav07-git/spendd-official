/** Design tokens from docs/DESIGN.md: near-black artboard, white pills, one blue, gradient spotlights. */
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
  /** Check glyphs only (docs/DESIGN.md semantic-success), never a surface. */
  success: string;
  jar: { mint: string; sky: string; peach: string; lilac: string; haldi: string; rose: string };
};

/**
 * docs/DESIGN.md: a near-black artboard. Hierarchy comes from surface lift (canvas → surface-1 →
 * surface-2) and ink → ink-muted, never from colour. One blue (`info`) marks links, focus and
 * selection; gradient spotlight cards (see components/Spotlight.tsx) are the only colour fills.
 * Dark is the only mode.
 */
export const dark: Palette = {
  bg: '#090909',
  surface: '#141414',
  surfaceSunken: '#1C1C1C',
  ink: '#FFFFFF',
  inkMuted: '#999999',
  inkSubtle: '#666666',
  line: '#262626',
  // Primary actions are white pills with black labels.
  marigold: '#FFFFFF',
  marigoldSoft: '#1C1C1C',
  onMarigold: '#000000',
  onInk: '#000000',
  rani: '#FFFFFF',
  raniSoft: '#1C1C1C',
  peacock: '#FFFFFF',
  peacockSoft: '#1C1C1C',
  headsup: '#FFFFFF',
  low: '#FFFFFF',
  /** The single accent: links, focus rings, selection. Never a fill for buttons or sections. */
  info: '#0099FF',
  success: '#22C55E',
  jar: { mint: '#1C1C1C', sky: '#1C1C1C', peach: '#1C1C1C', lilac: '#1C1C1C', haldi: '#1C1C1C', rose: '#1C1C1C' },
};

/** Kept so older imports compile; Spendd has one (dark) look. */
export const light: Palette = dark;

/** Gradient spotlight cards: one or two per screen at most. [start, end] stops. */
export const spotlight = {
  violet: ['#6A4CF5', '#3A1F9E'],
  magenta: ['#D44DF0', '#6A4CF5'],
  orange: ['#FF7A3D', '#FF5577'],
  coral: ['#FF5577', '#D44DF0'],
} as const;
export type SpotlightTone = keyof typeof spotlight;

// Font files live in android/app/src/main/assets/fonts; fontFamily must match the file name.
// Inter (SIL Open Font License) stands in for GT Walsheim, as docs/DESIGN.md suggests: SemiBold
// with tight negative tracking for display, Regular/Medium for everything else.
export const fontFamily = {
  display: 'Inter-SemiBold',
  displayBold: 'Inter-SemiBold',
  body: 'Inter-Regular',
  bodyBold: 'Inter-Medium',
  medium: 'Inter-Medium',
};

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * docs/DESIGN.md typography: tracking tightens hard as size grows (about -4% on display, -1% on
 * body); weights stay in a narrow band. Sentence case everywhere. Colour is applied by the caller.
 */
export const type = {
  amountHero: { fontFamily: fontFamily.display, fontSize: 52, lineHeight: 54, letterSpacing: -2.4, ...tabular },
  /** Screen headline: poster-like, tight. */
  story: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 33, letterSpacing: -1.1 },
  title: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.8 },
  /** Section titles and header titles. */
  heading: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 22, letterSpacing: -0.5 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 21, letterSpacing: -0.15 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, letterSpacing: -0.15 },
  label: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, letterSpacing: -0.14 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, letterSpacing: -0.13 },
  /** Small muted label above content ("Daily budget"). */
  eyebrow: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 16, letterSpacing: -0.13 },
  /** Pill button label. */
  button: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 18, letterSpacing: -0.15 },
  /** Lead text inside spotlight cards and next to display headlines. */
  subhead: { fontFamily: fontFamily.body, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  /** Amounts inside lists and rows. */
  amount: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21, letterSpacing: -0.15, ...tabular },
  /** Mid-size amounts (cards, tiles). */
  amountMedium: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.9, ...tabular },
} satisfies Record<string, TextStyle>;

/** Spacing scale (docs/DESIGN.md runs on 4/8/12/15/20/30/40). */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const SCREEN_PADDING = space[5];
export const SECTION_GAP = space[10];

/** 6 tags, 10 inputs and list items, 20 cards, 30 spotlight cards; pill for buttons and chips. */
export const radius = { s: 6, m: 10, l: 20, xl: 30, pill: 999 } as const;

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
