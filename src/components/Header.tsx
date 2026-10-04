import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeftIcon } from './Icons';
import { colors, fonts } from '../theme';

type HeaderProps = {
  title: string;
  onBack?: () => void;
  /** Biometric screen variant: raised bar with a bottom divider. */
  bordered?: boolean;
};

export function Header({ title, onBack, bordered }: HeaderProps) {
  return (
    <View style={[styles.bar, bordered && styles.bordered]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={onBack}
          style={styles.back}>
          <ArrowLeftIcon />
        </Pressable>
      ) : null}
      <Text style={[styles.title, bordered && styles.titleWide]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: {
    backgroundColor: '#0E0E0E',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  back: { position: 'absolute', left: 18, top: 20 },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text,
  },
  titleWide: { fontSize: 13, letterSpacing: 3 },
});
