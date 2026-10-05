import NativeSpenddTransactions from '../native/NativeSpenddTransactions';
import { rememberCategory } from '../storage/categoryMemory';
import type { Transaction } from './types';

export async function listTransactions(): Promise<Transaction[]> {
  const raw = await NativeSpenddTransactions.list();
  return JSON.parse(raw) as Transaction[];
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

/** Logs a manually entered transaction; the id and createdAt are assigned natively. */
export async function addTransaction(tx: NewTransaction): Promise<Transaction> {
  const raw = await NativeSpenddTransactions.add(JSON.stringify({ ...tx, categorySource: 'user' }));
  const added = JSON.parse(raw) as Transaction;
  // The category was picked by hand, so future payments to this payee get it too.
  await rememberCategory(added, added.category, 'user').catch(() => {});
  return added;
}

/** A change made by the user. A new category is learned for every future payment to this payee. */
export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction | null> {
  const learn = patch.category !== undefined;
  const updated = await applyCategory(id, learn ? { ...patch, categorySource: 'user' } : patch);
  if (learn && updated) {
    await rememberCategory(updated, updated.category, 'user').catch(() => {});
  }
  return updated;
}

/** Writes a change without learning from it (used by the automatic categoriser). */
export async function applyCategory(id: string, patch: Partial<Transaction>): Promise<Transaction | null> {
  const raw = await NativeSpenddTransactions.update(id, JSON.stringify(patch));
  return raw ? (JSON.parse(raw) as Transaction) : null;
}

export const removeTransaction = (id: string) => NativeSpenddTransactions.remove(id);

export const clearTransactions = () => NativeSpenddTransactions.clear();

/** Same background pipeline as sharing from another app. */
export const importScreenshot = (uri: string) => NativeSpenddTransactions.importScreenshot(uri);
