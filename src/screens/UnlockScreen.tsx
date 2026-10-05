import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { PinEntry } from '../components/PinEntry';
import { FingerprintIcon } from '../components/Icons';
import type { ScreenProps } from '../navigation/types';
import { useTheme } from '../theme';
import { getProfile } from '../storage/appState';
import { wipeAllData } from '../storage/reset';
import {
  isBiometricsEnabled,
  unlockWithBiometrics,
  verifyPin,
} from '../storage/secure';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export function UnlockScreen({ navigation }: ScreenProps<'Unlock'>) {
  const { c } = useTheme();
  const [biometrics, setBiometrics] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const failedAttempts = useRef(0);
  const lockedUntil = useRef(0);

  const goHome = useCallback(
    () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }),
    [navigation],
  );

  const tryBiometrics = useCallback(async () => {
    if (await unlockWithBiometrics()) {
      goHome();
    }
  }, [goHome]);

  useEffect(() => {
    getProfile()
      .then(profile => setName(profile.name))
      .catch(() => {});
  }, []);

  useEffect(() => {
    isBiometricsEnabled().then(enabled => {
      setBiometrics(enabled);
      if (enabled) {
        tryBiometrics();
      }
    });
  }, [tryBiometrics]);

  const checkPin = async (pin: string) => {
    const now = Date.now();
    if (now < lockedUntil.current) {
      return `Too many attempts. Try again in ${Math.ceil((lockedUntil.current - now) / 1000)}s.`;
    }
    if (await verifyPin(pin)) {
      failedAttempts.current = 0;
      goHome();
      return null;
    }
    failedAttempts.current += 1;
    if (failedAttempts.current >= MAX_ATTEMPTS) {
      failedAttempts.current = 0;
      lockedUntil.current = now + LOCKOUT_MS;
      return 'Too many attempts. Try again in 30s.';
    }
    const left = MAX_ATTEMPTS - failedAttempts.current;
    return `Incorrect PIN. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
  };

  const resetApp = () =>
    Alert.alert(
      'Reset Spendd?',
      'Your PIN can’t be recovered. Resetting removes your PIN, biometric unlock, transactions and imported data from this phone, and you’ll set up Spendd again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await wipeAllData();
            navigation.reset({ index: 0, routes: [{ name: 'Intro' }] });
          },
        },
      ],
    );

  return (
    <PinEntry
      title="Enter PIN"
      subtitle="Enter your 4-digit access PIN"
      greeting={name ? `Hi ${name},` : undefined}
      onComplete={checkPin}
      onForgot={resetApp}
      bottomLeftKey={
        biometrics ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock with biometrics"
            onPress={tryBiometrics}
            android_ripple={{ color: c.surfaceSunken }}
            style={styles.biometricKey}>
            <FingerprintIcon size={28} />
          </Pressable>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  biometricKey: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
