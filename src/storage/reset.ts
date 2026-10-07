import { signOut } from '../auth/session';
import { clearTransactions } from '../transactions/store';
import { clearAppState } from './appState';
import { clearCategoryMemory } from './categoryMemory';
import { clearSecureData } from './secure';

/**
 * Removes the PIN, biometric unlock, transactions, learned categories and all saved settings from
 * this phone, and signs out, so the next sign-in starts setup afresh.
 */
export const wipeAllData = () =>
  Promise.all([
    clearSecureData(),
    clearAppState(),
    clearTransactions(),
    clearCategoryMemory(),
    signOut().catch(() => {}),
  ]);
