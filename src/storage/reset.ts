import { clearTransactions } from '../transactions/store';
import { clearAppState } from './appState';
import { clearCategoryMemory } from './categoryMemory';
import { clearSecureData } from './secure';

/** Removes the PIN, biometric unlock, transactions, learned categories and all saved settings from this phone. */
export const wipeAllData = () => Promise.all([clearSecureData(), clearAppState(), clearTransactions(), clearCategoryMemory()]);
