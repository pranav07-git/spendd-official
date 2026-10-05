import { AI_MODEL } from '../insights/aiPrompt';
import NativeSpenddModels from '../native/NativeSpenddModels';
import { clearTransactions, deleteLocalFile } from '../transactions/store';
import { clearAppState, getStatement } from './appState';
import { clearSecureData } from './secure';

/** Runs every step even if some fail, then rejects with the first failure. */
export async function runAll(steps: Array<() => Promise<unknown>>): Promise<void> {
  const results = await Promise.allSettled(steps.map(step => step()));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) {
    throw failed.reason;
  }
}

/**
 * Removes the PIN, biometric unlock, transactions (and their quarantined copies), queued
 * screenshots and pending logging jobs, the imported statement copy, the AI model and all saved
 * settings from this phone.
 */
export async function wipeAllData(): Promise<void> {
  // Read before the app state that records it is cleared.
  const statement = await getStatement().catch(() => null);
  await runAll([
    clearSecureData,
    clearAppState,
    clearTransactions,
    () => (statement?.localUri ? deleteLocalFile(statement.localUri) : Promise.resolve(false)),
    () => NativeSpenddModels.cancelDownload(AI_MODEL.fileName),
    () => NativeSpenddModels.deleteModel(AI_MODEL.fileName),
  ]);
}
