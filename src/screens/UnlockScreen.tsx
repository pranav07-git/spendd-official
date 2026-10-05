import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { PinEntry } from '../components/PinEntry';
import { FingerprintIcon } from '../components/Icons';
import type { ScreenProps } from '../navigation/types';
import { getProfile } from '../storage/appState';
import { wipeAllData } from '../storage/reset';
import { attemptMessage } from '../storage/pinLockout';
import {
  checkPinAttempt,
  isBiometricsEnabled,
  unlockWithBiometrics,
} from '../storage/secure';

export function UnlockScreen({ navigation }: ScreenProps<'Unlock'>) {
  const [biometrics, setBiometrics] = useState(false);
  const [name, setName] = useState<string | null>(null);

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
    const result = await checkPinAttempt(pin);
    if (result.ok) {
      goHome();
      return null;
    }
    return attemptMessage(result);
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
      title="ENTER PIN"
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
            android_ripple={{ color: '#1E1E1E' }}
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
