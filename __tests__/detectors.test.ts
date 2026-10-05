import { buildInsights } from '../src/insights/engine';
import type { Budget } from '../src/transactions/budget';
import type { Transaction } from '../src/transactions/types';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 10, 20, 20); // Tuesday 20 Oct 2026, evening

let n = 0;
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: `t${n++}`,
  amount: 100,
  currency: 'INR',
  direction: 'debit',
  counterparty: 'Shop',
  handle: null,
  txnRef: null,
  bank: null,
  source: 'UPI',
  category: 'Food',
  kind: 'merchant',
  occurredAt: NOW,
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...overrides,
});

/** One payment a day for `days` days ending yesterday. */
const daily = (amount: number, days: number, extra: Partial<Transaction> = {}) =>
  Array.from({ length: days }, (_, i) => tx({ amount, occurredAt: NOW - (i + 1) * 864e5, ...extra }));

const find = (txs: Transaction[], id: string, budget: Budget | null = null) =>
  buildInsights(txs, budget, NOW).insights.find(i => i.id === id);

it('warns when spending beats income', () => {
  const insight = find([...daily(400, 20), tx({ direction: 'credit', category: 'Salary', amount: 5000, occurredAt: at(2026, 10, 1) })], 'savings-rate');
  expect(insight).toMatchObject({ kind: 'alert', title: 'You spent ₹3,000 more than came in' });
});

it('celebrates a healthy savings rate', () => {
  const insight = find([...daily(100, 20), tx({ direction: 'credit', category: 'Salary', amount: 30000, occurredAt: at(2026, 10, 1) })], 'savings-rate');
  expect(insight).toMatchObject({ kind: 'win', title: 'You kept 93% of what came in' });
});

it('flags a possible double payment', () => {
  const insight = find(
    [
      ...daily(50, 10),
      tx({ counterparty: 'Zomato', amount: 349, occurredAt: at(2026, 10, 18, 13, 0), txnRef: 'A1' }),
      tx({ counterparty: 'zomato', amount: 349, occurredAt: at(2026, 10, 18, 13, 4), txnRef: 'A2' }),
    ],
    'duplicate-' + `t${n - 1}`,
  );
  expect(insight?.title).toBe('Possible double payment to zomato');
});

it('asks for missing amounts', () => {
  expect(find([...daily(50, 3), tx({ amount: null }), tx({ amount: null })], 'needs-review')?.title).toBe('2 payments need an amount');
});

it('spots a subscription price rise', () => {
  const insight = find(
    [
      ...daily(50, 10),
      tx({ counterparty: 'Netflix', amount: 499, occurredAt: at(2026, 9, 15) }),
      tx({ counterparty: 'Netflix', amount: 649, occurredAt: at(2026, 10, 15) }),
    ],
    'price-netflix',
  );
  expect(insight?.title).toBe('Netflix went up from ₹499 to ₹649');
  expect(insight?.caption).toContain('₹1,800 more a year');
});

it('compares this month so far with last month', () => {
  const lastMonth = Array.from({ length: 30 }, (_, i) => tx({ amount: 100, occurredAt: at(2026, 9, 1 + i) }));
  const thisMonth = Array.from({ length: 20 }, (_, i) => tx({ amount: 200, occurredAt: at(2026, 10, 1 + i, 9) }));
  const insight = find([...lastMonth, ...thisMonth], 'month-to-date');
  expect(insight).toMatchObject({ kind: 'alert', title: '₹2,000 more than this time last month' });
});

it('names a merchant you keep paying', () => {
  const insight = find(daily(250, 8, { counterparty: 'Swiggy' }), 'regular-merchant');
  expect(insight?.title).toBe('You paid Swiggy 8 times in 30 days');
  expect(insight?.caption).toContain('Skipping every other one saves ₹1,000');
});

it('notices late-night spending', () => {
  const late = Array.from({ length: 5 }, (_, i) => tx({ amount: 300, occurredAt: at(2026, 10, 10 + i, 23, 30) }));
  expect(find([...daily(50, 20), ...late], 'late-night')?.title).toBe('₹1,500 spent late at night');
});

it('catches a payday splurge', () => {
  const normal = daily(100, 30);
  const splurge = Array.from({ length: 7 }, (_, i) => tx({ amount: 1000, occurredAt: at(2026, 10, 1 + i, 18) }));
  const salary = tx({ direction: 'credit', category: 'Salary', amount: 40000, occurredAt: at(2026, 10, 1, 9) });
  const insight = find([...normal, ...splurge, salary], 'payday');
  expect(insight?.kind).toBe('alert');
  expect(insight?.caption).toContain('after your salary on 1 Oct');
});

it('counts days under the daily budget', () => {
  // ₹3,100 for October = ₹100/day; the last 4 days were under it, the day before wasn't.
  const txs = [tx({ amount: 500, occurredAt: at(2026, 10, 15) }), ...daily(80, 4)];
  expect(find(txs, 'budget-streak', { amount: 3100, period: 'month' })?.title).toBe('4 days in a row under your daily budget');
});

it('projects a category past last month', () => {
  const lastMonth = [tx({ amount: 3000, category: 'Shopping', occurredAt: at(2026, 9, 25) }), ...Array.from({ length: 30 }, (_, i) => tx({ amount: 10, occurredAt: at(2026, 9, 1 + i) }))];
  const thisMonth = [tx({ amount: 4000, category: 'Shopping', occurredAt: at(2026, 10, 5) })];
  const insight = find([...lastMonth, ...thisMonth], 'cat-forecast-Shopping');
  expect(insight?.title).toBe('At this rate, Shopping will hit ₹6,200 this month');
});

it('compares the last two weeks', () => {
  const insight = find([...daily(300, 7), ...daily(100, 14).slice(7)], 'week-over-week');
  expect(insight).toMatchObject({ kind: 'alert', title: 'Your last 7 days cost 200% more than the week before' });
});

it('finds many more patterns on a rich history than the old engine did', () => {
  const rich = [
    ...daily(150, 60, { counterparty: 'Swiggy' }),
    ...Array.from({ length: 6 }, (_, i) => tx({ amount: 400, category: 'Shopping', occurredAt: at(2026, 10, 3 + i * 2, 23) })),
    tx({ direction: 'credit', category: 'Salary', amount: 9000, occurredAt: at(2026, 10, 1) }),
    tx({ amount: null }),
  ];
  expect(buildInsights(rich, null, NOW).insights.length).toBeGreaterThanOrEqual(6);
});
