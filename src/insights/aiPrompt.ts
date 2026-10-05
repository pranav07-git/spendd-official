/**
 * The pure half of Spendd AI: what the on-device model is told, and how its answer is checked.
 * The engine does all the maths; the model only rewrites and combines those facts, and any
 * number it writes that isn't in the facts gets the insight thrown out.
 */
import { formatDayMonth, formatRupees } from '../transactions/format';
import type { Insight, InsightsReport } from './types';

export const AI_MODEL = {
  name: 'Qwen2.5 0.5B',
  fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
  url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  bytes: 491_400_032,
  sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
  /** Below this much RAM the model is likely to be slow or killed. */
  minMemoryBytes: 3 * 1024 ** 3,
};

const MAX_FACTS = 14;
export const MAX_AI_INSIGHTS = 6;

/** Everything the model may talk about, one fact per line. */
export function factSheet(report: InsightsReport): string {
  const f = report.forecast;
  const lines: string[] = [];
  if (f.spent > 0 || f.pace > 0) {
    lines.push(`Spent so far in ${f.label}: ${formatRupees(f.spent)}.`);
    lines.push(`At the current pace of about ${formatRupees(f.pace)} a day, spending reaches ${formatRupees(f.projected)} by ${formatDayMonth(f.lastDay)}.`);
  }
  if (f.budget != null) {
    lines.push(`Budget for ${f.label}: ${formatRupees(f.budget)}, with ${f.daysLeft} days left.`);
  }
  if (report.dailyStatus.spendBelowToday != null) {
    lines.push(`Today's spending limit: ${formatRupees(report.dailyStatus.spendBelowToday)}; ${formatRupees(report.dailyStatus.safeToSpend)} of it is left.`);
  }
  report.insights.slice(0, MAX_FACTS).forEach(i => lines.push(`${i.title}. ${i.caption}`));
  return lines.map(line => `- ${line}`).join('\n');
}

const SYSTEM = `You are Spendd, a warm, practical money coach inside a budgeting app for young people in India.
Turn the FACTS into short insights for the user.
Rules:
- Use only the facts. Copy every number exactly as written, with ₹ for money. Never invent, round or calculate numbers.
- Most important first. Combine related facts when that makes the advice clearer.
- Talk to the user as "you". Be encouraging, never preachy.
- title: one punchy line under 70 characters.
- body: one or two sentences ending with one concrete thing to do.
- kind: "alert" for problems, "win" for good news, "tip" for advice.
Reply with JSON only.`;

/** Output shape, enforced by grammar-constrained decoding. */
export const AI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_AI_INSIGHTS,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['alert', 'win', 'tip'] },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['kind', 'title', 'body'],
      },
    },
  },
  required: ['insights'],
};

export function buildMessages(facts: string) {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `FACTS:\n${facts}\n\nWrite up to ${MAX_AI_INSIGHTS} insights.` },
  ];
}

/** "₹1,234.50" → "1234.5"; "42%" → "42". */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(n => n.replace(/,/g, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Parses the model's JSON and keeps only well-formed insights whose numbers all come from the facts. */
export function parseAiInsights(raw: string, facts: string): Insight[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    try {
      parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : null;
    } catch {
      return [];
    }
  }
  const items = (parsed as { insights?: unknown })?.insights;
  if (!Array.isArray(items)) {
    return [];
  }

  const allowed = new Set(numbersIn(facts));
  const seen = new Set<string>();
  const out: Insight[] = [];
  for (const item of items) {
    const { kind, title, body } = (item ?? {}) as Record<string, unknown>;
    if ((kind !== 'alert' && kind !== 'win' && kind !== 'tip') || typeof title !== 'string' || typeof body !== 'string') {
      continue;
    }
    const t = tidy(title);
    const b = tidy(body);
    const key = t.toLowerCase();
    if (t.length < 4 || t.length > 90 || b.length < 10 || b.length > 260 || seen.has(key)) {
      continue;
    }
    if (!numbersIn(`${t} ${b}`).every(n => allowed.has(n))) {
      continue; // a made-up or miscopied number
    }
    seen.add(key);
    out.push({
      id: `ai-${out.length}`,
      kind: kind === 'tip' ? 'agent' : kind,
      title: t,
      caption: b,
      score: 100 - out.length,
      source: 'ai',
    });
    if (out.length === MAX_AI_INSIGHTS) {
      break;
    }
  }
  return out;
}

/** Cheap stable hash, to know when the facts (and so the AI's insights) are out of date. */
export function hashFacts(facts: string): string {
  // djb2, kept within a safe integer range by a large prime modulus.
  let h = 5381;
  for (let i = 0; i < facts.length; i++) {
    h = (h * 33 + facts.charCodeAt(i)) % 2147483629;
  }
  return `${h.toString(36)}-${facts.length}`;
}
