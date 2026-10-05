/**
 * The eight fixed parameters Spendd's AI writes about. Every number is computed here, on the
 * phone, from logged transactions; the server and the model only word them. Mirrors
 * server/src/contract.ts.
 *
 * Only totals, category names and merchant names leave the phone: never screenshots, raw
 * transactions, UPI IDs, or the names of people paid.
 */
import type { Budget } from '../transactions/budget';
import { formatDayMonth, formatRupees, LONG_MONTHS } from '../transactions/format';
import type { Transaction } from '../transactions/types';
import { recurringPayments } from './engine';
import { buildMyMoney, MICRO_LIMIT } from './myMoney';
import { monthStart, spendsOf, within } from './stats';
import type { InsightsReport } from './types';

export const PARAMETERS = [
  'spending_trend',
  'top_category',
  'fastest_growing',
  'savings_rate',
  'recurring',
  'small_spends',
  'biggest_payment',
  'budget_pace',
] as const;
export type Parameter = (typeof PARAMETERS)[number];

export type Fact = { parameter: Parameter; summary: string; values: Record<string, number | string> };

const rupees = (n: number) => formatRupees(Math.round(n));

/** The facts for the month in progress; a parameter without enough data is left out. */
export function buildFacts(
  transactions: Transaction[],
  report: InsightsReport,
  budget: Budget | null,
  now: number = Date.now(),
): Fact[] {
  const m = buildMyMoney(transactions, now, now);
  const month = LONG_MONTHS[new Date(now).getMonth()];
  const facts: Fact[] = [];
  const merchantNames = new Set(
    transactions.filter(tx => tx.kind === 'merchant' && tx.counterparty).map(tx => tx.counterparty!.trim()),
  );

  if (m.vsLastMonthPct !== null) {
    const p = m.vsLastMonthPct;
    facts.push({
      parameter: 'spending_trend',
      summary: `You've spent ${rupees(m.spending)} so far in ${month}, ${Math.abs(p)}% ${
        p < 0 ? 'less' : 'more'
      } than the same days last month (${rupees(m.prevSpending)}).`,
      values: { spent: Math.round(m.spending), lastMonthSameDays: Math.round(m.prevSpending), changePct: p },
    });
  }

  const top = m.categories[0];
  if (top && m.spending > 0) {
    const share = Math.round((top.amount / m.spending) * 100);
    facts.push({
      parameter: 'top_category',
      summary: `${top.category} is your biggest category in ${month}: ${rupees(top.amount)}, ${share}% of your spending.`,
      values: { category: top.category, amount: Math.round(top.amount), sharePct: share },
    });
  }

  const rising = m.categories
    .filter(c => c.changePct !== null && c.changePct > 0 && c.amount >= 200)
    .sort((a, b) => b.amount - b.previous - (a.amount - a.previous))[0];
  if (rising) {
    facts.push({
      parameter: 'fastest_growing',
      summary: `${rising.category} is up ${rising.changePct}% on the same days last month: ${rupees(rising.amount)} against ${rupees(
        rising.previous,
      )}.`,
      values: {
        category: rising.category,
        amount: Math.round(rising.amount),
        lastMonthSameDays: Math.round(rising.previous),
        changePct: rising.changePct!,
      },
    });
  }

  if (m.income > 0) {
    const rate = Math.round((m.savings / m.income) * 100);
    facts.push({
      parameter: 'savings_rate',
      summary:
        m.savings >= 0
          ? `You've earned ${rupees(m.income)} and spent ${rupees(m.spending)} in ${month}, keeping ${rupees(m.savings)} (${rate}% of income).`
          : `You've earned ${rupees(m.income)} but spent ${rupees(m.spending)} in ${month}, ${rupees(-m.savings)} more than came in.`,
      values: { income: Math.round(m.income), spent: Math.round(m.spending), saved: Math.round(m.savings), savingsRatePct: rate },
    });
  }

  const repeats = recurringPayments(spendsOf(transactions));
  if (repeats.length > 0) {
    const total = repeats.reduce((sum, r) => sum + r.amount, 0);
    const next = [...repeats].sort((a, b) => a.next - b.next)[0];
    // People's names stay on the phone; merchants (Netflix, Airtel…) can be named.
    const nextName = merchantNames.has(next.name) ? next.name : 'the next one';
    facts.push({
      parameter: 'recurring',
      summary: `${repeats.length} payment${repeats.length === 1 ? '' : 's'} repeat every month, ${rupees(total)} in total; ${nextName} (${rupees(
        next.amount,
      )}) is due around ${formatDayMonth(next.next)}.`,
      values: { count: repeats.length, monthlyTotal: total, nextAmount: next.amount, nextDue: formatDayMonth(next.next) },
    });
  }

  if (m.micro.count > 0) {
    facts.push({
      parameter: 'small_spends',
      summary: `${m.micro.count} payment${m.micro.count === 1 ? '' : 's'} under ${rupees(MICRO_LIMIT)} added up to ${rupees(m.micro.total)} in ${month}.`,
      values: { count: m.micro.count, total: Math.round(m.micro.total), limit: MICRO_LIMIT },
    });
  }

  const biggest = within(spendsOf(transactions), monthStart(now), now + 1).sort((a, b) => b.amount - a.amount)[0];
  if (biggest) {
    const at = biggest.kind === 'merchant' && biggest.counterparty ? ` at ${biggest.counterparty.trim()}` : '';
    facts.push({
      parameter: 'biggest_payment',
      summary: `Your biggest payment in ${month} was ${rupees(biggest.amount)} for ${biggest.category}${at} on ${formatDayMonth(
        biggest.occurredAt,
      )}.`,
      values: { amount: Math.round(biggest.amount), category: biggest.category, date: formatDayMonth(biggest.occurredAt) },
    });
  }

  const f = report.forecast;
  if (f.pace > 0) {
    const base = `At about ${rupees(f.pace)} a day you're heading for ${rupees(f.projected)} by ${formatDayMonth(f.lastDay)}`;
    const values: Record<string, number | string> = {
      dailyPace: Math.round(f.pace),
      projected: Math.round(f.projected),
      periodEnds: formatDayMonth(f.lastDay),
    };
    let summary = `${base}.`;
    if (budget && f.budget != null) {
      values.budget = Math.round(f.budget);
      summary =
        f.overrunOn != null
          ? `${base}, past your ${rupees(f.budget)} budget, which runs out around ${formatDayMonth(f.overrunOn)}.`
          : `${base}, within your ${rupees(f.budget)} budget.`;
      if (f.overrunOn != null) {
        values.budgetRunsOut = formatDayMonth(f.overrunOn);
      }
    }
    facts.push({ parameter: 'budget_pace', summary, values });
  }

  return facts;
}

/** Stable key for a set of facts, so the server is only asked again when the numbers change. */
export function hashFacts(facts: Fact[]): string {
  const text = JSON.stringify(facts);
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (h * 33 + text.charCodeAt(i)) % 4294967291;
  }
  return `${text.length.toString(36)}-${h.toString(36)}`;
}
