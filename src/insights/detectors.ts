/**
 * Each detector looks for one pattern in the user's money and returns an insight (or none).
 * They only ever state facts computed from transactions, so an AI can rephrase
 * and combine them without having to do any maths itself.
 */
import type { Budget, BudgetStatus } from '../transactions/budget';
import {
  addDays,
  daysBetween,
  formatDayMonth,
  formatRupees,
  LONG_MONTHS,
  startOfDay,
  titleFor,
  WEEKDAYS,
} from '../transactions/format';
import type { Transaction } from '../transactions/types';
import {
  approx,
  byPayee,
  categoryTotals,
  dailyTotals,
  mean,
  median,
  monthStart,
  pctChange,
  stdDev,
  sum,
  totalBetween,
  within,
  type Spend,
} from './stats';
import type { Insight } from './types';

export type Ctx = {
  transactions: Transaction[];
  spends: Spend[];
  credits: Spend[];
  today: number;
  tomorrow: number;
  /** First day with any spending. */
  firstDay: number;
  daysTracked: number;
  /** Spend per full day before today, oldest first (up to 60 days). */
  history: number[];
  historyStart: number;
  budget: Budget | null;
  status: BudgetStatus | null;
};

export type Detector = (c: Ctx) => Insight | Insight[] | null;

/** Discretionary categories, with a concrete way to spend ~20% less on each. */
export const TIPS: Record<string, string> = {
  Food: 'Cooking at home a couple of nights a week',
  Groceries: 'Planning meals and shopping with a list',
  Shopping: 'Waiting 48 hours before non-essential buys',
  Entertainment: 'Dropping one subscription or outing a week',
  Travel: 'Taking the metro or pooling rides a few times a week',
};

const rupees = (n: number) => formatRupees(approx(n));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const last30 = (c: Ctx) => [addDays(c.today, -29), c.tomorrow] as const;
const prev30 = (c: Ctx) => [addDays(c.today, -59), addDays(c.today, -29)] as const;
const displayName = (txs: Spend[]) => txs[txs.length - 1].counterparty!.trim();

// ---------------------------------------------------------------- category trends

export const categoryTrends: Detector = c => {
  if (c.daysTracked < 45) {
    return null;
  }
  const recent = categoryTotals(c.spends, ...last30(c));
  const before = categoryTotals(c.spends, ...prev30(c));
  const out: Insight[] = [];
  recent.forEach((now, category) => {
    const prev = before.get(category) ?? 0;
    if (prev >= 300 && now >= prev * 1.3 && now - prev >= 500) {
      const pct = pctChange(now, prev);
      out.push({
        id: `up-${category}`,
        kind: 'alert',
        score: 60 + Math.min(30, pct / 10),
        title: `${category} spending is up ${pct}%`,
        caption: `${rupees(now)} in the last 30 days vs ${rupees(prev)} the month before.`,
      });
    }
  });
  before.forEach((prev, category) => {
    const now = recent.get(category) ?? 0;
    if (prev >= 1000 && now <= prev * 0.7) {
      out.push({
        id: `down-${category}`,
        kind: 'win',
        score: 50,
        title: `You cut ${category} spending by ${Math.abs(pctChange(now, prev))}%`,
        caption: `${rupees(prev)} → ${rupees(now)} over the last 30 days. Nice work.`,
      });
    }
  });
  return out;
};

/** The biggest discretionary category and how much a realistic cut would save. */
export const topCategory: Detector = c => {
  const totals = categoryTotals(c.spends, ...last30(c));
  const total = sum([...totals.values()]);
  if (total < 1000) {
    return null;
  }
  const [category, amount] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = amount / total;
  const tip = TIPS[category];
  if (share < 0.35 || !tip) {
    return null;
  }
  return {
    id: `top-${category}`,
    kind: 'agent',
    score: 55 + share * 20,
    title: `${category} took ${Math.round(share * 100)}% of your spending`,
    caption: `${rupees(amount)} in the last 30 days. ${tip} could save about ${rupees(amount * 0.2)} a month.`,
  };
};

