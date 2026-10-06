import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { makeStyles, radius, space, spotlight, type SpotlightTone } from '../theme';

/**
 * Gradient spotlight card (docs/DESIGN.md signature): a vivid violet / magenta / orange / coral
 * tile inside the dark layout. Use one, at most two, per screen; everything else stays charcoal.
 * Content on it is white.
 */
export function Spotlight({
  tone = 'violet',
  children,
  style,
  padded = true,
}: {
  tone?: SpotlightTone;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const s = useStyles();
  const [from, to] = spotlight[tone];
  const id = `spotlight-${tone}`;
  return (
    <View style={[s.card, padded && s.padded, style]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  padded: { padding: space[6] + 2 },
}));
