import { AI_MODEL } from '../insights/aiPrompt';
import NativeSpenddModels from '../native/NativeSpenddModels';
import { clearTransactions } from '../transactions/store';
import { clearAppState } from './appState';
import { clearSecureData } from './secure';

/** Removes the PIN, biometric unlock, transactions, AI model and all saved settings from this phone. */
export const wipeAllData = () =>
  Promise.all([
    clearSecureData(),
    clearAppState(),
    clearTransactions(),
    NativeSpenddModels.cancelDownload(AI_MODEL.fileName).then(() => NativeSpenddModels.deleteModel(AI_MODEL.fileName)),
  ]);
