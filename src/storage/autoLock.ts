import type { RootStackParamList } from '../navigation/types';

/** How long the app may sit in the background before the PIN is asked again. */
export const RELOCK_AFTER_MS = 30_000;

/** Screens that are reachable without unlocking, so returning to them never locks. */
const UNLOCKED_ROUTES: ReadonlySet<keyof RootStackParamList> = new Set([
  'Intro',
  'Statement',
  'Consent',
  'CreatePin',
  'ConfirmPin',
  'Biometric',
  'Unlock',
]);

export function shouldRelock(
  backgroundedAt: number | null,
  now: number,
  route: keyof RootStackParamList | undefined,
): boolean {
  if (backgroundedAt == null || route == null || UNLOCKED_ROUTES.has(route)) {
    return false;
  }
  // A clock set backwards counts as "long enough": locking is the safe side.
  const away = now - backgroundedAt;
  return away < 0 || away >= RELOCK_AFTER_MS;
}
