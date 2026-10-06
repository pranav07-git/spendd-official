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

/** White pill, black label: the one main action on a screen (docs/DESIGN.md button-primary). */
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

/** Charcoal pill (docs/DESIGN.md button-secondary): secondary actions. */
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

/** Quiet text action: Skip, Maybe later, Delete. */
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
      style={({ pressed }) => [s.quiet, pressed && s.dim, style]}>
      {({ pressed }) => (
        <Text style={[s.quietLabel, { color: color ?? c.ink }, pressed && s.underline]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(c => ({
  primary: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: c.marigold,
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { backgroundColor: c.surfaceSunken },
  primaryLabel: { ...type.button, color: c.onMarigold },
  labelDisabled: { color: c.inkSubtle },
  // docs/DESIGN.md: pressing shrinks the pill slightly instead of darkening it.
  pressed: { transform: [{ scale: 0.97 }] },
  dim: { opacity: 0.7 },
  outline: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineDisabled: { opacity: 0.4 },
  outlineLabel: { ...type.button, color: c.ink },
  quiet: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space[4] },
  quietLabel: { ...type.button },
  underline: { textDecorationLine: 'underline' },
}));
