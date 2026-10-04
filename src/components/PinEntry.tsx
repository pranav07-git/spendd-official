import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from './Header';
import { AccountIcon, BackspaceIcon } from './Icons';
import { Screen } from './Screen';
import { TextButton } from './Buttons';
import { PIN_LENGTH, USER_NAME } from '../config';
import { colors, fonts } from '../theme';

type PinEntryProps = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  /** Return an error message to reject the PIN (input shakes and clears), or null to accept. */
  onComplete: (pin: string) => Promise<string | null> | string | null;
  onForgot: () => void;
  /** Optional content for the otherwise empty bottom-left key (e.g. biometric unlock). */
  bottomLeftKey?: ReactNode;
  greeting?: string;
};

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
  greeting = `Hi ${USER_NAME},`,
}: PinEntryProps) {
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
          <AccountIcon size={26} />
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
            <View key={i} style={styles.slot}>
              <View style={[styles.dot, filled && styles.dotFilled]} />
              <View style={[styles.line, filled && styles.lineFilled, error && styles.lineError]} />
            </View>
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
                  android_ripple={{ color: '#1E1E1E' }}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                  {isDelete ? <BackspaceIcon /> : <Text style={styles.digit}>{key}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <TextButton label="FORGOT PIN?" onPress={onForgot} color="#7A7A7A" style={styles.forgot} />
    </Screen>
  );
}

const KEY_BORDER = '#262626';

const styles = StyleSheet.create({
  identity: { alignItems: 'center', paddingTop: 32 },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: '#2C2C2C',
    borderWidth: 1,
    borderColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  greeting: { fontFamily: fonts.sans, fontSize: 16, color: colors.text, marginBottom: 6 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  error: { color: colors.danger },
  slots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 28,
    marginBottom: 32,
  },
  slot: { width: 48, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 10, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: colors.text },
  line: { alignSelf: 'stretch', height: 2, backgroundColor: '#3A3A3A' },
  lineFilled: { backgroundColor: colors.text },
  lineError: { backgroundColor: colors.danger },
  keypad: { flex: 1, maxHeight: 520 },
  row: { flex: 1, flexDirection: 'row' },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: KEY_BORDER,
  },
  keyBlank: { borderWidth: 0 },
  keyPressed: { backgroundColor: '#141414' },
  digit: { fontFamily: fonts.serif, fontSize: 24, color: colors.text },
  forgot: { marginVertical: 6 },
});
