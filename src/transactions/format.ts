import type { Transaction } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatRupees(amount: number): string {
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.');
  // Indian grouping: last three digits, then pairs (1,23,45,678).
  const grouped = whole.replace(/(\d)(?=(\d{2})+\d$)/g, '$1,');
  return `₹${grouped}${fraction === '00' ? '' : `.${fraction}`}`;
}

export function signedAmount(tx: Transaction): string {
  if (tx.amount == null) {
    return '₹ —';
  }
  return `${tx.direction === 'credit' ? '+' : '-'}${formatRupees(tx.amount)}`;
}

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function titleFor(tx: Transaction): string {
  if (!tx.counterparty) {
    return tx.direction === 'credit' ? 'Money received' : 'Payment';
  }
  return tx.direction === 'credit' ? `Received from ${tx.counterparty}` : `Paid to ${tx.counterparty}`;
}

export function initialFor(tx: Transaction): string {
  return (tx.counterparty?.trim().charAt(0) || '₹').toUpperCase();
}

/** "GOOGLE PAY • 11:30 PM" — where it was paid from, and when. */
export function subtitleFor(tx: Transaction): string {
  const where = tx.source ?? tx.bank ?? 'UPI';
  return tx.hasTime ? `${where} • ${formatTime(tx.occurredAt)}` : where;
}

export function matchesQuery(tx: Transaction, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const amountDigits = q.replace(/[₹,\s]/g, '');
  return (
    [tx.counterparty, tx.handle, tx.source, tx.bank, tx.category, tx.txnRef]
      .filter(Boolean)
      .some(field => field!.toLowerCase().includes(q)) ||
    (tx.amount != null && amountDigits !== '' && /^\d+(\.\d+)?$/.test(amountDigits) && String(tx.amount).startsWith(amountDigits))
  );
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type DaySection = { title: string; data: Transaction[] };

/** Newest first, grouped under TODAY / YESTERDAY / "12 JUL 2026". */
export function groupByDay(transactions: Transaction[], now: number = Date.now()): DaySection[] {
  const today = startOfDay(now);
  const yesterday = startOfDay(today - 1);
  const sections = new Map<number, Transaction[]>();

  [...transactions]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .forEach(tx => {
      const day = startOfDay(tx.occurredAt);
      sections.set(day, [...(sections.get(day) ?? []), tx]);
    });

  return [...sections.entries()].map(([day, data]) => ({
    title:
      day === today
        ? 'TODAY'
        : day === yesterday
          ? 'YESTERDAY'
          : formatDate(day).replace(',', '').toUpperCase(),
    data,
  }));
}
