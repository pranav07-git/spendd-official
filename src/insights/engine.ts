/**
 * Spendd's on-device insights engine. Everything here is a pure function of the user's
 * transactions (and budget), so it runs offline, instantly, and nothing leaves the phone.
 * Its numbers also feed the eight fixed parameters Spendd AI words (see parameters.ts).
 *
 * - Pace: an exponentially weighted average of daily spend (half-life 7 days), so recent
 *   habits count more than old ones; its spread gives the forecast's likely range.
 * - Forecast: spent so far + the rest of today + pace × days left in the month/budget.
 * - Patterns: the detectors in detectors.ts, ranked by score.
 */
import { budgetStatus, periodFor, type Budget } from '../transactions/budget';
import { addDays, daysBetween, formatDayMonth, formatRupees, LONG_MONTHS, startOfDay } from '../transactions/format';
import { summarizeSpending } from '../transactions/summary';
import type { Transaction } from '../transactions/types';
import { DETECTORS, recurringPayments, type Ctx } from './detectors';
import {
  approx,
  categoryTotals,
  creditsOf,
  dailyTotals,
  mean,
  monthStart,
  pctChange,
  spendsOf,
  stdDev,
  sum,
  totalBetween,
  type Spend,
} from './stats';
import type { DailyBudget, DailyStatus, Forecast, Habit, Insight, InsightsReport } from './types';

export { dailyTotals, recurringPayments };

const HALF_LIFE_DAYS = 7;
const HISTORY_DAYS = 60;
/** z-score for an ~80% interval. */
const Z_80 = 1.28;

/** Recency-weighted mean: yesterday counts double a day a week earlier. */
export function weightedPace(history: number[]): number {
  let weighted = 0;
  let weights = 0;
  history.forEach((x, i) => {
    const w = 0.5 ** ((history.length - 1 - i) / HALF_LIFE_DAYS);
    weighted += w * x;
    weights += w;
  });
  return weights ? weighted / weights : 0;
}

function buildForecast(
  transactions: Transaction[],
  spends: Spend[],
  budget: Budget | null,
  pace: number,
  spread: number,
  confident: boolean,
  now: number,
): Forecast {
  const today = startOfDay(now);
  const status = budget ? budgetStatus(budget, transactions, now) : null;
  const useBudget = budget != null && status?.state === 'active';
  const period = useBudget ? status!.period : periodFor({ amount: 0, period: 'month' }, now);

  const spent = Math.round(totalBetween(spends, period.start, period.end));
  const spentToday = totalBetween(spends, today, addDays(today, 1));
  const remainingDays = Math.max(0, daysBetween(today, period.end) - 1);
  const restOfToday = Math.max(0, pace - spentToday);
  const projected = Math.round(spent + restOfToday + pace * remainingDays);
  const margin = Z_80 * spread * Math.sqrt(remainingDays + 1);

  let overrunOn: number | null = null;
  if (useBudget && pace > 0 && spent <= budget!.amount) {
    const need = budget!.amount - spent;
    const day = need <= restOfToday ? today : addDays(today, Math.ceil((need - restOfToday) / pace));
    overrunOn = day < period.end ? day : null;
  }

  return {
    label: useBudget ? period.label : LONG_MONTHS[new Date(today).getMonth()],
    lastDay: addDays(period.end, -1),
    spent,
    projected,
    low: Math.round(Math.max(spent, projected - margin)),
    high: Math.round(projected + margin),
    pace: Math.round(pace),
    budget: useBudget ? budget!.amount : null,
    overrunOn,
    daysLeft: remainingDays + 1,
    confident,
  };
}

