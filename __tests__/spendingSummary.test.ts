import { dailyAverage, paymentCount, todaysSpending } from '../src/transactions/summary';
import type { Transaction } from '../src/transactions/types';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 10, 5, 18);

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
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
  occurredAt: at(2026, 10, 5, 9),
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...overrides,
});

describe('todaysSpending', () => {
  it('totals today’s money out by category, biggest first', () => {
    const summary = todaysSpending(
      [
        tx({ amount: 120.5, category: 'Food' }),
        tx({ amount: 80, category: 'Food', occurredAt: at(2026, 10, 5, 13) }),
        tx({ amount: 450, category: 'Medical' }),
      ],
      NOW,
    );
    expect(summary.total).toBe(650.5);
    expect(summary.count).toBe(3);
    expect(summary.categories.map(c => [c.category, c.amount, c.count])).toEqual([
      ['Medical', 450, 1],
      ['Food', 200.5, 2],
    ]);
    expect(summary.categories[1].transactions[0].occurredAt).toBe(at(2026, 10, 5, 13));
    expect(summary.categories[0].share).toBeCloseTo(450 / 650.5);
  });

  it('ignores money in, unread amounts and other days', () => {
    const summary = todaysSpending(
      [
        tx({ direction: 'credit', category: 'Salary' }),
        tx({ amount: null }),
        tx({ occurredAt: at(2026, 10, 4, 23, 59) }),
        tx({ occurredAt: at(2026, 10, 6, 0, 0) }),
      ],
      NOW,
    );
    expect(summary).toEqual({ total: 0, count: 0, categories: [] });
  });
});

describe('dailyAverage', () => {
  it('averages the previous seven full days, excluding today', () => {
    const transactions = [
      tx({ amount: 700, occurredAt: at(2026, 10, 1) }),
      tx({ amount: 700, occurredAt: at(2026, 9, 28) }),
      tx({ amount: 5000, occurredAt: at(2026, 9, 27) }), // eight days back
      tx({ amount: 999, occurredAt: at(2026, 10, 5, 8) }), // today
    ];
    expect(dailyAverage(transactions, 7, NOW)).toBe(200);
  });
});

it('pluralises payment counts', () => {
  expect(paymentCount(1)).toBe('1 payment');
  expect(paymentCount(3)).toBe('3 payments');
});
