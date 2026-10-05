import type { CategoryMemory } from '../storage/categoryMemory';
import { merchantQuery, payeeKeys, type MerchantQuery } from './merchants';
import { UNCLEAR } from './stories';
import type { Transaction } from './types';

/** Merchants per request; anything left over goes in the next run. */
const BATCH = 20;
/** A payee Spendd AI couldn't place is asked about again after this long. */
const RECHECK_MS = 30 * 24 * 60 * 60_000;

export type Plan = {
  /** Payments to re-file from the user's (or Spendd AI's) earlier answer for the same payee. */
  fromMemory: { tx: Transaction; category: string }[];
  /** New merchants to ask Spendd AI about, and the payments waiting on each answer. */
  toAsk: { query: MerchantQuery; txs: Transaction[] }[];
};

/** Was the category chosen by someone, rather than the keyword rules' best guess? */
const settled = (tx: Transaction) =>
  tx.manual || tx.categoryConfirmed || tx.categorySource === 'user' || tx.categorySource === 'memory' || tx.categorySource === 'ai';

/**
 * Decides, for each payment, the cheapest way to categorise it: the user's earlier choice for that
 * payee (on the phone), then Spendd AI for merchants never seen before. People are left alone; the
 * story asks the user what those payments were for.
 */
export function planCategorization(transactions: Transaction[], memory: CategoryMemory, now: number = Date.now()): Plan {
  const plan: Plan = { fromMemory: [], toAsk: [] };
  const asking = new Map<string, { query: MerchantQuery; txs: Transaction[] }>();

  for (const tx of transactions) {
    if (settled(tx)) {
      continue;
    }
    const remembered = payeeKeys(tx).map(key => memory[key]).find(Boolean);
    if (remembered) {
      if (remembered.category !== tx.category) {
        plan.fromMemory.push({ tx, category: remembered.category });
      }
      continue;
    }
    // Only guesses the keyword rules couldn't make, and only money out (income has its own categories).
    if (tx.direction !== 'debit' || !UNCLEAR.includes(tx.category)) {
      continue;
    }
    if (tx.categoryCheckedAt && now - tx.categoryCheckedAt < RECHECK_MS) {
      continue;
    }
    const query = merchantQuery(tx);
    if (!query) {
      continue;
    }
    const entry = asking.get(query.key) ?? { query, txs: [] };
    entry.txs.push(tx);
    asking.set(query.key, entry);
  }
  plan.toAsk = [...asking.values()].slice(0, BATCH);
  return plan;
}
