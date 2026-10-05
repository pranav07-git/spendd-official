import AsyncStorage from '@react-native-async-storage/async-storage';
import { payeeKeys } from '../transactions/merchants';
import type { Transaction } from '../transactions/types';

const KEY = 'spendd.categoryMemory';

export type Remembered = { category: string; source: 'user' | 'ai'; at: number };
/** Payee key (see payeeKeys) → the category to use for that payee from now on. */
export type CategoryMemory = Record<string, Remembered>;

export async function getCategoryMemory(): Promise<CategoryMemory> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as CategoryMemory) : {};
}

/**
 * Remembers a category for every key of this payee. A user's choice always wins over Spendd AI's,
 * and an AI answer never overwrites one the user made.
 */
export async function rememberCategory(
  tx: Pick<Transaction, 'direction' | 'counterparty' | 'handle'>,
  category: string,
  source: Remembered['source'],
): Promise<void> {
  const keys = payeeKeys(tx);
  if (keys.length === 0) {
    return;
  }
  const memory = await getCategoryMemory();
  const at = Date.now();
  keys.forEach(key => {
    if (source === 'user' || memory[key]?.source !== 'user') {
      memory[key] = { category, source, at };
    }
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

export async function clearCategoryMemory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
