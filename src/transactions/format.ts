import type { Transaction } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * ₹1,23,456 — Indian grouping. No paise from ₹100 up; below that, paise only when non-zero
 * (₹42.50). DESIGN.md §4.4.
 */
export function formatRupees(amount: number): string {
  const abs = Math.abs(amount);
  const [whole, fraction] = (abs >= 100 ? Math.round(abs).toFixed(0) : abs.toFixed(2)).split('.');
  // Indian grouping: last three digits, then pairs (1,23,45,678).
  const grouped = whole.replace(/(\d)(?=(\d{2})+\d$)/g, '$1,');
  return `₹${grouped}${!fraction || fraction === '00' ? '' : `.${fraction}`}`;
}

/** ₹1.2K, ₹3.4L, ₹1.2Cr — for tight spaces. */
export function formatRupeesShort(amount: number): string {
  const abs = Math.abs(amount);
  const one = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '');
  if (abs >= 1e7) return `₹${one(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${one(abs / 1e5)}L`;
  if (abs >= 1e3) return `₹${one(abs / 1e3)}K`;
  return formatRupees(abs);
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
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Sunday, 5 October" */
export function formatLongDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;
}

/** "5 Oct" */
export function formatDayMonth(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

export function titleFor(tx: Transaction): string {
  if (!tx.counterparty) {
    if (tx.manual) {
      return tx.category;
    }
    return tx.direction === 'credit' ? 'Money received' : 'Payment';
  }
  return tx.direction === 'credit' ? `Received from ${tx.counterparty}` : `Paid to ${tx.counterparty}`;
}

export function initialFor(tx: Transaction): string {
  const name = tx.counterparty ?? (tx.manual ? tx.category : null);
  return (name?.trim().charAt(0) || '₹').toUpperCase();
}

/** "Google Pay • 11:30 pm" — where it was paid from, and when. */
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

export function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar-aware, so it stays at midnight across DST changes. */
export function addDays(timestamp: number, days: number): number {
  const d = new Date(timestamp);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Whole calendar days from one start-of-day to another. */
export const daysBetween = (from: number, to: number) => Math.round((to - from) / (24 * 60 * 60 * 1000));

export type DaySection = { title: string; data: Transaction[] };

/** Newest first, grouped under "Today" / "Yesterday" / "12 Jul 2026" (DESIGN.md §4.4). */
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
        ? 'Today'
        : day === yesterday
          ? 'Yesterday'
          : formatDate(day).replace(',', ''),
    data,
  }));
}
