import type { Transaction } from './types';

const HEADER = ['Date', 'Time', 'Type', 'Amount (INR)', 'Category', 'Paid to / from', 'Paid via', 'Note', 'UPI ID', 'Transaction ID'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Quotes a field when it holds a comma, quote or newline (RFC 4180). */
function cell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Oldest first, one row per transaction; opens cleanly in Excel or Google Sheets. */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = [...transactions]
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .map(tx => {
      const d = new Date(tx.occurredAt);
      return [
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        tx.hasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '',
        tx.direction === 'credit' ? 'Money in' : 'Money out',
        tx.amount,
        tx.category,
        tx.counterparty,
        tx.source ?? tx.bank,
        tx.note,
        tx.handle,
        tx.txnRef,
      ]
        .map(cell)
        .join(',');
    });
  return [HEADER.join(','), ...rows].join('\n');
}
