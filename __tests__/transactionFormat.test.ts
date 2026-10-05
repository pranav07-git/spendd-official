import {
  formatRupees,
  formatRupeesShort,
  groupByDay,
  matchesQuery,
  signedAmount,
  subtitleFor,
  titleFor,
} from '../src/transactions/format';
import type { Transaction } from '../src/transactions/types';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  amount: 1000,
  currency: 'INR',
  direction: 'debit',
  counterparty: 'Aditya Raj',
  handle: 'adityaraj7612@oksbi',
  txnRef: '656116935626',
  bank: 'State Bank of India',
  source: 'Navi',
  category: 'Personal',
  kind: 'personal',
  occurredAt: at(2026, 7, 14, 19, 14),
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...overrides,
});

test('formats rupees with Indian grouping', () => {
  expect(formatRupees(1)).toBe('₹1');
  expect(formatRupees(1000)).toBe('₹1,000');
  // DESIGN.md: no paise from ₹100 up; under ₹100 only when non-zero.
  expect(formatRupees(123456.5)).toBe('₹1,23,457');
  expect(formatRupees(42.5)).toBe('₹42.50');
  expect(formatRupees(99)).toBe('₹99');
  expect(formatRupees(42209)).toBe('₹42,209');
});

test('signs amounts by direction', () => {
  expect(signedAmount(tx({ direction: 'credit', amount: 42209 }))).toBe('+₹42,209');
  expect(signedAmount(tx({ direction: 'debit', amount: 1 }))).toBe('-₹1');
  expect(signedAmount(tx({ amount: null }))).toBe('₹ —');
});

test('titles and subtitles', () => {
  expect(titleFor(tx({}))).toBe('Paid to Aditya Raj');
  expect(titleFor(tx({ direction: 'credit', counterparty: 'Rohit' }))).toBe('Received from Rohit');
  expect(titleFor(tx({ counterparty: null }))).toBe('Payment');
  expect(subtitleFor(tx({}))).toBe('Navi • 7:14 pm');
  expect(subtitleFor(tx({ source: null, bank: null, hasTime: false }))).toBe('UPI');
});

test('groups newest first under today / yesterday / date', () => {
  const now = at(2026, 7, 14, 23, 50);
  const sections = groupByDay(
    [
      tx({ id: 'old', occurredAt: at(2026, 7, 10) }),
      tx({ id: 'today-early', occurredAt: at(2026, 7, 14, 9) }),
      tx({ id: 'yesterday', occurredAt: at(2026, 7, 13, 15, 38) }),
      tx({ id: 'today-late', occurredAt: at(2026, 7, 14, 23, 34) }),
    ],
    now,
  );
  expect(sections.map(s => s.title)).toEqual(['Today', 'Yesterday', '10 Jul 2026']);
  expect(sections[0].data.map(t => t.id)).toEqual(['today-late', 'today-early']);
});

test('search matches names, handles, apps and amounts', () => {
  const t = tx({});
  expect(matchesQuery(t, 'aditya')).toBe(true);
  expect(matchesQuery(t, 'oksbi')).toBe(true);
  expect(matchesQuery(t, 'navi')).toBe(true);
  expect(matchesQuery(t, '₹1,000')).toBe(true);
  expect(matchesQuery(t, 'swiggy')).toBe(false);
  expect(matchesQuery(t, '  ')).toBe(true);
  expect(matchesQuery(tx({ amount: null }), '100')).toBe(false);
});

test('short amounts for tight spaces', () => {
  expect(formatRupeesShort(1240)).toBe('₹1.2K');
  expect(formatRupeesShort(340000)).toBe('₹3.4L');
  expect(formatRupeesShort(12000000)).toBe('₹1.2Cr');
  expect(formatRupeesShort(450)).toBe('₹450');
});
