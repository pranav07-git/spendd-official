import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Profile } from '../storage/appState';
import { fontFamily, makeStyles } from '../theme';

/** The user's chosen emoji, or the initial of their name, in a charcoal circle. */
export function Avatar({
  profile,
  size,
  round = true,
  style,
}: {
  profile: Profile;
  size: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const initial = profile.name.trim().charAt(0).toUpperCase() || '₹';
  return (
    <View
      style={[s.tile, { width: size, height: size, borderRadius: round ? size / 2 : size * 0.3 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {profile.avatar ? (
        <Text style={{ fontSize: size * 0.48 }}>{profile.avatar}</Text>
      ) : (
        <Text style={[s.initial, { fontSize: size * 0.44 }]}>{initial}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  tile: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken },
  initial: { fontFamily: fontFamily.displayBold, color: c.ink },
}));
