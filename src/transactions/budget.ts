import { addDays, daysBetween, formatDayMonth, LONG_MONTHS, startOfDay } from './format';
import { summarizeSpending, type SpendSummary } from './summary';
import type { Transaction } from './types';

export type BudgetPeriodKind = 'month' | 'week' | 'custom';

export type Budget = {
  amount: number;
  period: BudgetPeriodKind;
  /** Custom budgets only: first and last day (inclusive), as start-of-day timestamps. */
  start?: number;
  end?: number;
};

/** [start, end) of the budget's current period. */
export type BudgetPeriod = { start: number; end: number; label: string };

export function periodFor(budget: Budget, now: number = Date.now()): BudgetPeriod {
  const today = new Date(startOfDay(now));
  if (budget.period === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();
    return { start, end, label: `${LONG_MONTHS[today.getMonth()]} ${today.getFullYear()}` };
  }
  if (budget.period === 'week') {
    // Weeks run Monday to Sunday.
    const start = addDays(today.getTime(), -((today.getDay() + 6) % 7));
    return { start, end: addDays(start, 7), label: `${formatDayMonth(start)} – ${formatDayMonth(addDays(start, 6))}` };
  }
  const start = startOfDay(budget.start ?? now);
  const last = startOfDay(budget.end ?? now);
  return { start, end: addDays(last, 1), label: `${formatDayMonth(start)} – ${formatDayMonth(last)}` };
}

export type BudgetStatus = {
  period: BudgetPeriod;
  spending: SpendSummary;
  spent: number;
  /** Negative when over budget. */
  remaining: number;
  /** spent / amount, uncapped. */
  usedFraction: number;
  /** Days left including today; the whole period if it hasn't started. */
  daysLeft: number;
  /** What can still be spent per remaining day (0 when over or ended). */
  perDay: number;
  state: 'upcoming' | 'active' | 'ended';
};

export function budgetStatus(budget: Budget, transactions: Transaction[], now: number = Date.now()): BudgetStatus {
  const period = periodFor(budget, now);
  const spending = summarizeSpending(transactions, period.start, period.end);
  const today = startOfDay(now);
  const state = today < period.start ? 'upcoming' : today >= period.end ? 'ended' : 'active';
  const daysLeft =
    state === 'upcoming' ? daysBetween(period.start, period.end) : state === 'ended' ? 0 : daysBetween(today, period.end);
  const remaining = Math.round((budget.amount - spending.total) * 100) / 100;
  return {
    period,
    spending,
    spent: spending.total,
    remaining,
    usedFraction: budget.amount > 0 ? spending.total / budget.amount : 0,
    daysLeft,
    perDay: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
    state,
  };
}
