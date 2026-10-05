import * as Keychain from 'react-native-keychain';

const PIN_SERVICE = 'com.spendd.pin';
const BIOMETRIC_SERVICE = 'com.spendd.biometric';
const ACCOUNT = 'spendd';

const biometricPrompt: Keychain.AuthenticationPrompt = {
  title: 'Unlock Spendd',
  subtitle: 'Confirm it’s you',
  cancel: 'Use PIN',
};

/** Stores the PIN in the Android Keystore-backed keychain (no biometric gate). */
export async function savePin(pin: string): Promise<void> {
  const result = await Keychain.setGenericPassword(ACCOUNT, pin, {
    service: PIN_SERVICE,
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  if (!result) {
    throw new Error('Could not save PIN');
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const credentials = await Keychain.getGenericPassword({ service: PIN_SERVICE });
  return credentials !== false && credentials.password === pin;
}

export async function hasPin(): Promise<boolean> {
  return Keychain.hasGenericPassword({ service: PIN_SERVICE });
}

/** Returns null when the device has no enrolled strong biometric. */
export async function getBiometryType(): Promise<Keychain.BIOMETRY_TYPE | null> {
  return Keychain.getSupportedBiometryType();
}

/**
 * Creates a biometric-bound Keystore entry. Android shows the system biometric
 * prompt while writing it, so a resolved promise means the user authenticated.
 * Rejects if the user cancels or authentication fails.
 */
export async function enableBiometrics(): Promise<void> {
  const result = await Keychain.setGenericPassword(ACCOUNT, 'biometric-unlock', {
    service: BIOMETRIC_SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    authenticationPrompt: { ...biometricPrompt, title: 'Enable biometrics' },
  });
  if (!result) {
    throw new Error('Could not enable biometrics');
  }
}

export async function disableBiometrics(): Promise<void> {
  await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE });
}

export async function isBiometricsEnabled(): Promise<boolean> {
  return Keychain.hasGenericPassword({ service: BIOMETRIC_SERVICE });
}

/** Shows the biometric prompt; resolves true only on successful authentication. */
export async function unlockWithBiometrics(): Promise<boolean> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: BIOMETRIC_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      authenticationPrompt: biometricPrompt,
    });
    return credentials !== false;
  } catch {
    return false;
  }
}

export async function clearSecureData(): Promise<void> {
  await Promise.all([
    Keychain.resetGenericPassword({ service: PIN_SERVICE }),
    Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE }),
  ]);
}