/** A yearly "what if" for a discretionary category that topCategory didn't already cover. */
export const cutScenario: Detector = c => {
  const totals = categoryTotals(c.spends, ...last30(c));
  const total = sum([...totals.values()]);
  const ranked = [...totals.entries()].filter(([cat]) => TIPS[cat]).sort((a, b) => b[1] - a[1]);
  const all = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  // topCategory fires when the overall #1 is discretionary with ≥35% share.
  const coveredByTop = all[0] && TIPS[all[0][0]] && total > 0 && all[0][1] / total >= 0.35 ? all[0][0] : null;
  const pick = ranked.find(([cat, amount]) => cat !== coveredByTop && amount >= 1000);
  if (!pick || c.daysTracked < 14) {
    return null;
  }
  const [category, monthly] = pick;
  return {
    id: `cut-${category}`,
    kind: 'agent',
    score: 32,
    title: `Cutting ${category} by a quarter saves ${rupees(monthly * 0.25 * 12)} a year`,
    caption: `You spend about ${rupees(monthly)} a month on ${category.toLowerCase()}. ${TIPS[category]} is an easy start.`,
  };
};

/** Bigger payments rather than more of them. */
export const avgTicketRise: Detector = c => {
  if (c.daysTracked < 45) {
    return null;
  }
  const recent = within(c.spends, ...last30(c));
  const before = within(c.spends, ...prev30(c));
  let best: Insight | null = null;
  let bestPct = 0;
  new Set(recent.map(tx => tx.category)).forEach(category => {
    const now = recent.filter(tx => tx.category === category).map(tx => tx.amount);
    const prev = before.filter(tx => tx.category === category).map(tx => tx.amount);
    if (now.length < 4 || prev.length < 4 || now.length > prev.length * 1.1) {
      return;
    }
    const avgNow = mean(now);
    const avgPrev = mean(prev);
    const pct = pctChange(avgNow, avgPrev);
    if (avgNow >= avgPrev * 1.25 && avgNow - avgPrev >= 50 && pct > bestPct) {
      bestPct = pct;
      best = {
        id: `ticket-${category}`,
        kind: 'agent',
        score: 44,
        title: `Your average ${category.toLowerCase()} payment is up ${pct}%`,
        caption: `${rupees(avgNow)} per payment now vs ${rupees(avgPrev)} before, with no more payments than usual. Smaller orders would add up.`,
      };
    }
  });
  return best;
};

/** Projects each category to month end and compares with last month. */
export const categoryForecast: Detector = c => {
  const thisStart = monthStart(c.today);
  const lastStart = monthStart(c.today, -1);
  const elapsed = daysBetween(thisStart, c.today) + 1;
  const monthDays = daysBetween(thisStart, monthStart(c.today, 1));
  if (elapsed < 7 || c.firstDay > addDays(lastStart, 3)) {
    return null;
  }
  const now = categoryTotals(c.spends, thisStart, c.tomorrow);
  const last = categoryTotals(c.spends, lastStart, thisStart);
  let best: Insight | null = null;
  let bestGap = 0;
  now.forEach((mtd, category) => {
    const projected = (mtd / elapsed) * monthDays;
    const prev = last.get(category) ?? 0;
    const gap = projected - prev;
    if (prev >= 500 && projected >= prev * 1.3 && gap >= 1000 && gap > bestGap) {
      bestGap = gap;
      best = {
        id: `cat-forecast-${category}`,
        kind: 'alert',
        score: 57,
        title: `At this rate, ${category} will hit ${rupees(projected)} this month`,
        caption: `That’s ${rupees(gap)} more than ${LONG_MONTHS[new Date(lastStart).getMonth()]}’s ${rupees(prev)}.`,
      };
    }
  });
  return best;
};

export const newCategory: Detector = c => {
  const thisStart = monthStart(c.today);
  if (c.firstDay > addDays(thisStart, -30)) {
    return null;
  }
  const now = categoryTotals(c.spends, thisStart, c.tomorrow);
  const before = categoryTotals(c.spends, addDays(thisStart, -60), thisStart);
  const fresh = [...now.entries()].filter(([cat, amount]) => amount >= 1000 && !before.has(cat)).sort((a, b) => b[1] - a[1])[0];
  if (!fresh) {
    return null;
  }
  return {
    id: `new-${fresh[0]}`,
    kind: 'agent',
    score: 33,
    title: `New this month: ${rupees(fresh[1])} on ${fresh[0]}`,
    caption: `You hadn’t spent on ${fresh[0].toLowerCase()} in the two months before. A one-off, or a new habit?`,
  };
};

export const uncategorized: Detector = c => {
  const totals = categoryTotals(c.spends, ...last30(c));
  const total = sum([...totals.values()]);
  const other = totals.get('Other') ?? 0;
  if (other < 1000 || other / total < 0.2) {
    return null;
  }
  return {
    id: 'uncategorized',
    kind: 'agent',
    score: 25,
    title: `${rupees(other)} is filed under Other`,
    caption: `That’s ${Math.round((other / total) * 100)}% of the last 30 days. Recategorise those payments for sharper insights.`,
  };
};

