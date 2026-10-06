import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { dark, type Palette } from './tokens';

export type ThemePreference = 'dark';

type ThemeValue = {
  c: Palette;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const VALUE: ThemeValue = { c: dark, isDark: true, preference: 'dark', setPreference: () => {} };
const ThemeContext = createContext<ThemeValue>(VALUE);

/** docs/DESIGN.md is dark only, so there is one theme; the provider keeps the hook API stable. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={VALUE}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Theme-aware StyleSheet. Define once at module level, call the returned hook inside components:
 *
 *   const useStyles = makeStyles(c => ({ root: { backgroundColor: c.bg } }));
 *   function X() { const s = useStyles(); ... }
 */
type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function makeStyles<T extends Styles>(build: (c: Palette, isDark: boolean) => T): () => T {
  const cache = new Map<boolean, T>();
  return function useStyles() {
    const { c, isDark } = useTheme();
    let styles = cache.get(isDark);
    if (!styles) {
      styles = StyleSheet.create(build(c, isDark)) as T;
      cache.set(isDark, styles);
    }
    return styles;
  };
}

/**
 * docs/DESIGN.md depth: level 1 is just the charcoal surface (no border, no shadow); levels 2–3 are
 * floating things — a faint light top edge plus a soft drop shadow.
 */
export function elevation(level: 0 | 1 | 2 | 3, _c?: Palette, _isDark?: boolean): ViewStyle {
  if (level < 2) {
    return {};
  }
  return {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
    elevation: level === 2 ? 8 : 14,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
  };
}
