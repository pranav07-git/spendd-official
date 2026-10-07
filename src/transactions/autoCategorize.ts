import { apiFetch } from '../auth/session';
import { getCategoryMemory, rememberCategory } from '../storage/categoryMemory';
import { kindFor } from './categories';
import { planCategorization } from './categorizePlan';
import type { MerchantQuery } from './merchants';
import { applyCategory } from './store';
import { UNCLEAR } from './stories';
import type { Transaction } from './types';

type Answer = { key: string; category: string; confidence: 'high' | 'medium' | 'low'; isPerson: boolean };

async function askSpenddAi(queries: MerchantQuery[]): Promise<Answer[]> {
  const res = await apiFetch('/v1/categorize', { method: 'POST', body: JSON.stringify({ merchants: queries }) });
  if (!res.ok) {
    throw new Error(`Categorize returned ${res.status}`);
  }
  return ((await res.json()) as { results: Answer[] }).results;
}

let running: Promise<number> | null = null;

/**
 * Re-files payments from memory, then asks Spendd AI about merchants not on Spendd's list.
 * Returns how many payments changed. Safe to call often: concurrent calls share one run.
 */
export function autoCategorize(transactions: Transaction[]): Promise<number> {
  running ??= (async () => {
    let changed = 0;
    const plan = planCategorization(transactions, await getCategoryMemory());

    for (const { tx, category } of plan.fromMemory) {
      await applyCategory(tx.id, { category, kind: kindFor(category), categorySource: 'memory' });
      changed++;
    }

    if (plan.toAsk.length > 0) {
      let answers: Answer[] = [];
      try {
        answers = await askSpenddAi(plan.toAsk.map(a => a.query));
      } catch {
        return changed; // offline or server down: the keyword rules' guess stands; try next time
      }
      const byKey = new Map(answers.map(a => [a.key, a]));
      const now = Date.now();
      for (const { query, txs } of plan.toAsk) {
        const answer = byKey.get(query.key);
        const usable = answer && !answer.isPerson && answer.confidence !== 'low' && !UNCLEAR.includes(answer.category);
        if (usable) {
          await rememberCategory(txs[0], answer.category, 'ai');
        }
        for (const tx of txs) {
          await applyCategory(
            tx.id,
            usable
              ? { category: answer.category, kind: kindFor(answer.category), categorySource: 'ai' }
              : { categoryCheckedAt: now },
          );
          changed += usable ? 1 : 0;
        }
      }
    }
    return changed;
  })().finally(() => {
    running = null;
  });
  return running;
}
