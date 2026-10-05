import { buildInsights, lifetimeStats, recurringPayments, weightedPace } from '../src/insights/engine';
import type { Transaction } from '../src/transactions/types';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const NOW = at(2026, 10, 10, 20); // Saturday 10 Oct 2026, evening

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
  occurredAt: NOW,
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...overrides,
});

/** One payment a day of `amount` for `days` days ending yesterday. */
const steady = (amount: number, days: number, category = 'Food') =>
  Array.from({ length: days }, (_, i) => tx({ amount, category, occurredAt: at(2026, 10, 9 - i) }));

describe('weightedPace', () => {
  it('equals the mean for flat spending', () => {
    expect(weightedPace([200, 200, 200, 200])).toBeCloseTo(200);
  });

  it('leans towards recent days', () => {
    const pace = weightedPace([...new Array(14).fill(100), ...new Array(7).fill(500)]);
    expect(pace).toBeGreaterThan((14 * 100 + 7 * 500) / 21);
    expect(pace).toBeLessThan(500);
  });
});

describe('forecast', () => {
  it('projects the month from a steady pace', () => {
    // ₹300/day for the 9 days before today, nothing yet today; 22 days left including today.
    const { forecast } = buildInsights(steady(300, 9), null, NOW);
    expect(forecast.label).toBe('October');
    expect(forecast.spent).toBe(2700);
    expect(forecast.pace).toBe(300);
    expect(forecast.projected).toBe(2700 + 300 * 22);
    expect(forecast.low).toBeLessThanOrEqual(forecast.projected);
    expect(forecast.high).toBeGreaterThanOrEqual(forecast.projected);
  });

  it('predicts the day a budget runs out', () => {
    // ₹2,700 spent, ₹300/day, ₹5,000 budget: today's ₹300 → 3,000, then 7 more days → 5,100 on 17 Oct.
    const report = buildInsights(steady(300, 9), { amount: 5000, period: 'month' }, NOW);
    expect(report.forecast.overrunOn).toBe(day(2026, 10, 17));
    expect(report.insights[0]).toMatchObject({ id: 'forecast', kind: 'alert' });
    expect(report.insights[0].title).toContain('17 Oct');
  });

  it('celebrates being on track', () => {
    const report = buildInsights(steady(100, 9), { amount: 20000, period: 'month' }, NOW);
    expect(report.forecast.overrunOn).toBeNull();
    expect(report.insights.find(i => i.id === 'forecast')).toMatchObject({ kind: 'win' });
  });

  it('flags a budget that is already blown', () => {
    const report = buildInsights(steady(1000, 9), { amount: 5000, period: 'month' }, NOW);
    expect(report.insights[0].title).toBe('You’re ₹4,000 over budget');
  });
});

describe('daily status', () => {
  it('splits the remaining budget across the days left', () => {
    // ₹5,000 left over 22 days → ₹227 today; ₹100 spent today.
    const report = buildInsights(
      [...steady(0, 9).map(t => ({ ...t, amount: 1 })), tx({ amount: 100 })],
      { amount: 5009, period: 'month' },
      NOW,
    );
    expect(report.dailyStatus.spendBelowToday).toBe(227);
    expect(report.dailyStatus.safeToSpend).toBe(127);
    expect(report.dailyBudget).toMatchObject({ amount: 227, basis: 'budget' });
  });

  it('falls back to the usual day without a budget', () => {
    const report = buildInsights(steady(250, 9), null, NOW);
    expect(report.dailyStatus.spendBelowToday).toBe(250);
    expect(report.dailyBudget?.basis).toBe('usual');
  });

  it('averages the usual day over the days actually logged, not since an old screenshot', () => {
    // Logging began 4 days ago (₹300/day since), plus one old screenshot from June.
    const loggedFrom = day(2026, 10, 6);
    const recent = steady(300, 4).map(t => ({ ...t, createdAt: loggedFrom }));
    const old = tx({ amount: 6000, occurredAt: at(2026, 6, 17), createdAt: loggedFrom });
    const report = buildInsights([...recent, old], null, NOW);
    expect(report.dailyBudget).toMatchObject({ amount: 300, basis: 'usual' });
  });
});