// ---------------------------------------------------------------- time & rhythm

export const monthToDate: Detector = c => {
  const thisStart = monthStart(c.today);
  const lastStart = monthStart(c.today, -1);
  const elapsed = daysBetween(thisStart, c.today) + 1;
  if (elapsed < 5 || c.firstDay > addDays(lastStart, 3)) {
    return null;
  }
  const now = totalBetween(c.spends, thisStart, c.tomorrow);
  const then = totalBetween(c.spends, lastStart, Math.min(addDays(lastStart, elapsed), thisStart));
  if (then < 500) {
    return null;
  }
  const pct = pctChange(now, then);
  if (Math.abs(pct) < 15) {
    return null;
  }
  const lastMonth = LONG_MONTHS[new Date(lastStart).getMonth()];
  return {
    id: 'month-to-date',
    kind: pct > 0 ? 'alert' : 'win',
    score: 58,
    title: pct > 0 ? `${rupees(now - then)} more than this time last month` : `${rupees(then - now)} less than this time last month`,
    caption: `${rupees(now)} so far this month vs ${rupees(then)} by the same day of ${lastMonth}.`,
  };
};

export const weekOverWeek: Detector = c => {
  if (c.history.length < 14) {
    return null;
  }
  const lastWeek = sum(c.history.slice(-7));
  const before = sum(c.history.slice(-14, -7));
  if (before < 300) {
    return null;
  }
  const pct = pctChange(lastWeek, before);
  if (Math.abs(pct) < 25 || Math.abs(lastWeek - before) < 500) {
    return null;
  }
  return {
    id: 'week-over-week',
    kind: pct > 0 ? 'alert' : 'win',
    score: 48,
    title: pct > 0 ? `Your last 7 days cost ${pct}% more than the week before` : `You spent ${-pct}% less than the week before`,
    caption: `${rupees(lastWeek)} in the last 7 days vs ${rupees(before)} in the 7 days before.`,
  };
};

export const weekend: Detector = c => {
  const days = c.history.slice(-56);
  const start = addDays(c.historyStart, c.history.length - days.length);
  const weekendDays: number[] = [];
  const weekdays: number[] = [];
  days.forEach((total, i) => {
    const dow = new Date(addDays(start, i)).getDay();
    (dow === 0 || dow === 6 ? weekendDays : weekdays).push(total);
  });
  if (weekendDays.length < 4 || weekdays.length < 10) {
    return null;
  }
  const we = mean(weekendDays);
  const wd = mean(weekdays);
  if (wd <= 0 || we < wd * 1.5 || we - wd < 200) {
    return null;
  }
  return {
    id: 'weekend',
    kind: 'agent',
    score: 45,
    title: `You spend ${(we / wd).toFixed(1)}× more on weekends`,
    caption: `About ${rupees(we)} a weekend day vs ${rupees(wd)} on weekdays. A weekend limit of ${rupees(wd * 1.25)} a day would close the gap.`,
  };
};

/** The most expensive Monday–Friday (weekends are covered above). */
export const priciestWeekday: Detector = c => {
  if (c.history.length < 28) {
    return null;
  }
  const days = c.history.slice(-56);
  const start = addDays(c.historyStart, c.history.length - days.length);
  const byDow: number[][] = [[], [], [], [], [], [], []];
  days.forEach((total, i) => byDow[new Date(addDays(start, i)).getDay()].push(total));
  let top = -1;
  for (let d = 1; d <= 5; d++) {
    if (top === -1 || mean(byDow[d]) > mean(byDow[top])) {
      top = d;
    }
  }
  const topAvg = mean(byDow[top]);
  const others = mean(byDow.filter((_, d) => d !== top).flat());
  if (others <= 0 || topAvg < others * 1.4 || topAvg - others < 150) {
    return null;
  }
  return {
    id: 'priciest-weekday',
    kind: 'agent',
    score: 35,
    title: `${WEEKDAYS[top]}s are your priciest weekday`,
    caption: `About ${rupees(topAvg)} on an average ${WEEKDAYS[top]} vs ${rupees(others)} on other days.`,
  };
};

