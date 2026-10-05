import * as Keychain from 'react-native-keychain';
import {
  attemptPin,
  constantTimeEqual,
  parseLockout,
  type LockoutStore,
  type PinAttempt,
} from './pinLockout';

const PIN_SERVICE = 'com.spendd.pin';
const BIOMETRIC_SERVICE = 'com.spendd.biometric';
const LOCKOUT_SERVICE = 'com.spendd.pinLockout';
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

async function verifyPin(pin: string): Promise<boolean> {
  const credentials = await Keychain.getGenericPassword({ service: PIN_SERVICE });
  return credentials !== false && constantTimeEqual(credentials.password, pin);
}

/** Kept in the keychain so force-closing the app doesn't reset the count. */
const lockoutStore: LockoutStore = {
  load: async () => {
    const saved = await Keychain.getGenericPassword({ service: LOCKOUT_SERVICE });
    return parseLockout(saved === false ? null : saved.password);
  },
  save: async state => {
    const result = await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(state), {
      service: LOCKOUT_SERVICE,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
    if (!result) {
      throw new Error('Could not save PIN attempts');
    }
  },
};

/** Checks the PIN under the persistent lockout shared by every PIN prompt. */
export const checkPinAttempt = (pin: string): Promise<PinAttempt> => attemptPin(pin, verifyPin, lockoutStore);

export async function hasPin(): Promise<boolean> {
  return Keychain.hasGenericPassword({ service: PIN_SERVICE });
}

/**
 * hasPin(), asked up to [tries] times: one keychain hiccup at startup must not read as
 * "no PIN" and wipe the app. Rejects if every try threw.
 */
export async function hasPinWithRetry(tries = 3, delayMs = 150): Promise<boolean> {
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      if (await hasPin()) {
        return true;
      }
      lastError = undefined;
    } catch (e) {
      lastError = e;
    }
    if (i < tries - 1) {
      await new Promise<void>(resolve => setTimeout(resolve, delayMs));
    }
  }
  if (lastError !== undefined) {
    throw lastError;
  }
  return false;
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
    Keychain.resetGenericPassword({ service: LOCKOUT_SERVICE }),
  ]);
}
