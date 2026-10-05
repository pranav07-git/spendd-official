/** Wrong PINs allowed before the first lock. */
export const MAX_ATTEMPTS = 5;
const FIRST_LOCK_MS = 30_000;
const MAX_LOCK_MS = 60 * 60_000;

export type LockoutState = {
  /** Wrong PINs since the last correct one. */
  failures: number;
  /** Epoch ms until which no PIN is checked; 0 when not locked. */
  lockedUntil: number;
};

export const NO_LOCKOUT: LockoutState = { failures: 0, lockedUntil: 0 };

export type PinAttempt =
  | { ok: true }
  | { ok: false; lockedForMs: number }
  | { ok: false; attemptsLeft: number };

/** 30 s at the fifth wrong PIN, doubling with each one after, capped at an hour. */
export function lockDurationMs(failures: number): number {
  if (failures < MAX_ATTEMPTS) {
    return 0;
  }
  return Math.min(FIRST_LOCK_MS * 2 ** (failures - MAX_ATTEMPTS), MAX_LOCK_MS);
}

export function parseLockout(raw: string | null | undefined): LockoutState {
  if (!raw) {
    return NO_LOCKOUT;
  }
  try {
    const value = JSON.parse(raw) as Partial<LockoutState>;
    const failures = Number.isInteger(value.failures) && value.failures! > 0 ? value.failures! : 0;
    const lockedUntil = typeof value.lockedUntil === 'number' && value.lockedUntil > 0 ? value.lockedUntil : 0;
    return { failures, lockedUntil };
  } catch {
    return NO_LOCKOUT;
  }
}

export type LockoutStore = {
  load: () => Promise<LockoutState>;
  save: (state: LockoutState) => Promise<void>;
};

/**
 * Checks a PIN under a lockout that survives app restarts. The attempt is counted and saved
 * before the PIN is checked, so force-closing the app mid-check doesn't give a free try.
 */
export async function attemptPin(
  pin: string,
  verify: (pin: string) => Promise<boolean>,
  store: LockoutStore,
  now: () => number = Date.now,
): Promise<PinAttempt> {
  const state = await store.load();
  const start = now();
  if (start < state.lockedUntil) {
    return { ok: false, lockedForMs: state.lockedUntil - start };
  }
  const failures = state.failures + 1;
  await store.save({ failures, lockedUntil: state.lockedUntil });
  if (await verify(pin)) {
    await store.save(NO_LOCKOUT);
    return { ok: true };
  }
  const lockMs = lockDurationMs(failures);
  if (lockMs > 0) {
    await store.save({ failures, lockedUntil: now() + lockMs });
    return { ok: false, lockedForMs: lockMs };
  }
  return { ok: false, attemptsLeft: MAX_ATTEMPTS - failures };
}

/** The message PinEntry shows for a rejected attempt. */
export function attemptMessage(result: Exclude<PinAttempt, { ok: true }>): string {
  if ('lockedForMs' in result) {
    return `Too many attempts. Try again in ${Math.ceil(result.lockedForMs / 1000)}s.`;
  }
  const left = result.attemptsLeft;
  return `Incorrect PIN. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
}

/** Compares in time independent of where the strings first differ. */
/* eslint-disable no-bitwise -- XOR/OR accumulate the difference without an early exit. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
/* eslint-enable no-bitwise */
