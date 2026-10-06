/**
 * The insights contract shared with the app (mirrored in src/insights/parameters.ts there).
 * The phone computes every number; the model may only talk about these eight parameters.
 */
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

export type Fact = {
  parameter: Parameter;
  /** One plain sentence with the exact figures, e.g. "Food is ₹9,480, 27% of spending." */
  summary: string;
  /** The same figures, machine-readable. */
  values: Record<string, number | string>;
};

export type InsightsRequest = {
  /** "October 2026" */
  month: string;
  facts: Fact[];
  /** Titles shown last time, so the new wording doesn't repeat them. */
  avoid: string[];
};

export type Tone = 'positive' | 'neutral' | 'warning';
export type InsightOut = { parameter: Parameter; title: string; detail: string; tone: Tone; action: string };
export type StoryOut = { parameter: Parameter; text: string };
export type InsightsResponse = { insights: InsightOut[]; stories: StoryOut[]; model: string };

export class BadRequest extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number, what: string): string => {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) {
    throw new BadRequest(`${what} must be a string of 1–${max} characters`);
  }
  // Summaries can carry OCR'd merchant names; line breaks and control characters would only help
  // such text pose as instructions in the prompt.
  return v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ');
};

/** Strict validation: anything unexpected is rejected rather than forwarded to the model. */
export function parseRequest(body: unknown): InsightsRequest {
  if (!isRecord(body)) {
    throw new BadRequest('Body must be a JSON object');
  }
  const month = str(body.month, 40, 'month');
  if (!Array.isArray(body.facts) || body.facts.length === 0 || body.facts.length > PARAMETERS.length) {
    throw new BadRequest(`facts must have 1–${PARAMETERS.length} entries`);
  }
  const seen = new Set<string>();
  const facts = body.facts.map((raw, i): Fact => {
    if (!isRecord(raw)) {
      throw new BadRequest(`facts[${i}] must be an object`);
    }
    const parameter = raw.parameter as Parameter;
    if (!PARAMETERS.includes(parameter) || seen.has(parameter)) {
      throw new BadRequest(`facts[${i}].parameter is unknown or repeated`);
    }
    seen.add(parameter);
    if (!isRecord(raw.values) || Object.keys(raw.values).length > 10) {
      throw new BadRequest(`facts[${i}].values must be an object with up to 10 entries`);
    }
    const values: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(raw.values)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        values[key] = value;
      } else if (typeof value === 'string' && value.length <= 60) {
        values[key] = value;
      } else {
        throw new BadRequest(`facts[${i}].values.${key} must be a finite number or a short string`);
      }
    }
    return { parameter, summary: str(raw.summary, 300, `facts[${i}].summary`), values };
  });
  const avoid = Array.isArray(body.avoid)
    ? body.avoid.filter((t): t is string => typeof t === 'string').slice(0, 10).map(t => t.slice(0, 120))
    : [];
  return { month, facts, avoid };
}

/** Every number written in a piece of text, normalised: "₹9,480" → "9480", "27%" → "27". */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(n => n.replace(/,/g, '').replace(/\.0+$/, ''));
}

/** The numbers the model is allowed to write: exactly those in the facts (and the month). */
export function allowedNumbers(request: InsightsRequest): Set<string> {
  const allowed = new Set(numbersIn(request.month));
  for (const fact of request.facts) {
    numbersIn(fact.summary).forEach(n => allowed.add(n));
    Object.values(fact.values).forEach(v => numbersIn(String(v)).forEach(n => allowed.add(n)));
  }
  return allowed;
}

const LIMITS = { title: 80, detail: 240, action: 110, story: 120 };

/**
 * Keeps only output that is about a parameter the phone sent, within length limits, and uses no
 * number the facts don't contain. The model can rephrase and prioritise, never invent.
 */
export function vetResponse(raw: unknown, request: InsightsRequest): Omit<InsightsResponse, 'model'> {
  const sent = new Set(request.facts.map(f => f.parameter));
  const allowed = allowedNumbers(request);
  const honest = (...texts: string[]) => texts.every(t => numbersIn(t).every(n => allowed.has(n)));
  const fits = (text: unknown, max: number): text is string => typeof text === 'string' && text.trim().length > 0 && text.length <= max;
  const tones: Tone[] = ['positive', 'neutral', 'warning'];
  const data = isRecord(raw) ? raw : {};

  const used = new Set<string>();
  const insights: InsightOut[] = [];
  for (const item of Array.isArray(data.insights) ? data.insights : []) {
    if (!isRecord(item)) continue;
    const { parameter, title, detail, tone, action } = item;
    if (
      typeof parameter === 'string' && sent.has(parameter as Parameter) && !used.has(parameter) &&
      fits(title, LIMITS.title) && fits(detail, LIMITS.detail) && fits(action, LIMITS.action) &&
      tones.includes(tone as Tone) && honest(title, detail, action)
    ) {
      used.add(parameter);
      insights.push({ parameter: parameter as Parameter, title: title.trim(), detail: detail.trim(), tone: tone as Tone, action: action.trim() });
    }
  }

  const stories: StoryOut[] = [];
  for (const item of Array.isArray(data.stories) ? data.stories : []) {
    if (!isRecord(item)) continue;
    const { parameter, text } = item;
    if (typeof parameter === 'string' && sent.has(parameter as Parameter) && fits(text, LIMITS.story) && honest(text)) {
      stories.push({ parameter: parameter as Parameter, text: text.trim() });
    }
  }
  return { insights, stories: stories.slice(0, 2) };
}
