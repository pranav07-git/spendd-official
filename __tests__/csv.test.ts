import { transactionsToCsv } from '../src/transactions/csv';
import type { Transaction } from '../src/transactions/types';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'x',
  amount: 250,
  currency: 'INR',
  direction: 'debit',
  counterparty: 'Apollo Pharmacy',
  handle: null,
  txnRef: null,
  bank: null,
  source: 'Cash',
  category: 'Medical',
  kind: 'merchant',
  occurredAt: new Date(2026, 9, 5, 9, 7).getTime(),
  hasTime: true,
  dateFromReceipt: false,
  createdAt: 0,
  rawText: '',
  ...overrides,
});

it('writes a header and one row per transaction, oldest first', () => {
  const csv = transactionsToCsv([
    tx({ occurredAt: new Date(2026, 9, 6).getTime(), hasTime: false, amount: 40000, direction: 'credit', category: 'Salary', counterparty: 'Acme', source: 'Bank transfer' }),
    tx({}),
  ]);
  expect(csv.split('\n')).toEqual([
    'Date,Time,Type,Amount (INR),Category,Paid to / from,Paid via,Note,UPI ID,Transaction ID',
    '2026-10-05,09:07,Money out,250,Medical,Apollo Pharmacy,Cash,,,',
    '2026-10-06,,Money in,40000,Salary,Acme,Bank transfer,,,',
  ]);
});

it('quotes fields with commas, quotes or newlines', () => {
  const [, row] = transactionsToCsv([tx({ counterparty: 'Rao, Sons', note: 'said "thanks"\nlater' })]).split(/\n(?=2026)/);
  expect(row).toBe('2026-10-05,09:07,Money out,250,Medical,"Rao, Sons",Cash,"said ""thanks""\nlater",,');
});

it('stops spreadsheet formulas in text from running', () => {
  const [, row] = transactionsToCsv([tx({ counterparty: '=HYPERLINK("http://x","Pay")', note: '@SUM(A1)' })]).split('\n');
  expect(row).toBe('2026-10-05,09:07,Money out,250,Medical,"\'=HYPERLINK(""http://x"",""Pay"")",Cash,\'@SUM(A1),,');
});
