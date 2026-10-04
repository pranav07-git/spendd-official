import NativeSpenddTransactions from '../native/NativeSpenddTransactions';
import type { Transaction } from './types';

export async function listTransactions(): Promise<Transaction[]> {
  const raw = await NativeSpenddTransactions.list();
  return JSON.parse(raw) as Transaction[];
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction | null> {
  const raw = await NativeSpenddTransactions.update(id, JSON.stringify(patch));
  return raw ? (JSON.parse(raw) as Transaction) : null;
}

export const removeTransaction = (id: string) => NativeSpenddTransactions.remove(id);

export const clearTransactions = () => NativeSpenddTransactions.clear();

/** Same background pipeline as sharing from another app. */
export const importScreenshot = (uri: string) => NativeSpenddTransactions.importScreenshot(uri);
