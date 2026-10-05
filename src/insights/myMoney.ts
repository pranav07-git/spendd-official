import { addDays, startOfDay } from '../transactions/format';
import type { Transaction } from '../transactions/types';
import { approx, creditsOf, median, monthStart, spendsOf, sum, within, type Spend } from './stats';

/** Spending that's easiest to trim; used by the Standpoint score and the savings opportunity. */
export const DISCRETIONARY = ['Food', 'Shopping', 'Entertainment'];
/** Payments small enough to slip by unnoticed. */
export const MICRO_LIMIT = 200;

export type CategoryChange = {
  category: string;
  amount: number;
  /** Same days of the previous month. */
  previous: number;
  /** % vs the same days of the previous month; null when there was nothing to compare. */
  changePct: number | null;
};

export type Moment = { tx: Spend; when: 'EARLY' | 'MID' | 'LATE' };

export type TimelineEvent = { tx: Spend; title: string; tone: 'highlight' | 'regular' };

export type Standpoint = {
  /** 0–100. 60% savings rate (30%+ of income saved is full marks), 40% discretionary share. */
  score: number;
  savings: number;
  lifestyle: number;
  savingsLabel: 'POSITIVE' | 'NEGATIVE';
  lifestyleLabel: 'BALANCED' | 'NEEDS WORK';
};

