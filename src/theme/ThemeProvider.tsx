import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light, type Palette } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'spendd.theme';

type ThemeValue = {
  c: Palette;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue>({ c: light, isDark: false, preference: 'system', setPreference: () => {} });

/** Light first; follows the phone unless the user picks a theme in Profile. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(saved => saved && setPref(saved as ThemePreference))
      .catch(() => {});
  }, []);

  const value = useMemo(() => {
    const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');
    return {
      c: isDark ? dark : light,
      isDark,
      preference,
      setPreference: (p: ThemePreference) => {
        setPref(p);
        AsyncStorage.setItem(KEY, p).catch(() => {});
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
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

/** DESIGN.md §3.5: soft shadows in light mode, 1 px outlines in dark mode. */
export function elevation(level: 0 | 1 | 2 | 3, c: Palette, isDark: boolean): ViewStyle {
  if (level === 0) {
    return {};
  }
  if (isDark) {
    // Glass: a hairline white edge that brightens with height instead of a shadow.
    const edge = level === 1 ? c.line : level === 2 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.24)';
    return { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: edge };
  }
  const map = { 1: { elevation: 1, opacity: 0.06 }, 2: { elevation: 4, opacity: 0.1 }, 3: { elevation: 10, opacity: 0.18 } };
  return { elevation: map[level].elevation, shadowColor: '#1B1847', shadowOpacity: map[level].opacity };
}
