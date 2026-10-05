import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Profile } from '../storage/appState';
import { colors, fonts } from '../theme';

/** The user's chosen emoji, or the initial of their name. */
export function Avatar({
  profile,
  size,
  round = false,
  style,
}: {
  profile: Profile;
  size: number;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const initial = profile.name.trim().charAt(0).toUpperCase() || '₹';
  const radius = round ? size / 2 : 0;
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius },
        profile.avatar ? styles.emojiTile : styles.initialTile,
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {profile.avatar ? (
        <Text style={{ fontSize: size * 0.48 }}>{profile.avatar}</Text>
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.46 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  initialTile: { backgroundColor: colors.ink },
  emojiTile: { backgroundColor: '#262626' },
  initial: { fontFamily: fonts.serifBold, color: '#1A1A1A' },
});
