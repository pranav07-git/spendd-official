import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_NAME } from '../config';
import type { Insight } from '../insights/types';
import type { Budget } from '../transactions/budget';

const KEYS = {
  setupComplete: 'spendd.setupComplete',
  consent: 'spendd.consent',
  statement: 'spendd.statement',
  budget: 'spendd.budget',
  profile: 'spendd.profile',
  ai: 'spendd.ai',
  aiInsights: 'spendd.aiInsights',
};

export type ImportedStatement = {
  name: string;
  size: number | null;
  type: string | null;
  localUri: string;
  importedAt: string;
};

export async function isSetupComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.setupComplete)) === 'true';
}

export async function markSetupComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.setupComplete, 'true');
}

export async function saveConsent(): Promise<void> {
  await AsyncStorage.setItem(
    KEYS.consent,
    JSON.stringify({ acceptedAt: new Date().toISOString() }),
  );
}

export async function saveStatement(statement: ImportedStatement): Promise<void> {
  await AsyncStorage.setItem(KEYS.statement, JSON.stringify(statement));
}

export async function getStatement(): Promise<ImportedStatement | null> {
  const raw = await AsyncStorage.getItem(KEYS.statement);
  return raw ? (JSON.parse(raw) as ImportedStatement) : null;
}

export async function getBudget(): Promise<Budget | null> {
  const raw = await AsyncStorage.getItem(KEYS.budget);
  return raw ? (JSON.parse(raw) as Budget) : null;
}

export async function saveBudget(budget: Budget): Promise<void> {
  await AsyncStorage.setItem(KEYS.budget, JSON.stringify(budget));
}

export async function removeBudget(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.budget);
}

export type Profile = {
  name: string;
  /** An emoji, or null to show the name's initial. */
  avatar: string | null;
};

export const DEFAULT_PROFILE: Profile = { name: USER_NAME, avatar: null };

export async function getProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(KEYS.profile);
  return raw ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : DEFAULT_PROFILE;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

export type AiSettings = {
  /** The user wants AI-written insights (only matters once the model is downloaded). */
  enabled: boolean;
  /** The downloaded model's checksum has been verified. */
  verified: boolean;
};

export async function getAiSettings(): Promise<AiSettings> {
  const raw = await AsyncStorage.getItem(KEYS.ai);
  return raw ? (JSON.parse(raw) as AiSettings) : { enabled: false, verified: false };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.ai, JSON.stringify(settings));
}

/** The last AI-written insights, keyed by a hash of the facts they were written from. */
export type AiInsightsCache = { hash: string; insights: Insight[]; generatedAt: number };

export async function getAiInsightsCache(): Promise<AiInsightsCache | null> {
  const raw = await AsyncStorage.getItem(KEYS.aiInsights);
  return raw ? (JSON.parse(raw) as AiInsightsCache) : null;
}

export async function saveAiInsightsCache(cache: AiInsightsCache): Promise<void> {
  await AsyncStorage.setItem(KEYS.aiInsights, JSON.stringify(cache));
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.removeMany(Object.values(KEYS));
}
