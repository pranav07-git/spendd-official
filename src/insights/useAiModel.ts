import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NativeSpenddModels from '../native/NativeSpenddModels';
import { DEFAULT_AI_SETTINGS, getAiSettings, saveAiSettings, type AiSettings } from '../storage/appState';
import { AI_MODEL } from './aiPrompt';
import { fingerprintOf, isStillVerified } from './modelFingerprint';

export type AiModelPhase = 'checking' | 'none' | 'downloading' | 'paused' | 'verifying' | 'ready' | 'failed';

export type AiModel = {
  phase: AiModelPhase;
  downloadedBytes: number;
  totalBytes: number;
  /** Absolute path once downloaded and verified. */
  path: string | null;
  enabled: boolean;
  reason: string | null;
  /** Physical RAM, or null until known. */
  memoryBytes: number | null;
  download: () => Promise<void>;
  cancel: () => Promise<void>;
  remove: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

type NativeStatus = {
  state: 'none' | 'downloading' | 'paused' | 'ready' | 'failed';
  downloadedBytes: number;
  totalBytes: number;
  path: string | null;
  /** Epoch ms the ready file was last modified. */
  modifiedAt?: number;
  reason?: string;
};

// Shared across hook instances so the 491 MB checksum runs once per file, not once per caller.
let verifying: Promise<boolean> | null = null;
const verifyOnce = () => {
  verifying ??= NativeSpenddModels.verify(AI_MODEL.fileName, AI_MODEL.sha256).finally(() => {
    verifying = null;
  });
  return verifying;
};

/** Download state and on/off switch for the on-device AI model. Polls while a download runs. */
export function useAiModel(): AiModel {
  const [status, setStatus] = useState<Omit<AiModel, 'download' | 'cancel' | 'remove' | 'setEnabled' | 'memoryBytes' | 'enabled'>>({
    phase: 'checking',
    downloadedBytes: 0,
    totalBytes: AI_MODEL.bytes,
    path: null,
    reason: null,
  });
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [memoryBytes, setMemoryBytes] = useState<number | null>(null);
  const settingsRef = useRef(settings);

  const updateSettings = useCallback(async (next: AiSettings) => {
    settingsRef.current = next;
    setSettings(next);
    await saveAiSettings(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = JSON.parse(await NativeSpenddModels.status(AI_MODEL.fileName)) as NativeStatus;
      const base = { downloadedBytes: s.downloadedBytes, totalBytes: s.totalBytes || AI_MODEL.bytes, reason: s.reason ?? null };
      if (s.state === 'ready') {
        const fingerprint = fingerprintOf(s);
        if (!isStillVerified(settingsRef.current, fingerprint)) {
          const wasVerified = settingsRef.current.verified;
          setStatus({ ...base, phase: 'verifying', path: null });
          if (!(await verifyOnce())) {
            await NativeSpenddModels.deleteModel(AI_MODEL.fileName);
            await updateSettings({ ...settingsRef.current, verified: false, fingerprint: null });
            setStatus({ ...base, phase: 'failed', path: null, reason: 'The download was damaged. Try again.' });
            return;
          }
          // A re-check of an already verified model keeps the user's on/off choice.
          await updateSettings({ enabled: wasVerified ? settingsRef.current.enabled : true, verified: true, fingerprint });
        }
        setStatus({ ...base, phase: 'ready', path: s.path });
        return;
      }
      if (s.state === 'none' && settingsRef.current.verified) {
        await updateSettings(DEFAULT_AI_SETTINGS); // model was deleted
      }
      setStatus({ ...base, phase: s.state, path: null });
    } catch {
      setStatus(prev => ({ ...prev, phase: 'failed', path: null, reason: 'Couldn’t check the AI model.' }));
    }
  }, [updateSettings]);

  useEffect(() => {
    getAiSettings()
      .catch(() => DEFAULT_AI_SETTINGS)
      .then(saved => {
        settingsRef.current = saved;
        setSettings(saved);
        refresh();
      });
    NativeSpenddModels.totalMemoryBytes().then(setMemoryBytes, () => setMemoryBytes(null));
    const sub = AppState.addEventListener('change', state => state === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const busy = status.phase === 'downloading' || status.phase === 'paused';
  useEffect(() => {
    if (!busy) {
      return;
    }
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  const download = useCallback(async () => {
    await updateSettings({ enabled: true, verified: false, fingerprint: null });
    await NativeSpenddModels.startDownload(AI_MODEL.url, AI_MODEL.fileName, `Spendd AI (${AI_MODEL.name})`);
    await refresh();
  }, [refresh, updateSettings]);

  const cancel = useCallback(async () => {
    await NativeSpenddModels.cancelDownload(AI_MODEL.fileName);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async () => {
    await NativeSpenddModels.deleteModel(AI_MODEL.fileName);
    await updateSettings(DEFAULT_AI_SETTINGS);
    await refresh();
  }, [refresh, updateSettings]);

  const setEnabled = useCallback(
    (enabled: boolean) => updateSettings({ ...settingsRef.current, enabled }),
    [updateSettings],
  );

  return { ...status, enabled: settings.enabled, memoryBytes, download, cancel, remove, setEnabled };
}
