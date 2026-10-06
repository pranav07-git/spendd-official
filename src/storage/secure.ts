import * as Keychain from 'react-native-keychain';

const PIN_SERVICE = 'com.spendd.pin';
const BIOMETRIC_SERVICE = 'com.spendd.biometric';
const GUARD_SERVICE = 'com.spendd.pinGuard';
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
  return credentials !== false && credentials.password === pin;
}

/** Wrong PINs allowed before the first lockout. */
export const FREE_ATTEMPTS = 5;
/** Each wrong PIN past the free ones locks for longer; the last step repeats. */
const LOCKOUTS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

type Guard = { failed: number; lockedUntil: number };

// Kept in the keystore, not memory, so killing the app doesn't reset the count.
async function readGuard(): Promise<Guard> {
  const saved = await Keychain.getGenericPassword({ service: GUARD_SERVICE });
  if (!saved) {
    return { failed: 0, lockedUntil: 0 };
  }
  try {
    const guard = JSON.parse(saved.password) as Guard;
    return { failed: Number(guard.failed) || 0, lockedUntil: Number(guard.lockedUntil) || 0 };
  } catch {
    return { failed: FREE_ATTEMPTS, lockedUntil: 0 }; // tampered or corrupt: no free attempts
  }
}

async function writeGuard(guard: Guard): Promise<void> {
  await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(guard), {
    service: GUARD_SERVICE,
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
}

export type PinCheck =
  | { ok: true }
  /** `lockedForMs` > 0: no PIN is checked until then. */
  | { ok: false; attemptsLeft: number; lockedForMs: number };

/**
 * Checks a PIN against the stored one, with a lockout that survives restarts and grows with every
 * wrong PIN past the first five (30 s, 1 min, 5 min, 15 min, then an hour each).
 */
export async function checkPin(pin: string, now: number = Date.now()): Promise<PinCheck> {
  const guard = await readGuard();
  if (now < guard.lockedUntil) {
    return { ok: false, attemptsLeft: 0, lockedForMs: guard.lockedUntil - now };
  }
  if (await verifyPin(pin)) {
    if (guard.failed > 0 || guard.lockedUntil > 0) {
      await resetPinGuard();
    }
    return { ok: true };
  }
  const failed = guard.failed + 1;
  const over = failed - FREE_ATTEMPTS;
  const lockedForMs = over >= 0 ? LOCKOUTS_MS[Math.min(over, LOCKOUTS_MS.length - 1)] : 0;
  await writeGuard({ failed, lockedUntil: lockedForMs ? now + lockedForMs : 0 });
  return { ok: false, attemptsLeft: Math.max(0, FREE_ATTEMPTS - failed), lockedForMs };
}

/** After a successful unlock by other means (biometrics). */
export async function resetPinGuard(): Promise<void> {
  await Keychain.resetGenericPassword({ service: GUARD_SERVICE });
}

/** "Try again in 5 min" / "in 30s". */
export function formatLockout(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`;
}

/** The message PinEntry shows for a failed check. */
export function pinCheckMessage(result: Extract<PinCheck, { ok: false }>, wrong = 'Incorrect PIN.'): string {
  if (result.lockedForMs > 0) {
    return `Too many attempts. Try again in ${formatLockout(result.lockedForMs)}.`;
  }
  const left = result.attemptsLeft;
  return `${wrong} ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
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
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
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
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      authenticationPrompt: biometricPrompt,
    });
    if (credentials === false) {
      return false;
    }
    await resetPinGuard().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function clearSecureData(): Promise<void> {
  await Promise.all([
    Keychain.resetGenericPassword({ service: PIN_SERVICE }),
    Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE }),
    Keychain.resetGenericPassword({ service: GUARD_SERVICE }),
  ]);
}
