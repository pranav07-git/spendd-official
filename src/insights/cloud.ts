import { INSIGHTS_API_TOKEN, INSIGHTS_API_URL } from '../config';
import { LONG_MONTHS } from '../transactions/format';
import type { Fact, Parameter } from './parameters';
import type { Insight, InsightKind } from './types';

const TIMEOUT_MS = 20_000;

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (INSIGHTS_API_TOKEN) {
    headers['x-spendd-token'] = INSIGHTS_API_TOKEN;
  }
  try {
    const res = await fetch(`${INSIGHTS_API_URL}/v1/insights`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ month: `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`, facts, avoid }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}
