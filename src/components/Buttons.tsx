import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ArrowRightIcon } from './Icons';
import { colors, fonts } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Label left + arrow right (onboarding style) instead of a centred label. */
  withArrow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, disabled, loading, withArrow, style }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        withArrow ? styles.spaced : styles.centred,
        disabled && styles.primaryDisabled,
        pressed && styles.pressed,
        style,
      ]}>
      <Text style={[styles.primaryLabel, disabled && styles.primaryLabelDisabled]}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={colors.background} />
      ) : withArrow ? (
        <ArrowRightIcon />
      ) : null}
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.outline, pressed && styles.outlinePressed, style]}>
      <Text style={styles.outlineLabel}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  color = colors.textMuted,
  style,
}: {
  label: ReactNode;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.text, pressed && styles.pressed, style]}>
      <Text style={[styles.textLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 64,
    paddingHorizontal: 24,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaced: { justifyContent: 'space-between' },
  centred: { justifyContent: 'center' },
  primaryDisabled: { backgroundColor: colors.disabled },
  primaryLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 2.8,
    color: colors.background,
  },
  primaryLabelDisabled: { color: colors.disabledText },
  pressed: { opacity: 0.75 },
  outline: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlinePressed: { backgroundColor: colors.surface },
  outlineLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.text,
  },
  text: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  textLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2,
  },
});
