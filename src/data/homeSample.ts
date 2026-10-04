// Sample dashboard data until statement parsing and the insights agent are
// wired up. Keep the shapes; swap the source.

export type DailyStatus = {
  safeToSpend: number;
  spendBelowToday: number;
  changeVsUsualPct: number; // negative = spending less than usual
};

export type StoryItem = { id: string; emoji: string; title: string; caption: string };

export type InsightKind = 'agent' | 'alert' | 'win';
export type Insight = { id: string; kind: InsightKind; title: string; caption: string };

export type DailyBudget = { amount: number; usedFraction: number };

export type Habit = { id: string; emoji: string; label: string; sharePct: number };

export const dailyStatus: DailyStatus = {
  safeToSpend: 420,
  spendBelowToday: 180,
  changeVsUsualPct: -22,
};

export const todaysStory: StoryItem[] = [
  { id: 'food', emoji: '🍔', title: 'Food', caption: '3 orders this week' },
  { id: 'blinkit', emoji: '🛒', title: 'Blinkit', caption: '₹1,200 in 5 days' },
  { id: 'netflix', emoji: '📺', title: 'Netflix', caption: 'Renews in 2 days' },
  { id: 'fuel', emoji: '⛽', title: 'Fuel', caption: '2 fills this month' },
];

export const insights: Insight[] = [
  {
    id: 'food-share',
    kind: 'agent',
    title: 'Food delivery took 28% of your spending',
    caption: 'That’s ₹4,200 this month. Trying cooking twice a week?',
  },
  {
    id: 'subscriptions',
    kind: 'alert',
    title: 'Subscriptions are increasing',
    caption: 'You’ve added 2 new services in the last 30 days.',
  },
  {
    id: 'saved',
    kind: 'win',
    title: 'You saved ₹900 this week',
    caption: 'Top saver status! You’re in the top 5% of users.',
  },
];

export const dailyBudget: DailyBudget = { amount: 220, usedFraction: 0.62 };

export const habits: Habit[] = [
  { id: 'food', emoji: '🍔', label: 'Food', sharePct: 42 },
  { id: 'travel', emoji: '🚕', label: 'Travel', sharePct: 18 },
  { id: 'shopping', emoji: '🛍️', label: 'Shopping', sharePct: 15 },
  { id: 'entertainment', emoji: '🎬', label: 'Entertainment', sharePct: 10 },
];
