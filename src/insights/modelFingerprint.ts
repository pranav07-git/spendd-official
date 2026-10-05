import type { AiSettings, ModelFingerprint } from '../storage/appState';

/** Size and modified time of the downloaded file, from the native status JSON. */
export function fingerprintOf(status: { downloadedBytes: number; modifiedAt?: number }): ModelFingerprint | null {
  const { downloadedBytes: size, modifiedAt } = status;
  return size > 0 && typeof modifiedAt === 'number' && modifiedAt > 0 ? { size, modifiedAt } : null;
}

/**
 * True when the file on disk is the one whose checksum was verified. A replaced or modified
 * file (or one verified before fingerprints existed) is hashed again before it is loaded.
 */
export function isStillVerified(settings: AiSettings, current: ModelFingerprint | null): boolean {
  const saved = settings.fingerprint;
  return (
    settings.verified &&
    saved != null &&
    current != null &&
    saved.size === current.size &&
    saved.modifiedAt === current.modifiedAt
  );
}
