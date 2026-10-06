import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '../theme';

/** Full-bleed screen on the flat app canvas that keeps content clear of the status and nav bars. */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>
      {children}
    </View>
  );
}

const useStyles = makeStyles(c => ({ root: { flex: 1, backgroundColor: c.bg } }));
