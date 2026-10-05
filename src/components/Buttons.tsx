import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, radius, space, type, useTheme } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Kept for compatibility; DESIGN.md: no arrows on buttons. */
  withArrow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Marigold, ink label, one per screen (DESIGN.md §5.1). */
export function PrimaryButton({ label, onPress, disabled, loading, style }: ButtonProps) {
  const s = useStyles();
  const { c } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [s.primary, disabled && s.primaryDisabled, pressed && s.pressed, style]}>
      {loading ? <ActivityIndicator color={c.onMarigold} /> : <Text style={[s.primaryLabel, disabled && s.labelDisabled]}>{label}</Text>}
    </Pressable>
  );
}

/** Surface fill with an ink outline. */
export function OutlineButton({ label, onPress, disabled, style }: ButtonProps) {
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.outline, pressed && s.pressed, disabled && s.outlineDisabled, style]}>
      <Text style={s.outlineLabel}>{label}</Text>
    </Pressable>
  );
}

/** Quiet text action: Skip, Not now, Learn more. */
export function TextButton({
  label,
  onPress,
  color,
  style,
}: {
  label: ReactNode;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [s.quiet, pressed && s.pressed, style]}>
      {({ pressed }) => (
        <Text style={[s.quietLabel, { color: color ?? c.ink }, pressed && s.underline]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(c => ({
  primary: {
    minHeight: 52,
    borderRadius: radius.m,
    backgroundColor: c.marigold,
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { backgroundColor: c.surfaceSunken },
  primaryLabel: { ...type.label, fontSize: 16, color: c.onMarigold },
  labelDisabled: { color: c.inkSubtle },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  outline: {
    minHeight: 52,
    borderRadius: radius.m,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.ink,
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineDisabled: { opacity: 0.4 },
  outlineLabel: { ...type.label, fontSize: 16, color: c.ink },
  quiet: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4] },
  quietLabel: { ...type.label },
  underline: { textDecorationLine: 'underline' },
}));
