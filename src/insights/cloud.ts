import { apiFetch } from '../auth/session';
import { LONG_MONTHS } from '../transactions/format';
import type { Fact, Parameter } from './parameters';
import type { Insight, InsightKind } from './types';

type Tone = 'positive' | 'neutral' | 'warning';
type Response = {
  insights: { parameter: Parameter; title: string; detail: string; action: string; tone: Tone }[];
  stories: { parameter: Parameter; text: string }[];
};

export type CloudResult = { insights: Insight[]; stories: string[] };

const KIND: Record<Tone, InsightKind> = { warning: 'alert', positive: 'win', neutral: 'agent' };

/** Asks the Spendd server (Gemini Flash-Lite) to word the facts; throws on any failure. */
export async function fetchCloudInsights(facts: Fact[], avoid: string[], now: number = Date.now()): Promise<CloudResult> {
  const d = new Date(now);
  const res = await apiFetch('/v1/insights', {
    method: 'POST',
    body: JSON.stringify({ month: `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`, facts, avoid }),
  });
  if (!res.ok) {
    throw new Error(`Insights server returned ${res.status}`);
  }
  const body = (await res.json()) as Response;
  const insights = body.insights.map((item, i) => ({
    id: `ai-${item.parameter}`,
    kind: KIND[item.tone] ?? 'agent',
    title: item.title,
    caption: `${item.detail} ${item.action}`,
    score: 1000 - i,
    source: 'ai' as const,
  }));
  return { insights, stories: body.stories.map(s => s.text) };
}