export const lateNight: Detector = c => {
  const recent = within(c.spends, ...last30(c));
  const late = recent.filter(tx => {
    const h = new Date(tx.occurredAt).getHours();
    return tx.hasTime && (h >= 22 || h < 5);
  });
  const total = sum(late.map(tx => tx.amount));
  if (late.length < 4 || total < 500 || total < 0.15 * sum(recent.map(tx => tx.amount))) {
    return null;
  }
  const cats = categoryTotals(late, -Infinity, Infinity);
  const topCat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return {
    id: 'late-night',
    kind: 'agent',
    score: 45,
    title: `${rupees(total)} spent late at night`,
    caption: `${plural(late.length, 'payment')} after 10 PM in the last 30 days, mostly on ${topCat.toLowerCase()}. Late-night buys are the easiest to skip.`,
  };
};

export const noSpendDays: Detector = c => {
  const from = Math.max(monthStart(c.today), c.firstDay);
  const zero = dailyTotals(c.spends, from, daysBetween(from, c.today)).filter(total => total === 0).length;
  if (zero < 3) {
    return null;
  }
  return {
    id: 'no-spend',
    kind: 'win',
    score: 30,
    title: `${zero} no-spend days this month`,
    caption: 'Days with nothing spent add up fast. Keep the streak going.',
  };
};

// ---------------------------------------------------------------- income & budget

export const savingsRate: Detector = c => {
  const income = totalBetween(c.credits, ...last30(c));
  if (income < 1000 || c.daysTracked < 14) {
    return null;
  }
  const spent = totalBetween(c.spends, ...last30(c));
  const rate = Math.round(((income - spent) / income) * 100);
  if (spent > income) {
    return {
      id: 'savings-rate',
      kind: 'alert',
      score: 85,
      title: `You spent ${rupees(spent - income)} more than came in`,
      caption: `${rupees(spent)} out vs ${rupees(income)} in over the last 30 days. Trim your biggest category first.`,
    };
  }
  if (rate >= 20) {
    return {
      id: 'savings-rate',
      kind: 'win',
      score: 50,
      title: `You kept ${rate}% of what came in`,
      caption: `${rupees(income - spent)} of ${rupees(income)} stayed with you over the last 30 days.`,
    };
  }
  return {
    id: 'savings-rate',
    kind: 'agent',
    score: 45,
    title: `You’re saving ${rate}% of your income`,
    caption: `Getting to 20% means spending ${rupees(income * 0.2 - (income - spent))} less a month.`,
  };
};

export const paydayEffect: Detector = c => {
  const pay = c.credits
    .filter(tx => tx.category === 'Salary' && tx.occurredAt >= addDays(c.today, -45) && tx.occurredAt < addDays(c.today, -7))
    .sort((a, b) => b.occurredAt - a.occurredAt)[0];
  if (!pay) {
    return null;
  }
  const payDay = startOfDay(pay.occurredAt);
  const weekAfter = totalBetween(c.spends, payDay, addDays(payDay, 7));
  const windowStart = addDays(c.today, -30);
  const baseline = dailyTotals(c.spends, windowStart, 30).filter((_, i) => {
    const day = addDays(windowStart, i);
    return day < payDay || day >= addDays(payDay, 7);
  });
  const normalWeek = mean(baseline) * 7;
  if (normalWeek <= 0 || weekAfter < normalWeek * 1.5 || weekAfter - normalWeek < 1000) {
    return null;
  }
  return {
    id: 'payday',
    kind: 'alert',
    score: 55,
    title: `Payday week cost ${(weekAfter / normalWeek).toFixed(1)}× a normal week`,
    caption: `${rupees(weekAfter)} in the 7 days after your salary on ${formatDayMonth(payDay)}, vs about ${rupees(normalWeek)} usually. Move savings out on payday.`,
  };
};

/** Consecutive days (ending yesterday) under the budget's even daily share. */
export const budgetStreak: Detector = c => {
  if (!c.budget || c.status?.state !== 'active') {
    return null;
  }
  const { start, end } = c.status.period;
  const perDay = c.budget.amount / daysBetween(start, end);
  let streak = 0;
  for (let i = c.history.length - 1; i >= 0; i--) {
    const day = addDays(c.historyStart, i);
    if (day < start || day < c.firstDay || c.history[i] > perDay) {
      break;
    }
    streak++;
  }
  if (streak < 3) {
    return null;
  }
  return {
    id: 'budget-streak',
    kind: 'win',
    score: 40,
    title: `${streak} days in a row under your daily budget`,
    caption: `Each day stayed under ${rupees(perDay)}. Keep it going.`,
  };
};

