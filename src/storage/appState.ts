import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_NAME } from '../config';
import type { Insight } from '../insights/types';
import type { Budget } from '../transactions/budget';

const KEYS = {
  setupComplete: 'spendd.setupComplete',
  consent: 'spendd.consent',
  // Left by the removed bank statement feature; only listed so a reset clears it.
  statement: 'spendd.statement',
  budget: 'spendd.budget',
  profile: 'spendd.profile',
  // The old Spendd AI on/off switch; Spendd AI is always on now. Listed so a reset clears it.
  cloudAi: 'spendd.cloudAi',
  cloudInsights: 'spendd.cloudInsights',
  // Left by the old on-device model; only listed so a reset clears them.
  legacyAi: 'spendd.ai',
  legacyAiInsights: 'spendd.aiInsights',
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

/** The last AI-written insights and money stories, keyed by a hash of the facts behind them. */
export type AiInsightsCache = { hash: string; insights: Insight[]; stories: string[]; generatedAt: number };

export async function getAiInsightsCache(): Promise<AiInsightsCache | null> {
  const raw = await AsyncStorage.getItem(KEYS.cloudInsights);
  return raw ? (JSON.parse(raw) as AiInsightsCache) : null;
}

export async function saveAiInsightsCache(cache: AiInsightsCache): Promise<void> {
  await AsyncStorage.setItem(KEYS.cloudInsights, JSON.stringify(cache));
}

export async function clearAppState(): Promise<void> {
  await AsyncStorage.removeMany(Object.values(KEYS));
}
