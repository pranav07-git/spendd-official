import { addDays, startOfDay } from './format';
import type { Transaction } from './types';

export type CategorySpend = {
  category: string;
  amount: number;
  count: number;
  /** Fraction (0–1) of the period's total spend. */
  share: number;
  /** Newest first. */
  transactions: Transaction[];
};

export type SpendSummary = { total: number; count: number; categories: CategorySpend[] };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Money out with a known amount in [from, to), grouped by category, biggest first. */
export function summarizeSpending(transactions: Transaction[], from: number, to: number): SpendSummary {
  const spends = transactions.filter(
    tx => tx.direction === 'debit' && tx.amount != null && tx.occurredAt >= from && tx.occurredAt < to,
  );
  const byCategory = new Map<string, Transaction[]>();
  spends.forEach(tx => byCategory.set(tx.category, [...(byCategory.get(tx.category) ?? []), tx]));

  const total = round2(spends.reduce((sum, tx) => sum + tx.amount!, 0));
  const categories = [...byCategory.entries()]
    .map(([category, txs]) => {
      const amount = round2(txs.reduce((sum, tx) => sum + tx.amount!, 0));
      return {
        category,
        amount,
        count: txs.length,
        share: total > 0 ? amount / total : 0,
        transactions: txs.sort((a, b) => b.occurredAt - a.occurredAt),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { total, count: spends.length, categories };
}

export function todaysSpending(transactions: Transaction[], now: number = Date.now()): SpendSummary {
  const today = startOfDay(now);
  return summarizeSpending(transactions, today, addDays(today, 1));
}

/** Average spend per day over the `days` full days before today. */
export function dailyAverage(transactions: Transaction[], days = 7, now: number = Date.now()): number {
  const today = startOfDay(now);
  return summarizeSpending(transactions, addDays(today, -days), today).total / days;
}

export const paymentCount = (n: number) => `${n} payment${n === 1 ? '' : 's'}`;
