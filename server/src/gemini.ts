import { ApiError, GoogleGenAI } from '@google/genai';
import { CATEGORIES, vetAnswers, type MerchantAnswer, type MerchantQuery } from './categorize.ts';
import { vetResponse, type InsightsRequest, type InsightsResponse } from './contract.ts';

// gemini-2.5-flash-lite is no longer offered to new API keys; override with GEMINI_MODEL.
export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 15_000;

const SYSTEM = `You are Spendd, a warm, sharp money coach in an Indian budgeting app for young people.
You get FACTS: the user's own numbers for the month, already calculated, one per parameter.

Write one insight for each fact, most important first, and exactly two money stories.
Rules:
- Talk only about the facts given. Every insight and story names its fact's "parameter".
- Copy numbers exactly as they appear in the facts, with ₹ for money. Never calculate, round, estimate or invent a number.
- Be specific to these numbers and this person. No generic advice that would fit anyone.
- Talk to the user as "you". Encouraging, never preachy.
- title: one punchy line, under 70 characters.
- detail: one or two sentences explaining what the number means for them.
- action: one concrete next step, under 100 characters.
- tone: "warning" for a problem, "positive" for good news, otherwise "neutral".
- stories: two short quotable lines (under 110 characters), each about a different fact, in the style:
  "Food delivery became your largest expense this month."
- Don't reuse any wording listed under AVOID.`;

/** JSON Schema for the reply; the parameter enums are narrowed to the facts actually sent. */
function responseSchema(request: InsightsRequest) {
  const parameter = { type: 'string', enum: request.facts.map(f => f.parameter) };
  return {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        minItems: 1,
        maxItems: request.facts.length,
        items: {
          type: 'object',
          properties: {
            parameter,
            title: { type: 'string' },
            detail: { type: 'string' },
            action: { type: 'string' },
            tone: { type: 'string', enum: ['positive', 'neutral', 'warning'] },
          },
          required: ['parameter', 'title', 'detail', 'action', 'tone'],
          propertyOrdering: ['parameter', 'title', 'detail', 'action', 'tone'],
        },
      },
      stories: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: {
          type: 'object',
          properties: { parameter, text: { type: 'string' } },
          required: ['parameter', 'text'],
          propertyOrdering: ['parameter', 'text'],
        },
      },
    },
    required: ['insights', 'stories'],
    propertyOrdering: ['insights', 'stories'],
  };
}

function prompt(request: InsightsRequest): string {
  const facts = request.facts.map(f => ({ parameter: f.parameter, fact: f.summary, values: f.values }));
  return [
    `MONTH: ${request.month}`,
    `FACTS:\n${JSON.stringify(facts, null, 2)}`,
    request.avoid.length ? `AVOID:\n${request.avoid.map(t => `- ${t}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Raised when Gemini itself is unavailable or rate-limited (the client should retry later). */
export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const CATEGORIZE_SYSTEM = `You categorise payments made from Indian UPI and bank apps.
For each merchant, pick the category from the allowed list that best describes what people
usually pay that business for, using the merchant name, its UPI ID, the amount and the hour.
- Use your knowledge of Indian brands, chains and UPI handles (e.g. "zomato", "blinkit", "irctc", "bescom").
- confidence: "high" when the business is well known or unambiguous, "medium" when the name strongly
  suggests it, "low" when you are guessing.
- isPerson: true if this looks like an individual rather than a business; then use "Personal".
- Never invent merchants; answer only for the keys given.`;

function categorizeSchema(queries: MerchantQuery[]) {
  return {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        minItems: queries.length,
        maxItems: queries.length,
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: queries.map(q => q.key) },
            category: { type: 'string', enum: [...CATEGORIES] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            isPerson: { type: 'boolean' },
          },
          required: ['key', 'category', 'confidence', 'isPerson'],
          propertyOrdering: ['key', 'category', 'confidence', 'isPerson'],
        },
      },
    },
    required: ['results'],
  };
}

export function createGenerator(apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });

  async function ask(contents: string, systemInstruction: string, schema: unknown, temperature: number): Promise<unknown> {
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature,
          // Gemini 2.x lite models accept "no thinking"; 3.x rejects the setting.
          ...(MODEL.startsWith('gemini-2') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      text = response.text;
    } catch (e) {
      if (e instanceof ApiError) {
        throw new UpstreamError(`Gemini ${e.status}: ${e.message}`, e.status === 429 ? 429 : 502);
      }
      throw new UpstreamError(`Gemini request failed: ${(e as Error).message}`, 504);
    }
    try {
      return JSON.parse(text ?? '');
    } catch {
      throw new UpstreamError('Gemini returned invalid JSON', 502);
    }
  }

  return {
    async insights(request: InsightsRequest): Promise<InsightsResponse> {
      // Some variety between refreshes so the wording isn't the same every time.
      const parsed = await ask(prompt(request), SYSTEM, responseSchema(request), 0.8);
      return { ...vetResponse(parsed, request), model: MODEL };
    },
    async categorize(queries: MerchantQuery[]): Promise<MerchantAnswer[]> {
      const parsed = await ask(`MERCHANTS:\n${JSON.stringify(queries, null, 2)}`, CATEGORIZE_SYSTEM, categorizeSchema(queries), 0);
      return vetAnswers(parsed, queries);
    },
  };
}
