import { categoryLine, monthlyStory } from '../src/transactions/stories';
import type { Transaction } from '../src/transactions/types';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `s${n++}`,
  amount: 100,
  currency: 'INR',
  direction: 'debit',
  counterparty: 'Someone',
  handle: null,
  txnRef: null,
  bank: null,
  source: null,
  category: 'Food',
  kind: 'merchant',
  occurredAt: at(10, 14),
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...o,
});
const NOW = at(10, 15, 18);

test('an empty month has one empty slide', () => {
  expect(monthlyStory([], NOW)).toEqual([{ kind: 'empty' }]);
});

test('category slides, then income; it never asks what a payment was for', () => {
  const slides = monthlyStory(
    [
      tx({ category: 'Groceries', amount: 332, occurredAt: at(10, 2) }),
      tx({ category: 'Food', amount: 50, occurredAt: at(10, 13) }),
      tx({ category: 'Food', amount: 70, occurredAt: at(10, 14) }),
      tx({ category: 'Food', amount: 400, occurredAt: at(10, 3) }),
      tx({ category: 'Personal', amount: 300, occurredAt: at(10, 15, 10), counterparty: 'Ravi' }),
      tx({ category: 'Personal', amount: 80, occurredAt: at(10, 4), categoryConfirmed: true }),
      tx({ direction: 'credit', category: 'Salary', amount: 5000, occurredAt: at(10, 1) }),
      tx({ direction: 'credit', category: 'Personal', amount: 1000, occurredAt: at(10, 9), counterparty: 'Mom' }),
      tx({ category: 'Food', amount: 9000, occurredAt: at(9, 20) }), // last month
    ],
    NOW,
  );
  // Both personal payments count under Personal, confirmed or not.
  expect(slides.map(s => s.kind)).toEqual(['category', 'category', 'category', 'income']);

  const [food, personal, groceries, income] = slides as any[];
  expect(personal).toEqual(expect.objectContaining({ category: 'Personal', amount: 380, position: 1, of: 3 }));
  // Food this month 520; this week only the two recent orders.
  expect(food).toEqual(
    expect.objectContaining({ category: 'Food', amount: 520, count: 2, total: 120, period: 'week', position: 0, of: 3 }),
  );
  // No groceries this week, so the card falls back to the month.
  expect(groceries).toEqual(expect.objectContaining({ category: 'Groceries', count: 1, total: 332, period: 'month' }));
  expect(income).toEqual({ kind: 'income', total: 6000, top: { label: 'Salary', amount: 5000, category: 'Salary' } });
});

test('category lines read naturally', () => {
  expect(categoryLine('Food', 5, 'week')).toBe('you ordered food 5 times this week');
  expect(categoryLine('Groceries', 1, 'month')).toBe('you bought groceries once this month');
  expect(categoryLine('Rent', 2, 'week')).toBe('you spent on rent twice this week');
});

test('confirmed personal payments get their own slide instead of an empty story', () => {
  const slides = monthlyStory(
    [
      tx({ category: 'Personal', amount: 70, counterparty: 'Pranjal Vats', occurredAt: at(10, 5, 14), categoryConfirmed: true }),
      tx({ category: 'Personal', amount: 10, counterparty: 'Pranav Raj', occurredAt: at(10, 5, 13), categoryConfirmed: true }),
    ],
    NOW,
  );
  expect(slides).toEqual([
    // 5 Oct is outside the week ending 15 Oct, so the card covers the month.
    expect.objectContaining({ kind: 'category', category: 'Personal', amount: 80, count: 2, total: 80, period: 'month' }),
  ]);
  expect(categoryLine('Personal', 2, 'week')).toBe('you paid people twice this week');
});

test('a payment Spendd AI placed shows under its category; an unplaced one stays under Other', () => {
  const slides = monthlyStory(
    [
      tx({ category: 'Groceries', categorySource: 'ai', amount: 432, occurredAt: at(10, 14) }),
      tx({ category: 'Other', amount: 30, occurredAt: at(10, 6) }),
    ],
    NOW,
  );
  expect(slides.map(s => (s.kind === 'category' ? s.category : s.kind))).toEqual(['Groceries', 'Other']);
});

