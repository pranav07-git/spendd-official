import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, Text, Vibration, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from './Header';
import { AccountIcon, BackspaceIcon } from './Icons';
import { Screen } from './Screen';
import { TextButton } from './Buttons';
import { PIN_LENGTH } from '../config';
import { useFirstName } from '../storage/useFirstName';
import { fontFamily, makeStyles, space, type, useTheme } from '../theme';

type PinEntryProps = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  /** Return an error message to reject the PIN (input shakes and clears), or null to accept. */
  onComplete: (pin: string) => Promise<string | null> | string | null;
  onForgot: () => void;
  /** Optional content for the otherwise empty bottom-left key (e.g. biometric unlock). */
  bottomLeftKey?: ReactNode;
  /** Defaults to "Hi <first name>," from the profile. */
  greeting?: string;
};

const KEY_SIZE = 76;

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['left', '0', 'delete'],
] as const;

export function PinEntry({
  title,
  subtitle,
  onBack,
  onComplete,
  onForgot,
  bottomLeftKey,
  greeting: greetingProp,
}: PinEntryProps) {
  const name = useFirstName();
  // Blank while the name loads, so it doesn't flash "Hi there" first.
  const greeting = greetingProp ?? (name === null ? ' ' : name ? `Hi ${name},` : 'Hi there,');
  const styles = useStyles();
  const { c } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const shake = useRef(new Animated.Value(0)).current;

  // Coming back to this screen (e.g. from the retype step) starts fresh.
  useFocusEffect(
    useCallback(() => {
      setPin('');
      setError(null);
      busy.current = false;
    }, []),
  );

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence(
      [12, -12, 9, -9, 5, -5, 0].map(toValue =>
        Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true }),
      ),
    ).start();
  };

  const submit = async (value: string) => {
    busy.current = true;
    // Let the last slot render as filled before validating.
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    const message = await onComplete(value);
    if (message) {
      Vibration.vibrate(200);
      runShake();
      setError(message);
      setPin('');
      busy.current = false;
    }
  };

  const pressDigit = (digit: string) => {
    if (busy.current || pin.length >= PIN_LENGTH) {
      return;
    }
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === PIN_LENGTH) {
      submit(next);
    }
  };

  const pressDelete = () => {
    if (!busy.current) {
      setPin(p => p.slice(0, -1));
    }
  };

  const clearAll = () => {
    if (!busy.current) {
      setPin('');
    }
  };

  return (
    <Screen>
      <Header title={title} onBack={onBack} />

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <AccountIcon size={28} color={c.ink} />
        </View>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text
          style={[styles.subtitle, error && styles.error]}
          accessibilityLiveRegion="polite">
          {error ?? subtitle}
        </Text>
      </View>

      <Animated.View
        style={[styles.slots, { transform: [{ translateX: shake }] }]}
        accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const filled = i < pin.length;
          return (
            <View key={i} style={[styles.dot, filled && styles.dotFilled, error && styles.dotError]} />
          );
        })}
      </Animated.View>

      <View style={styles.keypad}>
        {KEYS.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map(key => {
              if (key === 'left') {
                return (
                  <View key={key} style={[styles.key, !bottomLeftKey && styles.keyBlank]}>
                    {bottomLeftKey}
                  </View>
                );
              }
              const isDelete = key === 'delete';
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={isDelete ? 'Delete digit' : key}
                  onPress={isDelete ? pressDelete : () => pressDigit(key)}
                  onLongPress={isDelete ? clearAll : undefined}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                  {isDelete ? <BackspaceIcon /> : <Text style={styles.digit}>{key}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <TextButton label="Forgot PIN?" onPress={onForgot} color={c.inkMuted} style={styles.forgot} />
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  identity: { alignItems: 'center', paddingTop: space[6], paddingHorizontal: space[5] },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[4],
  },
  greeting: { ...type.title, color: c.ink, marginBottom: space[2] },
  subtitle: { ...type.body, color: c.inkMuted, textAlign: 'center' },
  error: { color: c.ink },
  slots: { flexDirection: 'row', justifyContent: 'center', gap: space[4], marginTop: space[6], marginBottom: space[6] },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.surfaceSunken },
  dotFilled: { backgroundColor: c.ink },
  dotError: { backgroundColor: c.info },
  keypad: { flex: 1, maxHeight: 420, paddingHorizontal: space[8], justifyContent: 'space-evenly' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  // Circular charcoal keys (docs/DESIGN.md button-icon-circular, sized for thumbs).
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBlank: { backgroundColor: 'transparent' },
  keyPressed: { backgroundColor: c.surfaceSunken, transform: [{ scale: 0.96 }] },
  digit: { fontFamily: fontFamily.display, fontSize: 28, letterSpacing: -0.6, color: c.ink, fontVariant: ['tabular-nums'] },
  forgot: { marginVertical: space[3] },
}));
