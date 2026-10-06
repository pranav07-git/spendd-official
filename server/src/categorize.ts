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
    // Control characters and line breaks have no place in a name; dropping them keeps OCR'd text
    // from posing as extra instructions in the prompt.
    const text = (v: unknown, max: number) => {
      const clean = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim() : '';
      return clean ? clean.slice(0, max) : null;
    };
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

type Entry = { category: Category; confidence: Confidence; at: number };

/** Shared answers expire, so a wrong one doesn't last for ever and merchants that change are re-asked. */
const TTL_MS = 90 * 24 * 60 * 60_000;
/** Oldest answers are dropped past this, so the cache can't be grown without bound. */
const MAX_ENTRIES = 50_000;

const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9@.]+/g, ' ').trim();

/**
 * Merchant → category answers shared by every user, so each merchant costs one model call in
 * total. Only confident answers about businesses are kept; people are never stored.
 *
 * Answers are filed under exactly what the model was shown (UPI ID and name), worked out here and
 * never taken from the client's `key`. So a request can only ever affect payees with that same UPI
 * ID *and* name: it can't file "Apollo Pharmacy" under Zomato's UPI ID for everyone else.
 */
export class MerchantCache {
  private entries = new Map<string, Entry>();
  private file: string | null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private now: () => number;

  constructor(file: string | null, now: () => number = Date.now) {
    this.file = file;
    this.now = now;
    if (file) {
      try {
        const saved = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Entry>;
        Object.entries(saved)
          // Older files were keyed by the client's key; those can't be trusted, so start again.
          .filter(([k]) => k.includes('|'))
          .forEach(([k, v]) => this.entries.set(k, v));
      } catch {
        // No cache yet.
      }
    }
  }

  static identity(query: Pick<MerchantQuery, 'name' | 'handle'>): string {
    return `${norm(query.handle)}|${norm(query.name)}`;
  }

  get(query: MerchantQuery): MerchantAnswer | null {
    const id = MerchantCache.identity(query);
    const hit = this.entries.get(id);
    if (!hit) {
      return null;
    }
    if (this.now() - hit.at > TTL_MS) {
      this.entries.delete(id);
      return null;
    }
    return { key: query.key, category: hit.category, confidence: hit.confidence, isPerson: false };
  }

  put(query: MerchantQuery, answer: MerchantAnswer) {
    if (answer.isPerson || answer.confidence === 'low' || answer.category === 'Personal' || answer.category === 'Other') {
      return;
    }
    const id = MerchantCache.identity(query);
    this.entries.delete(id); // re-insert so Map order stays oldest-first
    this.entries.set(id, { category: answer.category, confidence: answer.confidence, at: this.now() });
    while (this.entries.size > MAX_ENTRIES) {
      this.entries.delete(this.entries.keys().next().value!);
    }
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