export type MyMoney = {
  /** First day of the month shown, and of the next month. */
  from: number;
  to: number;
  isCurrentMonth: boolean;
  income: number;
  spending: number;
  savings: number;
  /** Spending over the same days of the previous month. */
  prevSpending: number;
  /** Spending vs the same days of the previous month; null without data to compare. */
  vsLastMonthPct: number | null;
  /** All categories with spending, biggest first. */
  categories: CategoryChange[];
  moments: Moment[];
  /** Null without income to measure savings against. */
  standpoint: Standpoint | null;
  micro: { total: number; count: number };
  opportunity: { category: string; monthlySaving: number } | null;
  timeline: TimelineEvent[];
  guidance: string | null;
  hasData: boolean;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const pct = (now: number, before: number) => Math.round(((now - before) / before) * 100);

function momentOf(timestamp: number): Moment['when'] {
  const day = new Date(timestamp).getDate();
  return day <= 10 ? 'EARLY' : day <= 20 ? 'MID' : 'LATE';
}

function timelineTitle(tx: Spend): string {
  if (tx.direction === 'credit') {
    return tx.category === 'Personal' || tx.category === 'Other'
      ? `Received from ${tx.counterparty ?? 'someone'}`
      : `${tx.category} Credited`;
  }
  if (tx.category === 'Rent') {
    return 'Rent Paid';
  }
  return tx.counterparty ?? tx.note ?? tx.category;
}

/**
 * Everything the My Money screen shows for one calendar month. For the month in progress, every
 * comparison uses the same number of days of the previous month, so the 5th isn't compared with
 * a whole month.
 */
export function buildMyMoney(transactions: Transaction[], month: number, now: number = Date.now()): MyMoney {
  const from = monthStart(month);
  const to = monthStart(month, 1);
  const isCurrentMonth = now >= from && now < to;
  const periodEnd = isCurrentMonth ? addDays(startOfDay(now), 1) : to;

  const prevFrom = monthStart(month, -1);
  const prevEnd = Math.min(prevFrom + (periodEnd - from), from);

  const spends = spendsOf(transactions);
  const credits = creditsOf(transactions);
  const monthSpends = within(spends, from, periodEnd);
  const monthCredits = within(credits, from, periodEnd);
  const prevSpends = within(spends, prevFrom, prevEnd);

  const income = sum(monthCredits.map(tx => tx.amount));
  const spending = sum(monthSpends.map(tx => tx.amount));
  const savings = income - spending;
  const prevSpending = sum(prevSpends.map(tx => tx.amount));
  const vsLastMonthPct = prevSpending > 0 && spending > 0 ? pct(spending, prevSpending) : null;

  // Categories, with the same-days change.
  const totals = (txs: Spend[]) => {
    const map = new Map<string, number>();
    txs.forEach(tx => map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount));
    return map;
  };
  const current = totals(monthSpends);
  const previous = totals(prevSpends);
  const categories = [...current.entries()]
    .map(([category, amount]) => {
      const before = previous.get(category) ?? 0;
      return { category, amount, previous: before, changePct: before > 0 ? pct(amount, before) : null };
    })
    .sort((a, b) => b.amount - a.amount);

  // Major moments: payments well above the month's typical one, topped up with the month's
  // biggest payments so there are always at least two to show.
  const typical = median(monthSpends.map(tx => tx.amount));
  const bySize = [...monthSpends].sort((a, b) => b.amount - a.amount);
  const standouts = bySize.filter(tx => tx.amount >= Math.max(typical * 3, 1000)).slice(0, 3);
  const moments = (standouts.length >= 2 ? standouts : bySize.slice(0, 2)).map(tx => ({ tx, when: momentOf(tx.occurredAt) }));

  // Standpoint.
  const discretionary = sum(categories.filter(c => DISCRETIONARY.includes(c.category)).map(c => c.amount));
  let standpoint: Standpoint | null = null;
  if (income > 0) {
    const savingsPart = clamp01(savings / income / 0.3);
    const share = spending > 0 ? discretionary / spending : 0;
    const lifestylePart = clamp01((0.6 - share) / 0.4);
    standpoint = {
      score: Math.round(100 * (0.6 * savingsPart + 0.4 * lifestylePart)),
      savings: savingsPart,
      lifestyle: lifestylePart,
      savingsLabel: savings > 0 ? 'POSITIVE' : 'NEGATIVE',
      lifestyleLabel: lifestylePart >= 0.5 ? 'BALANCED' : 'NEEDS WORK',
    };
  }

  const micro = monthSpends.filter(tx => tx.amount < MICRO_LIMIT);

  // Savings opportunity: trim the biggest discretionary category by a fifth, over a full month.
  const elapsedDays = Math.max(1, Math.round((periodEnd - from) / 86_400_000));
  const daysInMonth = Math.round((to - from) / 86_400_000);
  const biggestDiscretionary = categories.find(c => DISCRETIONARY.includes(c.category));
  const monthlySaving = biggestDiscretionary
    ? approx((biggestDiscretionary.amount / elapsedDays) * daysInMonth * 0.2)
    : 0;
  const opportunity =
    biggestDiscretionary && monthlySaving >= 100 ? { category: biggestDiscretionary.category, monthlySaving } : null;

  // Timeline: income, fixed costs and the major moments, in date order.
  const momentIds = new Set(moments.map(m => m.tx.id));
  const notable = [
    ...monthCredits.filter(tx => tx.amount >= 1000 || tx.category === 'Salary'),
    ...monthSpends.filter(tx => ['Rent', 'Bills', 'Education'].includes(tx.category) || momentIds.has(tx.id)),
  ];
  // A quiet month still gets a timeline: top it up with the month's largest payments.
  const events = [...new Map(notable.map(tx => [tx.id, tx])).values()];
  if (events.length < 4) {
    const extra = [...monthCredits, ...monthSpends]
      .filter(tx => !events.some(e => e.id === tx.id))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4 - events.length);
    events.push(...extra);
  }
  const timeline = events
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .slice(0, 6)
    .map(tx => ({
      tx,
      title: timelineTitle(tx),
      tone: (tx.direction === 'credit' || momentIds.has(tx.id) ? 'highlight' : 'regular') as TimelineEvent['tone'],
    }));

  // Guidance: carry the month's trend forward a year.
  let guidance: string | null = null;
  if (vsLastMonthPct !== null && Math.abs(vsLastMonthPct) >= 2) {
    const yearly = approx(Math.abs(prevSpending - spending) * (daysInMonth / elapsedDays) * 12);
    guidance =
      vsLastMonthPct < 0
        ? `If you continue this trend, you could save ₹${yearly.toLocaleString('en-IN')} more this year.`
        : `You're spending ${vsLastMonthPct}% more than last month. Holding it level would keep ₹${yearly.toLocaleString(
            'en-IN',
          )} in your pocket this year.`;
  } else if (opportunity) {
    guidance = `Cutting ${opportunity.category.toLowerCase()} by a fifth would save about ₹${(
      opportunity.monthlySaving * 12
    ).toLocaleString('en-IN')} a year.`;
  } else if (savings > 0) {
    guidance = `You're on track to save ₹${approx(savings).toLocaleString('en-IN')} this month. Keep it up.`;
  } else if (spending > 0) {
    guidance = `You've spent ₹${Math.round(spending).toLocaleString('en-IN')} so far. Log every payment and Spendd will show where the month is heading.`;
  }

  return {
    from,
    to,
    isCurrentMonth,
    income,
    spending,
    savings,
    prevSpending,
    vsLastMonthPct,
    categories,
    moments,
    standpoint,
    micro: { total: sum(micro.map(tx => tx.amount)), count: micro.length },
    opportunity,
    timeline,
    guidance,
    hasData: monthSpends.length + monthCredits.length > 0,
  };
}

/** "You spent 12% less than last month." — or this time last month, mid-month. */
export function comparisonLine(m: MyMoney): string | null {
  if (m.vsLastMonthPct === null) {
    return null;
  }
  const when = m.isCurrentMonth ? 'this time last month' : 'last month';
  if (Math.abs(m.vsLastMonthPct) < 2) {
    return `You spent about the same as ${when}.`;
  }
  return `You spent ${Math.abs(m.vsLastMonthPct)}% ${m.vsLastMonthPct < 0 ? 'less' : 'more'} than ${when}.`;
}