function forecastInsight(f: Forecast, lastMonth: { name: string; total: number } | null): Insight {
  const by = formatDayMonth(f.lastDay);
  if (f.budget != null) {
    if (f.spent > f.budget) {
      return {
        id: 'forecast',
        kind: 'alert',
        score: 100,
        title: `You’re ${formatRupees(f.spent - f.budget)} over budget`,
        caption: `With ${f.daysLeft} ${f.daysLeft === 1 ? 'day' : 'days'} left, pausing non-essentials stops it growing.`,
      };
    }
    if (f.overrunOn != null) {
      const perDay = Math.floor((f.budget - f.spent) / f.daysLeft);
      return {
        id: 'forecast',
        kind: 'alert',
        score: 95,
        title: `At this rate, your budget runs out on ${formatDayMonth(f.overrunOn)}`,
        caption: `You’re on pace for ${formatRupees(approx(f.projected))} against ${formatRupees(f.budget)}. Keep to ${formatRupees(perDay)} a day to make it to ${by}.`,
      };
    }
    return {
      id: 'forecast',
      kind: 'win',
      score: 70,
      title: `On track to finish ${formatRupees(approx(f.budget - f.projected))} under budget`,
      caption: `Projected ${formatRupees(approx(f.projected))} of ${formatRupees(f.budget)} by ${by}.`,
    };
  }

  const compare =
    lastMonth && lastMonth.total > 0
      ? `That’s ${Math.abs(pctChange(f.projected, lastMonth.total))}% ${f.projected >= lastMonth.total ? 'more' : 'less'} than ${lastMonth.name} (${formatRupees(approx(lastMonth.total))}).`
      : 'Based on your recent days.';
  return {
    id: 'forecast',
    kind: 'agent',
    score: 80,
    title: `At this rate you’ll spend about ${formatRupees(approx(f.projected))} in ${f.label}`,
    caption: `${compare} Set a budget to track it against a goal.`,
  };
}

function habitsFrom(spends: Spend[], today: number): Habit[] {
  const totals = categoryTotals(spends, addDays(today, -29), addDays(today, 1));
  const total = sum([...totals.values()]);
  if (total <= 0) {
    return [];
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category, amount]) => ({
      id: category,
      label: category,
      sharePct: Math.round((amount / total) * 100),
    }));
}

/** Runs every detector, drops overlaps, and ranks what's left. */
function detectPatterns(c: Ctx): Insight[] {
  const found = DETECTORS.flatMap(detect => {
    const result = detect(c);
    return result == null ? [] : Array.isArray(result) ? result : [result];
  });
  const ids = new Set(found.map(i => i.id));
  // A category trending up already says what its month-end forecast would.
  return found.filter(i => !(i.id.startsWith('cat-forecast-') && ids.has(`up-${i.id.slice('cat-forecast-'.length)}`)));
}

