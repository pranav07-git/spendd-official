import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Implemented in android/app/src/main/java/com/spendd/receipts/SpenddTransactionsModule.kt
export interface Spec extends TurboModule {
  /** JSON array of logged transactions. */
  list(): Promise<string>;
  /** Stores a JSON transaction (without id/createdAt); resolves the stored JSON. */
  add(transactionJson: string): Promise<string>;
  remove(id: string): Promise<boolean>;
  /** Merges a JSON object of fields into a transaction; resolves the updated JSON (or null). */
  update(id: string, patchJson: string): Promise<string | null>;
  /** Deletes the log, its quarantined copies, queued screenshots and pending logging jobs. */
  clear(): Promise<void>;
  /** Deletes a file:// path inside the app's private storage; resolves false if nothing was deleted. */
  deleteLocalFile(uri: string): Promise<boolean>;
  /** Queues a picked image (content:// URI) for the same background logging as a share. */
  importScreenshot(uri: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SpenddTransactions');
