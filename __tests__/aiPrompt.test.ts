import { factSheet, hashFacts, numbersIn, parseAiInsights } from '../src/insights/aiPrompt';
import { buildInsights } from '../src/insights/engine';
import type { Transaction } from '../src/transactions/types';

const FACTS = [
  '- Spent so far in October: ₹4,200.',
  '- Food took 42% of your spending. ₹4,200 in the last 30 days. Cooking at home could save about ₹840 a month.',
  '- You spend 2.3× more on weekends.',
].join('\n');

const reply = (insights: object[]) => JSON.stringify({ insights });

describe('numbersIn', () => {
  it('normalises money, percentages and decimals', () => {
    expect(numbersIn('₹1,23,456.50 is 42% and 2.30× of 10.00')).toEqual(['123456.5', '42', '2.3', '10']);
  });
});

describe('parseAiInsights', () => {
  it('keeps grounded insights and maps tips to the agent style', () => {
    const out = parseAiInsights(
      reply([
        { kind: 'tip', title: 'Food is 42% of your spending', body: 'That’s ₹4,200 this month. Cooking at home could save ₹840.' },
        { kind: 'alert', title: 'Weekends cost you 2.3× more', body: 'Plan one free weekend activity.' },
      ]),
      FACTS,
    );
    expect(out.map(i => [i.kind, i.title, i.source])).toEqual([
      ['agent', 'Food is 42% of your spending', 'ai'],
      ['alert', 'Weekends cost you 2.3× more', 'ai'],
    ]);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  it('drops anything with a number that isn’t in the facts', () => {
    const out = parseAiInsights(
      reply([
        { kind: 'tip', title: 'Save ₹1,000 a month', body: 'Cook at home three nights a week.' },
        { kind: 'win', title: 'Weekend spending noted', body: 'You spend 2.3× more on weekends.' },
      ]),
      FACTS,
    );
    expect(out.map(i => i.title)).toEqual(['Weekend spending noted']);
  });

  it('recovers JSON wrapped in extra text, and survives garbage', () => {
    const wrapped = `Sure! ${reply([{ kind: 'win', title: 'Nice going this week', body: 'Keep logging your spends.' }])} Hope that helps`;
    expect(parseAiInsights(wrapped, FACTS)).toHaveLength(1);
    expect(parseAiInsights('not json at all', FACTS)).toEqual([]);
    expect(parseAiInsights('{"insights": "nope"}', FACTS)).toEqual([]);
  });

  it('rejects bad kinds, empty text and duplicates', () => {
    const out = parseAiInsights(
      reply([
        { kind: 'panic', title: 'Something is wrong', body: 'Very wrong indeed here.' },
        { kind: 'tip', title: '', body: 'No title here at all.' },
        { kind: 'tip', title: 'Cook more at home', body: 'Try it twice a week.' },
        { kind: 'tip', title: 'cook more at home', body: 'Same thing again, twice.' },
      ]),
      FACTS,
    );
    expect(out.map(i => i.title)).toEqual(['Cook more at home']);
  });
});

describe('factSheet', () => {
  const NOW = new Date(2026, 9, 10, 20).getTime();
  const tx = (d: number, amount: number): Transaction => ({
    id: `${d}`,
    amount,
    currency: 'INR',
    direction: 'debit',
    counterparty: 'Shop',
    handle: null,
    txnRef: null,
    bank: null,
    source: 'UPI',
    category: 'Food',
    kind: 'merchant',
    occurredAt: new Date(2026, 9, d, 12).getTime(),
    hasTime: true,
    dateFromReceipt: true,
    createdAt: 0,
    rawText: '',
  });

  it('includes the forecast, budget and the ranked insights', () => {
    const report = buildInsights(
      Array.from({ length: 9 }, (_, i) => tx(i + 1, 300)),
      { amount: 5000, period: 'month' },
      NOW,
    );
    const facts = factSheet(report);
    expect(facts).toContain('Spent so far in October 2026: ₹2,700.');
    expect(facts).toContain('Budget for October 2026: ₹5,000');
    expect(facts).toContain(report.insights[0].title);
    expect(facts.split('\n').every(line => line.startsWith('- '))).toBe(true);
  });

  it('hashes identically for identical facts only', () => {
    expect(hashFacts('a')).toBe(hashFacts('a'));
    expect(hashFacts('a')).not.toBe(hashFacts('b'));
  });
});
