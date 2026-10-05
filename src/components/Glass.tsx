import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Dark mode backdrop: two very faint white glows on near-black, so translucent glass surfaces
 * have light to catch. Static and drawn once behind the screen.
 */
export function GlassBackdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glowTop" cx="18%" cy="6%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.09} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="92%" cy="78%" r="60%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.05} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#glowTop)" />
      <Rect width="100%" height="100%" fill="url(#glowBottom)" />
    </Svg>
  );
}

/** The light catching the top edge of a glass card. Place inside a card with overflow hidden. */
export function GlassSheen() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="sheen" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.1} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.02} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sheen)" />
    </Svg>
  );
}
