import { budgetStatus, periodFor } from '../src/transactions/budget';
import { todaysStory } from '../src/transactions/stories';
import type { Transaction } from '../src/transactions/types';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const NOW = at(2026, 10, 5, 18); // Monday 5 Oct 2026

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

describe('periodFor', () => {
  it('covers the calendar month', () => {
    expect(periodFor({ amount: 1, period: 'month' }, NOW)).toEqual({
      start: day(2026, 10, 1),
      end: day(2026, 11, 1),
      label: 'October 2026',
    });
  });

  it('runs weeks Monday to Sunday', () => {
    const sunday = at(2026, 10, 11);
    expect(periodFor({ amount: 1, period: 'week' }, sunday)).toEqual({
      start: day(2026, 10, 5),
      end: day(2026, 10, 12),
      label: '5 Oct – 11 Oct',
    });
  });

  it('includes the last day of a custom range', () => {
    const p = periodFor({ amount: 1, period: 'custom', start: day(2026, 10, 3), end: day(2026, 10, 9) }, NOW);
    expect(p).toEqual({ start: day(2026, 10, 3), end: day(2026, 10, 10), label: '3 Oct – 9 Oct' });
  });
});

describe('budgetStatus', () => {
  const transactions = [
    tx({ amount: 3000, occurredAt: at(2026, 10, 2) }),
    tx({ amount: 1000, occurredAt: at(2026, 10, 5) }),
    tx({ amount: 9999, occurredAt: at(2026, 9, 30) }), // last month
    tx({ amount: 500, direction: 'credit', category: 'Salary', occurredAt: at(2026, 10, 3) }),
  ];

  it('tracks spend, what is left and a per-day allowance', () => {
    const s = budgetStatus({ amount: 10000, period: 'month' }, transactions, NOW);
    expect(s.spent).toBe(4000);
    expect(s.remaining).toBe(6000);
    expect(s.state).toBe('active');
    expect(s.daysLeft).toBe(27); // 5–31 Oct, today included
    expect(s.perDay).toBe(Math.floor(6000 / 27));
  });

  it('goes negative and stops the allowance when over budget', () => {
    const s = budgetStatus({ amount: 3500, period: 'month' }, transactions, NOW);
    expect(s.remaining).toBe(-500);
    expect(s.perDay).toBe(0);
    expect(s.usedFraction).toBeCloseTo(4000 / 3500);
  });

  it('knows when a custom budget has not started or has ended', () => {
    const upcoming = budgetStatus(
      { amount: 5000, period: 'custom', start: day(2026, 10, 10), end: day(2026, 10, 14) },
      transactions,
      NOW,
    );
    expect(upcoming.state).toBe('upcoming');
    expect(upcoming.daysLeft).toBe(5);

    const ended = budgetStatus(
      { amount: 5000, period: 'custom', start: day(2026, 10, 1), end: day(2026, 10, 3) },
      transactions,
      NOW,
    );
    expect(ended.state).toBe('ended');
    expect(ended.spent).toBe(3000);
    expect(ended.daysLeft).toBe(0);
  });
});

describe('todaysStory', () => {
  it('is a single empty slide when nothing was spent today', () => {
    expect(todaysStory([tx({ occurredAt: at(2026, 10, 4) })], NOW)).toEqual([{ kind: 'empty' }]);
  });

  it('opens with the total, then categories biggest first', () => {
    const slides = todaysStory(
      [tx({ amount: 50, category: 'Food' }), tx({ amount: 400, category: 'Medical' })],
      NOW,
    );
    expect(slides.map(s => (s.kind === 'category' ? s.item.category : s.kind))).toEqual(['total', 'Medical', 'Food']);
  });
});
