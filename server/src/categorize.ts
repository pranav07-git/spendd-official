import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BadRequest } from './contract.ts';

/** Spending categories; must match SPENDING in the app's src/transactions/categories.ts. */
export const CATEGORIES = [
  'Food',
  'Groceries',
  'Medical',
  'Travel',
  'Shopping',
  'Bills',
  'Rent',
  'Education',
  'Entertainment',
  'Personal',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Confidence = 'high' | 'medium' | 'low';

export type MerchantQuery = { key: string; name: string | null; handle: string | null; amount: number | null; hour: number | null };
export type MerchantAnswer = { key: string; category: Category; confidence: Confidence; isPerson: boolean };

const MAX_MERCHANTS = 20;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseCategorizeRequest(body: unknown): MerchantQuery[] {
  if (!isRecord(body) || !Array.isArray(body.merchants) || body.merchants.length === 0 || body.merchants.length > MAX_MERCHANTS) {
    throw new BadRequest(`merchants must have 1–${MAX_MERCHANTS} entries`);
  }
  const seen = new Set<string>();
  return body.merchants.map((raw, i) => {
    if (!isRecord(raw) || typeof raw.key !== 'string' || raw.key.length === 0 || raw.key.length > 160 || seen.has(raw.key)) {
      throw new BadRequest(`merchants[${i}].key must be a unique string`);
    }
    seen.add(raw.key);
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const num = (v: unknown, min: number, max: number) =>
      typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;
    const query = {
      key: raw.key,
      name: text(raw.name, 80),
      handle: text(raw.handle, 80),
      amount: num(raw.amount, 0, 10_000_000),
      hour: num(raw.hour, 0, 23),
    };
    if (!query.name && !query.handle) {
      throw new BadRequest(`merchants[${i}] needs a name or a handle`);
    }
    return query;
  });
}

/** Keeps only answers for merchants that were asked about, with a known category and confidence. */
export function vetAnswers(raw: unknown, queries: MerchantQuery[]): MerchantAnswer[] {
  const asked = new Set(queries.map(q => q.key));
  const results = isRecord(raw) && Array.isArray(raw.results) ? raw.results : [];
  const out = new Map<string, MerchantAnswer>();
  for (const item of results) {
    if (!isRecord(item)) continue;
    const { key, category, confidence, isPerson } = item;
    if (
      typeof key === 'string' && asked.has(key) && !out.has(key) &&
      CATEGORIES.includes(category as Category) &&
      ['high', 'medium', 'low'].includes(confidence as string) &&
      typeof isPerson === 'boolean'
    ) {
      out.set(key, { key, category: category as Category, confidence: confidence as Confidence, isPerson });
    }
  }
  return [...out.values()];
}

/**
 * Merchant → category answers shared by every user, so each merchant costs one model call in
 * total. Only confident answers about businesses are kept; people are never stored.
 * The key is the merchant's identity without the direction prefix ("upi:blinkit@hdfcbank").
 */
export class MerchantCache {
  private entries = new Map<string, { category: Category; confidence: Confidence; at: number }>();
  private file: string | null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(file: string | null) {
    this.file = file;
    if (file) {
      try {
        const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { category: Category; confidence: Confidence; at: number }>;
        Object.entries(saved).forEach(([k, v]) => this.entries.set(k, v));
      } catch {
        // No cache yet.
      }
    }
  }

  static identity(key: string): string {
    return key.replace(/^(debit|credit):/, '');
  }

  get(key: string): MerchantAnswer | null {
    const hit = this.entries.get(MerchantCache.identity(key));
    return hit ? { key, category: hit.category, confidence: hit.confidence, isPerson: false } : null;
  }

  put(answer: MerchantAnswer) {
    if (answer.isPerson || answer.confidence === 'low' || answer.category === 'Personal' || answer.category === 'Other') {
      return;
    }
    this.entries.set(MerchantCache.identity(answer.key), { category: answer.category, confidence: answer.confidence, at: Date.now() });
    this.scheduleSave();
  }

  get size() {
    return this.entries.size;
  }

  private scheduleSave() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      mkdirSync(dirname(this.file!), { recursive: true });
      writeFileSync(this.file!, JSON.stringify(Object.fromEntries(this.entries)));
    }, 1000);
    this.saveTimer.unref?.();
  }
}
