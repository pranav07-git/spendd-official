export type DailyStatus = {
  safeToSpend: number;
  /** Today's allowance; null until there's a budget or enough history. */
  spendBelowToday: number | null;
  /** Last 7 days vs the 4 weeks before; negative = spending less. Null without enough history. */
  changeVsUsualPct: number | null;
};

/** A card in Today's Story, built from real transactions (see transactions/stories.ts). */
/** `glyph` is a category name or a card kind (Income, Question, Empty) for CategoryGlyph. */
export type StoryItem = { id: string; glyph: string; title: string; caption: string };

export type InsightKind = 'agent' | 'alert' | 'win';
export type Insight = {
  id: string;
  kind: InsightKind;
  title: string;
  caption: string;
  /** Higher = more important; insights are shown in descending order. */
  score: number;
  /** Written by Spendd AI (Gemini, via the server) rather than the rules engine. */
  source?: 'ai';
};

export type DailyBudget = {
  amount: number;
  usedFraction: number;
  /** Where today's allowance comes from. */
  basis: 'budget' | 'usual';
};

export type Habit = { id: string; label: string; sharePct: number };

export type Forecast = {
  /** "October" or a budget's period label. */
  label: string;
  /** Last day of the period (start-of-day timestamp). */
  lastDay: number;
  spent: number;
  projected: number;
  /** ~80% likely range for the projection. */
  low: number;
  high: number;
  /** Expected spend per day from here on. */
  pace: number;
  budget: number | null;
  /** Day the budget is projected to run out, if it will within the period. */
  overrunOn: number | null;
  daysLeft: number;
  /** False while there are fewer than 7 days of history. */
  confident: boolean;
};

export type InsightsReport = {
  forecast: Forecast;
  /** Ranked, most important first. The forecast's own insight has id 'forecast'. */
  insights: Insight[];
  dailyStatus: DailyStatus;
  dailyBudget: DailyBudget | null;
  habits: Habit[];
  /** One-line mood for the home greeting. */
  headline: string;
};