// ---------------------------------------------------------------- payments & payees

export const outlier: Detector = c => {
  const weekAgo = addDays(c.today, -6);
  const baseline = within(c.spends, addDays(c.today, -90), weekAgo).map(tx => tx.amount);
  if (baseline.length < 10) {
    return null;
  }
  const typical = median(baseline);
  const threshold = Math.max(typical * 4, mean(baseline) + 3 * stdDev(baseline), 1000);
  const big = c.spends.filter(tx => tx.occurredAt >= weekAgo && tx.amount >= threshold).sort((a, b) => b.amount - a.amount)[0];
  if (!big) {
    return null;
  }
  return {
    id: `outlier-${big.id}`,
    kind: 'alert',
    score: 65,
    title: `Unusually large payment: ${formatRupees(big.amount)}`,
    caption: `${titleFor(big)} on ${formatDayMonth(big.occurredAt)}. That’s ${Math.round(big.amount / typical)}× your typical payment.`,
  };
};

export const bigTickets: Detector = c => {
  const month = within(c.spends, monthStart(c.today), c.tomorrow).sort((a, b) => b.amount - a.amount);
  const total = sum(month.map(tx => tx.amount));
  if (month.length < 6 || total < 3000) {
    return null;
  }
  const share = sum(month.slice(0, 3).map(tx => tx.amount)) / total;
  if (share < 0.5) {
    return null;
  }
  return {
    id: 'big-tickets',
    kind: 'agent',
    score: 38,
    title: `3 payments made up ${Math.round(share * 100)}% of this month`,
    caption: `The biggest was ${formatRupees(month[0].amount)} (${titleFor(month[0])}). Planning big buys matters more than cutting small ones.`,
  };
};

export const smallSpends: Detector = c => {
  const small = within(c.spends, ...last30(c)).filter(tx => tx.amount < 200);
  if (small.length < 15) {
    return null;
  }
  const total = sum(small.map(tx => tx.amount));
  return {
    id: 'small-spends',
    kind: 'agent',
    score: 35,
    title: `${small.length} small payments added up to ${rupees(total)}`,
    caption: `All under ₹200 in the last 30 days. Easy to miss, but that’s about ${rupees(total * 12)} a year.`,
  };
};

export const regularMerchant: Detector = c => {
  const groups = [...byPayee(within(c.spends, ...last30(c))).values()].sort((a, b) => b.length - a.length);
  const top = groups[0];
  if (!top || top.length < 5) {
    return null;
  }
  const total = sum(top.map(tx => tx.amount));
  return {
    id: 'regular-merchant',
    kind: 'agent',
    score: 50,
    title: `You paid ${displayName(top)} ${top.length} times in 30 days`,
    caption: `${rupees(total)} in total, about ${rupees(total / top.length)} each time. Skipping every other one saves ${rupees(total / 2)} a month.`,
  };
};

/** Same payee, similar amount, roughly a month apart, at least twice. */
export function recurringPayments(spends: Spend[]): { name: string; amount: number; next: number }[] {
  const found: { name: string; amount: number; next: number }[] = [];
  byPayee(spends).forEach(txs => {
    if (txs.length < 2) {
      return;
    }
    const sorted = [...txs].sort((a, b) => a.occurredAt - b.occurredAt);
    const typical = median(sorted.map(tx => tx.amount));
    const similar = sorted.filter(tx => Math.abs(tx.amount - typical) <= typical * 0.1);
    const monthly = similar.some((tx, i) => {
      const gap = i > 0 ? daysBetween(startOfDay(similar[i - 1].occurredAt), startOfDay(tx.occurredAt)) : 0;
      return gap >= 25 && gap <= 35;
    });
    if (monthly) {
      const last = similar[similar.length - 1];
      found.push({ name: last.counterparty!.trim(), amount: Math.round(typical), next: addDays(startOfDay(last.occurredAt), 30) });
    }
  });
  return found.sort((a, b) => b.amount - a.amount);
}

