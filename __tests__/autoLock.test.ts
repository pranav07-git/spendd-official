import { RELOCK_AFTER_MS, shouldRelock } from '../src/storage/autoLock';

it('locks after 30 s in the background on an unlocked screen', () => {
  expect(shouldRelock(0, RELOCK_AFTER_MS, 'Home')).toBe(true);
  expect(shouldRelock(0, RELOCK_AFTER_MS - 1, 'Home')).toBe(false);
  expect(shouldRelock(0, 5 * 60_000, 'TransactionDetails')).toBe(true);
});

it('never locks during setup, on the unlock screen, or without a background trip', () => {
  for (const route of ['Intro', 'Statement', 'Consent', 'CreatePin', 'ConfirmPin', 'Biometric', 'Unlock'] as const) {
    expect(shouldRelock(0, 10 * 60_000, route)).toBe(false);
  }
  expect(shouldRelock(null, 10 * 60_000, 'Home')).toBe(false);
  expect(shouldRelock(0, 10 * 60_000, undefined)).toBe(false);
});

it('treats a clock moved backwards as time away', () => {
  expect(shouldRelock(100_000, 50_000, 'Home')).toBe(true);
});