export function buildInsights(transactions: Transaction[], budget: Budget | null, now: number = Date.now()): InsightsReport {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const spends = spendsOf(transactions);
  const firstDay = spends.length ? Math.min(...spends.map(tx => startOfDay(tx.occurredAt))) : today;
  const daysTracked = Math.max(1, daysBetween(firstDay, today) + 1);
  const historyDays = Math.min(HISTORY_DAYS, daysTracked - 1);
  const historyStart = addDays(today, -historyDays);
  const history = dailyTotals(spends, historyStart, historyDays);
  const spentToday = totalBetween(spends, today, tomorrow);
  const status = budget ? budgetStatus(budget, transactions, now) : null;

  // Too little history for a trend: use the plain average, today included.
  const pace = historyDays >= 3 ? weightedPace(history) : mean([...history, spentToday]);
  const spread = historyDays >= 3 ? stdDev(history) : pace * 0.5;
  // Your usual day: the average over the days Spendd has actually been logging (at most the last 30,
  // today excluded). Logging starts with the first payment added to the app, not the oldest payment
  // date, so an old screenshot doesn't spread a few days of spending across weeks of empty days.
  const loggingStart = startOfDay(Math.min(today, ...transactions.map(tx => tx.createdAt || tx.occurredAt)));
  const usualFrom = Math.max(firstDay, loggingStart, addDays(today, -30));
  const usualDays = daysBetween(usualFrom, today);
  const usual = usualDays >= 3 ? totalBetween(spends, usualFrom, today) / usualDays : null;
  const confident = historyDays >= 7;

  const forecast = buildForecast(transactions, spends, budget, pace, spread, confident, now);

  const lastMonthStart = monthStart(today, -1);
  // Only compare with last month if we saw (nearly) all of it.
  const lastMonth =
    firstDay <= addDays(lastMonthStart, 3)
      ? { name: LONG_MONTHS[new Date(lastMonthStart).getMonth()], total: totalBetween(spends, lastMonthStart, monthStart(today)) }
      : null;

  const insights: Insight[] = [];
  if (spends.length > 0) {
    insights.push(forecastInsight(forecast, lastMonth));
  }
  insights.push(
    ...detectPatterns({
      transactions,
      spends,
      credits: creditsOf(transactions),
      today,
      tomorrow,
      firstDay,
      daysTracked,
      history,
      historyStart,
      budget,
      status,
    }),
  );
  if (daysTracked < 7 || spends.length < 5) {
    insights.push({
      id: 'warming-up',
      kind: 'agent',
      score: 10,
      title: 'Your insights are warming up',
      caption: 'Log a week of payments and Spendd will spot your patterns and predict where your month is heading.',
    });
  }
  insights.sort((a, b) => b.score - a.score);

  // Today's allowance: what the budget allows per remaining day, or your usual day.
  let allowance: number | null = null;
  let basis: DailyBudget['basis'] = 'usual';
  if (budget && status?.state === 'active') {
    const spentBeforeToday = status.spent - spentToday;
    allowance = Math.max(0, Math.floor((budget.amount - spentBeforeToday) / status.daysLeft));
    basis = 'budget';
  } else if (usual != null && usual > 0) {
    allowance = Math.round(usual);
  }

  let changeVsUsualPct: number | null = null;
  if (historyDays >= 14) {
    const lastWeek = mean(history.slice(-7));
    const before = mean(history.slice(-35, -7));
    changeVsUsualPct = before > 0 ? pctChange(lastWeek, before) : null;
  }

  const dailyStatus: DailyStatus = {
    safeToSpend: allowance == null ? 0 : Math.max(0, Math.round(allowance - spentToday)),
    spendBelowToday: allowance,
    changeVsUsualPct,
  };

  return {
    forecast,
    insights,
    dailyStatus,
    dailyBudget: allowance ? { amount: allowance, usedFraction: Math.min(1, spentToday / allowance), basis } : null,
    habits: habitsFrom(spends, today),
    headline: headlineFor(forecast, changeVsUsualPct, spends.length > 0),
  };
}

/**
 * The story sentence that opens Home (DESIGN.md §5.3): "how am I doing?" in plain words.
 * With a budget: "₹4,200 left for 9 days. You're on track." Otherwise the week's trend, or a
 * neutral line while there's too little data. Never shaming.
 */
export function headlineFor(f: Forecast, changeVsUsualPct: number | null, hasSpends: boolean): string {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (f.budget != null && f.daysLeft > 0) {
    const left = f.budget - f.spent;
    if (left < 0) {
      return `${formatRupees(-left)} over budget, with ${days(f.daysLeft)} to go. Let's slow down a bit.`;
    }
    return `${formatRupees(left)} left for ${days(f.daysLeft)}. ${f.projected <= f.budget ? 'You’re on track.' : 'Things are a bit tight.'}`;
  }
  if (changeVsUsualPct != null) {
    return changeVsUsualPct <= 0 ? 'You’re spending less than usual this week.' : 'Spending’s a little higher than usual this week.';
  }
  return hasSpends ? 'Add a few more spends and I’ll tell you how the week’s going.' : 'No spends yet. Share your next UPI screenshot to start.';
}

/** Lifetime numbers for the profile page. */
export function lifetimeStats(transactions: Transaction[], now: number = Date.now()) {
  const spends = spendsOf(transactions);
  const today = startOfDay(now);
  const all = summarizeSpending(transactions, -Infinity, Infinity);
  const month = periodFor({ amount: 0, period: 'month' }, now);
  const firstDay = transactions.length ? Math.min(...transactions.map(tx => startOfDay(tx.occurredAt))) : null;
  return {
    totalSpent: all.total,
    thisMonth: totalBetween(spends, month.start, month.end),
    transactions: transactions.length,
    topCategory: all.categories[0]?.category ?? null,
    daysTracked: firstDay == null ? 0 : daysBetween(firstDay, today) + 1,
    since: firstDay,
  };
}
