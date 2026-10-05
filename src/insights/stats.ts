import { daysBetween, startOfDay } from '../transactions/format';
import type { Transaction } from '../transactions/types';

/** Money out with a known amount. */
export type Spend = Transaction & { amount: number };

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const median = (xs: number[]) => {
  if (!xs.length) {
    return 0;
  }
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
export const stdDev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
};
/** Rounds to a friendly figure: nearest ₹10 under ₹1,000, else nearest ₹100. */
export const approx = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);
export const pctChange = (now: number, before: number) => Math.round(((now - before) / before) * 100);

export function spendsOf(transactions: Transaction[]): Spend[] {
  return transactions.filter((tx): tx is Spend => tx.direction === 'debit' && tx.amount != null && tx.amount > 0);
}

export function creditsOf(transactions: Transaction[]): Spend[] {
  return transactions.filter((tx): tx is Spend => tx.direction === 'credit' && tx.amount != null && tx.amount > 0);
}

export const within = (txs: Spend[], from: number, to: number) => txs.filter(tx => tx.occurredAt >= from && tx.occurredAt < to);

export const totalBetween = (txs: Spend[], from: number, to: number) => sum(within(txs, from, to).map(tx => tx.amount));

/** Spend per calendar day for `days` days starting at `firstDay`, oldest first. */
export function dailyTotals(spends: Spend[], firstDay: number, days: number): number[] {
  const totals = new Array<number>(Math.max(0, days)).fill(0);
  spends.forEach(tx => {
    const i = daysBetween(firstDay, startOfDay(tx.occurredAt));
    if (i >= 0 && i < totals.length) {
      totals[i] += tx.amount;
    }
  });
  return totals;
}

export function categoryTotals(spends: Spend[], from: number, to: number): Map<string, number> {
  const totals = new Map<string, number>();
  within(spends, from, to).forEach(tx => totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount));
  return totals;
}

/** Groups by payee name, ignoring case and stray spaces. */
export function byPayee(txs: Spend[]): Map<string, Spend[]> {
  const groups = new Map<string, Spend[]>();
  txs.forEach(tx => {
    const key = tx.counterparty?.trim().toLowerCase();
    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), tx]);
    }
  });
  return groups;
}

export const monthStart = (timestamp: number, offset = 0) => {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).getTime();
};