describe('patterns', () => {
  it('asks for more data at first', () => {
    const report = buildInsights([tx({ amount: 50 })], null, NOW);
    expect(report.insights.map(i => i.id)).toContain('warming-up');
  });

  it('spots a category trending up', () => {
    const before = Array.from({ length: 30 }, (_, i) => tx({ amount: 30, occurredAt: at(2026, 9, 10 - i) }));
    const recent = Array.from({ length: 30 }, (_, i) => tx({ amount: 60, occurredAt: at(2026, 10, 10 - i) }));
    const report = buildInsights([...before, ...recent], null, NOW);
    expect(report.insights.find(i => i.id === 'up-Food')?.title).toBe('Food spending is up 100%');
  });

  it('gives a tip when one discretionary category dominates', () => {
    const report = buildInsights([...steady(200, 9, 'Shopping'), ...steady(20, 9, 'Bills')], null, NOW);
    const top = report.insights.find(i => i.id === 'top-Shopping');
    expect(top?.caption).toContain('48 hours');
  });

  it('never gives tips on medical spending', () => {
    const report = buildInsights(steady(500, 9, 'Medical'), null, NOW);
    expect(report.insights.some(i => i.id === 'top-Medical')).toBe(false);
  });

  it('finds monthly repeats with similar amounts', () => {
    const subs = [
      tx({ counterparty: 'Netflix', amount: 649, occurredAt: at(2026, 8, 12) }),
      tx({ counterparty: 'Netflix', amount: 649, occurredAt: at(2026, 9, 12) }),
      tx({ counterparty: 'netflix ', amount: 649, occurredAt: at(2026, 10, 12) }),
      tx({ counterparty: 'Cafe', amount: 80, occurredAt: at(2026, 10, 1) }),
      tx({ counterparty: 'Cafe', amount: 300, occurredAt: at(2026, 10, 3) }),
    ];
    expect(recurringPayments(subs as never)).toEqual([{ name: 'netflix', amount: 649, next: day(2026, 11, 11) }]);
  });

  it('ranks insights most important first', () => {
    const report = buildInsights(steady(300, 9), { amount: 5000, period: 'month' }, NOW);
    const scores = report.insights.map(i => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('builds habit shares from the last 30 days', () => {
    const report = buildInsights([...steady(300, 9, 'Food'), ...steady(100, 9, 'Travel')], null, NOW);
    expect(report.habits.map(h => [h.label, h.sharePct])).toEqual([
      ['Food', 75],
      ['Travel', 25],
    ]);
  });
});

it('summarises lifetime stats', () => {
  const stats = lifetimeStats([...steady(100, 3), tx({ direction: 'credit', category: 'Salary', amount: 5000 })], NOW);
  expect(stats).toMatchObject({ totalSpent: 300, transactions: 4, topCategory: 'Food', daysTracked: 4 });
});

describe('headlineFor', () => {
  const { headlineFor } = require('../src/insights/engine');
  const f = (o: object) => ({ label: 'October', lastDay: 0, spent: 0, projected: 0, low: 0, high: 0, pace: 0, budget: null, overrunOn: null, daysLeft: 9, confident: true, ...o });
  it('tells the budget story first', () => {
    expect(headlineFor(f({ budget: 10000, spent: 5800, projected: 9000 }), null, true)).toBe('₹4,200 left for 9 days. You’re on track.');
    expect(headlineFor(f({ budget: 10000, spent: 5800, projected: 12000 }), null, true)).toBe('₹4,200 left for 9 days. Things are a bit tight.');
    expect(headlineFor(f({ budget: 10000, spent: 10340, daysLeft: 1 }), null, true)).toBe("₹340 over budget, with 1 day to go. Let's slow down a bit.");
  });
  it('falls back to the week, then a neutral line', () => {
    expect(headlineFor(f({}), -12, true)).toBe('You’re spending less than usual this week.');
    expect(headlineFor(f({}), null, false)).toBe('No spends yet. Share your next UPI screenshot to start.');
  });
});
