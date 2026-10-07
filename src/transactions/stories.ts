import { monthStart, spendsOf, creditsOf, sum, within, type Spend } from '../insights/stats';
import { addDays, startOfDay } from './format';
import type { Transaction } from './types';

/** Categories that say nothing about what a payment was for; Spendd AI is asked about these. */
export const UNCLEAR = ['Personal', 'Other'];
const MAX_CATEGORY_SLIDES = 3;

export type StorySlide =
  | { kind: 'empty' }
  | {
      kind: 'category';
      category: string;
      /** This month so far. */
      amount: number;
      /** The card's fact: this week's payments, or this month's when there were none this week. */
      count: number;
      total: number;
      period: 'week' | 'month';
      /** Position among the category slides, for the card's dots. */
      position: number;
      of: number;
    }
  | { kind: 'income'; total: number; top: { label: string; amount: number; category: string } };

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** "you ordered food 5 times this week" */
export function categoryLine(category: string, count: number, period: 'week' | 'month'): string {
  const verb: Record<string, string> = {
    Food: 'you ordered food',
    Groceries: 'you bought groceries',
    Shopping: 'you went shopping',
    Travel: 'you paid for travel',
    Bills: 'you paid bills',
    Entertainment: 'you spent on fun',
    Medical: 'you paid for health',
    Personal: 'you paid people',
    Other: 'you made other payments',
  };
  return `${verb[category] ?? `you spent on ${category.toLowerCase()}`} ${times(count)} this ${period}`;
}

/**
 * The story behind the home screen's "Today's Story": this month's top categories (each with a
 * this-week fact), then where the money came from. Every payment counts under the category it has
 * (from the keyword rules, Spendd AI or the user); it never asks what a payment was for. Those are
 * corrected on the transaction page.
 */
export function monthlyStory(transactions: Transaction[], now: number = Date.now()): StorySlide[] {
  const from = monthStart(now);
  const end = addDays(startOfDay(now), 1);
  const weekFrom = addDays(startOfDay(now), -6);
  const spends = within(spendsOf(transactions), from, end);
  const credits = within(creditsOf(transactions), from, end);

  const byCategory = new Map<string, Spend[]>();
  spends.forEach(tx => byCategory.set(tx.category, [...(byCategory.get(tx.category) ?? []), tx]));
  const clear = [...byCategory.entries()]
    .map(([category, txs]) => ({ category, txs, amount: sum(txs.map(tx => tx.amount)) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, MAX_CATEGORY_SLIDES);

  const slides: StorySlide[] = clear.map((c, i) => {
    const week = c.txs.filter(tx => tx.occurredAt >= weekFrom);
    const facts = week.length > 0 ? week : c.txs;
    return {
      kind: 'category',
      category: c.category,
      amount: c.amount,
      count: facts.length,
      total: sum(facts.map(tx => tx.amount)),
      period: week.length > 0 ? 'week' : 'month',
      position: i,
      of: clear.length,
    };
  });

  if (credits.length > 0) {
    const sources = new Map<string, { label: string; amount: number; category: string }>();
    credits.forEach(tx => {
      const label = UNCLEAR.includes(tx.category) ? tx.counterparty ?? 'Transfers' : tx.category;
      const entry = sources.get(label) ?? { label, amount: 0, category: tx.category };
      entry.amount += tx.amount;
      sources.set(label, entry);
    });
    const top = [...sources.values()].sort((a, b) => b.amount - a.amount)[0];
    slides.push({ kind: 'income', total: sum(credits.map(tx => tx.amount)), top });
  }

  return slides.length > 0 ? slides : [{ kind: 'empty' }];
}
