import { dailyAverage, todaysSpending, type CategorySpend, type SpendSummary } from './summary';
import type { Transaction } from './types';

export type StorySlide =
  | { kind: 'empty' }
  /** `change` is % vs the 7-day daily average, or null without history. */
  | { kind: 'total'; summary: SpendSummary; change: number | null }
  | { kind: 'category'; item: CategorySpend };

/** Today's total, then one slide per category (biggest first). The home strip shows one card per slide. */
export function todaysStory(transactions: Transaction[], now: number = Date.now()): StorySlide[] {
  const summary = todaysSpending(transactions, now);
  if (summary.count === 0) {
    return [{ kind: 'empty' }];
  }
  const average = dailyAverage(transactions, 7, now);
  return [
    { kind: 'total', summary, change: average > 0 ? Math.round(((summary.total - average) / average) * 100) : null },
    ...summary.categories.map(item => ({ kind: 'category' as const, item })),
  ];
}
