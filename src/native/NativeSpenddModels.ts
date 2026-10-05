import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Implemented in android/app/src/main/java/com/spendd/ai/SpenddModelsModule.kt
export interface Spec extends TurboModule {
  /** Queues a download with Android's DownloadManager (resumable, shows a notification). */
  startDownload(url: string, fileName: string, title: string): Promise<void>;
  /**
   * JSON: { state: 'none' | 'downloading' | 'paused' | 'ready' | 'failed',
   *         downloadedBytes: number, totalBytes: number, path: string | null, reason?: string }
   */
  status(fileName: string): Promise<string>;
  cancelDownload(fileName: string): Promise<void>;
  deleteModel(fileName: string): Promise<void>;
  /** Hashes the downloaded file off the UI thread; resolves true if it matches. */
  verify(fileName: string, sha256: string): Promise<boolean>;
  /** Physical RAM, to warn on phones too small to run a model. */
  totalMemoryBytes(): Promise<number>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SpenddModels');
