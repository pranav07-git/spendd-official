import { buildInsights } from '../src/insights/engine';
import { buildFacts, hashFacts, PARAMETERS } from '../src/insights/parameters';
import type { Transaction } from '../src/transactions/types';

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `p${n++}`,
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
const NOW = at(10, 15, 18);

const sample = [
  tx({ direction: 'credit', category: 'Salary', amount: 46000, occurredAt: at(10, 1), kind: 'personal', counterparty: 'Acme Payroll' }),
  tx({ category: 'Rent', amount: 15000, occurredAt: at(10, 5), kind: 'personal', counterparty: 'Ramesh Landlord' }),
  tx({ category: 'Rent', amount: 15000, occurredAt: at(9, 5), kind: 'personal', counterparty: 'Ramesh Landlord' }),
  tx({ category: 'Food', amount: 4000, occurredAt: at(10, 6), counterparty: 'Swiggy' }),
  tx({ category: 'Food', amount: 150, occurredAt: at(10, 7), counterparty: 'Chai Point' }),
  tx({ category: 'Food', amount: 1000, occurredAt: at(9, 6), counterparty: 'Swiggy' }),
  tx({ category: 'Shopping', amount: 120, occurredAt: at(10, 14), counterparty: 'Blinkit' }),
];

const facts = buildFacts(sample, buildInsights(sample, null, NOW), null, NOW);
const byKey = Object.fromEntries(facts.map(f => [f.parameter, f]));

test('only the eight fixed parameters, each at most once', () => {
  expect(facts.length).toBeGreaterThan(0);
  expect(facts.length).toBeLessThanOrEqual(8);
  facts.forEach(f => expect(PARAMETERS).toContain(f.parameter));
  expect(new Set(facts.map(f => f.parameter)).size).toBe(facts.length);
});

test('facts carry exact, formatted numbers', () => {
  expect(byKey.top_category.summary).toBe('Rent is your biggest category in October: ₹15,000, 78% of your spending.');
  expect(byKey.fastest_growing.values).toEqual({ category: 'Food', amount: 4150, lastMonthSameDays: 1000, changePct: 315 });
  expect(byKey.savings_rate.summary).toBe(
    "You've earned ₹46,000 and spent ₹19,270 in October, keeping ₹26,730 (58% of income).",
  );
  expect(byKey.small_spends.summary).toBe('2 payments under ₹200 added up to ₹270 in October.');
  expect(byKey.spending_trend.values.changePct).toBe(20); // ₹19,270 vs ₹16,000
});

test('never sends the names of people paid', () => {
  const text = JSON.stringify(facts);
  expect(text).not.toContain('Ramesh');
  expect(text).not.toContain('Acme Payroll');
  expect(byKey.biggest_payment.summary).toBe('Your biggest payment in October was ₹15,000 for Rent on 5 Oct.');
  expect(byKey.recurring.summary).toContain('the next one (₹15,000)');
});

test('parameters without data are left out', () => {
  const sparse = [tx({ category: 'Food', amount: 300, occurredAt: at(10, 10) })];
  const keys = buildFacts(sparse, buildInsights(sparse, null, NOW), null, NOW).map(f => f.parameter);
  expect(keys).not.toContain('savings_rate');
  expect(keys).not.toContain('recurring');
  expect(keys).not.toContain('spending_trend');
  expect(keys).toContain('top_category');
});

test('hash changes only when the facts do', () => {
  expect(hashFacts(facts)).toBe(hashFacts(JSON.parse(JSON.stringify(facts))));
  expect(hashFacts(facts)).not.toBe(hashFacts(facts.slice(1)));
});
