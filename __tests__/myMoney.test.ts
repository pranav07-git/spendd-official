import { buildMyMoney, comparisonLine } from '../src/insights/myMoney';
import type { Transaction } from '../src/transactions/types';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${n++}`,
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
  occurredAt: at(10, 3),
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...o,
});

// "Now" is 15 Oct 2026: October is the month in progress.
const NOW = at(10, 15, 18);

const sample = [
  tx({ direction: 'credit', category: 'Salary', amount: 46000, occurredAt: at(10, 1), counterparty: 'Acme' }),
  tx({ category: 'Rent', amount: 15000, occurredAt: at(10, 5) }),
  tx({ category: 'Food', amount: 4000, occurredAt: at(10, 6) }),
  tx({ category: 'Food', amount: 150, occurredAt: at(10, 7) }),
  tx({ category: 'Bills', amount: 2000, occurredAt: at(10, 12), counterparty: 'Electricity Board' }),
  tx({ category: 'Shopping', amount: 120, occurredAt: at(10, 14) }),
  // September, same days (1–15) and later.
  tx({ category: 'Rent', amount: 15000, occurredAt: at(9, 5) }),
  tx({ category: 'Food', amount: 6000, occurredAt: at(9, 8) }),
  tx({ category: 'Food', amount: 9999, occurredAt: at(9, 25) }), // after the 15th: not compared
];

test('summarises income, spending and savings for the month', () => {
  const m = buildMyMoney(sample, NOW, NOW);
  expect(m.isCurrentMonth).toBe(true);
  expect(m.income).toBe(46000);
  expect(m.spending).toBe(21270);
  expect(m.savings).toBe(24730);
  expect(m.hasData).toBe(true);
});

test('compares with the same days of last month only', () => {
  const m = buildMyMoney(sample, NOW, NOW);
  // 21,270 vs 21,000 (5–8 Sep), not vs 30,999 for the whole of September.
  expect(m.vsLastMonthPct).toBe(1);
  expect(comparisonLine(m)).toBe('You spent about the same as this time last month.');
  const food = m.categories.find(c => c.category === 'Food')!;
  expect(food.amount).toBe(4150);
  expect(food.changePct).toBe(-31);
  expect(m.categories[0].category).toBe('Rent');
  expect(m.categories.find(c => c.category === 'Bills')!.changePct).toBeNull();
});

test('major moments, micro payments and timeline', () => {
  const m = buildMyMoney(sample, NOW, NOW);
  // Only Rent stands out (₹6,000+ against a typical ₹2,000), so the next biggest tops it up to two.
  expect(m.moments.map(x => [x.tx.category, x.when])).toEqual([
    ['Rent', 'EARLY'],
    ['Food', 'EARLY'],
  ]);
  expect(m.micro).toEqual({ total: 270, count: 2 });
  expect(m.timeline.map(e => e.title)).toEqual(['Salary Credited', 'Rent Paid', 'Someone', 'Electricity Board']);
  expect(m.timeline.map(e => e.tone)).toEqual(['highlight', 'highlight', 'highlight', 'regular']);
});

test('standpoint scores savings and discretionary share', () => {
  const m = buildMyMoney(sample, NOW, NOW);
  // Saved 54% of income (full marks); 20% discretionary (full marks).
  expect(m.standpoint).toEqual(
    expect.objectContaining({ score: 100, savingsLabel: 'POSITIVE', lifestyleLabel: 'BALANCED' }),
  );
  const noIncome = buildMyMoney(sample.filter(t => t.direction === 'debit'), NOW, NOW);
  expect(noIncome.standpoint).toBeNull();
  const overspent = buildMyMoney(
    [
      tx({ direction: 'credit', category: 'Salary', amount: 10000, occurredAt: at(10, 1) }),
      tx({ category: 'Shopping', amount: 12000, occurredAt: at(10, 2) }),
    ],
    NOW,
    NOW,
  );
  expect(overspent.standpoint).toEqual(
    expect.objectContaining({ score: 0, savingsLabel: 'NEGATIVE', lifestyleLabel: 'NEEDS WORK' }),
  );
});

test('opportunity extrapolates the biggest discretionary category to a full month', () => {
  const m = buildMyMoney(sample, NOW, NOW);
  // Food: 4,150 over 15 days → ~8,300 for 31 days → a fifth ≈ 1,700.
  expect(m.opportunity).toEqual({ category: 'Food', monthlySaving: 1700 });
});

test('guidance projects a falling trend over a year', () => {
  const m = buildMyMoney(
    [
      tx({ category: 'Food', amount: 1000, occurredAt: at(10, 3) }),
      tx({ category: 'Food', amount: 2000, occurredAt: at(9, 3) }),
    ],
    NOW,
    NOW,
  );
  expect(comparisonLine(m)).toBe('You spent 50% less than this time last month.');
  // 1,000 less over 15 days → ~2,067 a month → ~24,800 a year.
  expect(m.guidance).toBe('If you continue this trend, you could save ₹24,800 more this year.');
});

test('a past month compares whole months and an empty month has no data', () => {
  const sep = buildMyMoney(sample, at(9, 1), NOW);
  expect(sep.isCurrentMonth).toBe(false);
  expect(sep.spending).toBe(30999);
  expect(buildMyMoney(sample, at(8, 1), NOW).hasData).toBe(false);
});

test('a quiet month still fills every section', () => {
  const quiet = buildMyMoney([tx({ category: 'Personal', amount: 100, occurredAt: at(10, 5) })], NOW, NOW);
  expect(quiet.moments).toHaveLength(1);
  expect(quiet.timeline).toHaveLength(1);
  expect(quiet.guidance).toBe("You've spent ₹100 so far. Log every payment and Spendd will show where the month is heading.");
});