export const recurring: Detector = c => {
  const repeats = recurringPayments(c.spends);
  const out: Insight[] = repeats.slice(0, 2).map(r => ({
    id: `recurring-${r.name}`,
    kind: 'agent' as const,
    score: 40,
    title: `${r.name} looks like a monthly payment`,
    caption: `About ${formatRupees(r.amount)} a month, or ${formatRupees(r.amount * 12)} a year. Next one expected around ${formatDayMonth(r.next)}.`,
  }));
  if (repeats.length >= 2) {
    const monthly = sum(repeats.map(r => r.amount));
    const names = repeats.slice(0, 2).map(r => r.name);
    out.push({
      id: 'recurring-total',
      kind: 'agent',
      score: 42,
      title: `Regular payments cost ${formatRupees(monthly)} a month`,
      caption: `${plural(repeats.length, 'repeat payment')}, like ${names.join(' and ')}. That’s ${formatRupees(monthly * 12)} a year, so cancel what you don’t use.`,
    });
  }
  return out;
};

/** A monthly payment whose latest amount went up. */
export const priceCreep: Detector = c => {
  let best: Insight | null = null;
  let bestDiff = 0;
  byPayee(c.spends).forEach(txs => {
    if (txs.length < 2) {
      return;
    }
    const sorted = [...txs].sort((a, b) => a.occurredAt - b.occurredAt);
    const [prev, last] = sorted.slice(-2);
    const gap = daysBetween(startOfDay(prev.occurredAt), startOfDay(last.occurredAt));
    const diff = last.amount - prev.amount;
    if (gap >= 25 && gap <= 35 && last.amount >= prev.amount * 1.05 && last.amount <= prev.amount * 1.6 && diff >= 20 && diff > bestDiff) {
      bestDiff = diff;
      best = {
        id: `price-${last.counterparty!.trim().toLowerCase()}`,
        kind: 'alert',
        score: 52,
        title: `${last.counterparty!.trim()} went up from ${formatRupees(prev.amount)} to ${formatRupees(last.amount)}`,
        caption: `That’s ${formatRupees(Math.round(diff * 12))} more a year. Check if a cheaper plan works for you.`,
      };
    }
  });
  return best;
};

export const duplicates: Detector = c => {
  const recent = within(c.spends, addDays(c.today, -13), c.tomorrow).sort((a, b) => a.occurredAt - b.occurredAt);
  for (let i = 1; i < recent.length; i++) {
    const [a, b] = [recent[i - 1], recent[i]];
    const samePayee = a.counterparty && a.counterparty.trim().toLowerCase() === b.counterparty?.trim().toLowerCase();
    const differentRefs = !a.txnRef || !b.txnRef || a.txnRef !== b.txnRef;
    if (samePayee && a.amount === b.amount && a.hasTime && b.hasTime && b.occurredAt - a.occurredAt <= 10 * 60 * 1000 && differentRefs) {
      return {
        id: `duplicate-${b.id}`,
        kind: 'alert',
        score: 75,
        title: `Possible double payment to ${b.counterparty!.trim()}`,
        caption: `Two payments of ${formatRupees(b.amount)} on ${formatDayMonth(b.occurredAt)}, minutes apart. Check with your bank if you only meant to pay once.`,
      };
    }
  }
  return null;
};

export const needsReview: Detector = c => {
  const n = c.transactions.filter(tx => tx.amount == null).length;
  if (n === 0) {
    return null;
  }
  return {
    id: 'needs-review',
    kind: 'alert',
    score: 70,
    title: `${plural(n, 'payment')} ${n === 1 ? 'needs' : 'need'} an amount`,
    caption: `Spendd couldn’t read ${n === 1 ? 'it' : 'them'} from the screenshot. Add the amount in Transactions so your totals are right.`,
  };
};

export const cashShare: Detector = c => {
  const recent = within(c.spends, ...last30(c));
  const cash = sum(recent.filter(tx => tx.source === 'Cash').map(tx => tx.amount));
  const total = sum(recent.map(tx => tx.amount));
  if (cash < 1000 || cash / total < 0.3) {
    return null;
  }
  return {
    id: 'cash',
    kind: 'agent',
    score: 20,
    title: `${Math.round((cash / total) * 100)}% of your spending is cash`,
    caption: `${rupees(cash)} in the last 30 days. Cash is easy to lose track of, so log it as you go.`,
  };
};

export const DETECTORS: Detector[] = [
  needsReview,
  duplicates,
  savingsRate,
  categoryTrends,
  categoryForecast,
  monthToDate,
  outlier,
  topCategory,
  paydayEffect,
  priceCreep,
  regularMerchant,
  weekOverWeek,
  weekend,
  lateNight,
  avgTicketRise,
  recurring,
  budgetStreak,
  bigTickets,
  priciestWeekday,
  smallSpends,
  newCategory,
  cutScenario,
  noSpendDays,
  uncategorized,
  cashShare,
];
