import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles, useTheme } from '../theme';
import { GlassBackdrop } from './Glass';

/**
 * Full-bleed screen on the app background that keeps content clear of the status and nav bars.
 * In dark mode it adds the faint glows that give the glass surfaces depth.
 */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { isDark } = useTheme();
  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>
      {isDark ? <GlassBackdrop /> : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles(c => ({ root: { flex: 1, backgroundColor: c.bg } }));
