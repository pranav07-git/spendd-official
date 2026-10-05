import { useEffect, useMemo, useState } from 'react';
import { getAiInsightsCache, saveAiInsightsCache, type AiInsightsCache } from '../storage/appState';
import type { Budget } from '../transactions/budget';
import type { Transaction } from '../transactions/types';
import { fetchCloudInsights } from './cloud';
import { buildFacts, hashFacts } from './parameters';
import type { Insight, InsightsReport } from './types';

/** Wait for the user to stop adding transactions before asking the server. */
const DEBOUNCE_MS = 1500;
/** Fewer usable insights than this and the built-in engine's list is shown instead. */
const MIN_USEFUL = 2;
/** After a failure (offline, server down), try the same facts again after this long. */
const RETRY_MS = 5 * 60_000;

export type AiInsights = {
  /** AI-written insights for the current numbers (or the previous ones while refreshing); null = use the engine's. */
  insights: Insight[] | null;
  /** Two quotable lines for My Money's Money Stories; null = use the engine's. */
  stories: string[] | null;
  thinking: boolean;
};

/**
 * Insights and money stories written by Gemini from the eight fixed parameters (see
 * parameters.ts). The server is only asked when those numbers change, and the answer is cached.
 */
export function useCloudInsights(
  transactions: Transaction[] | null,
  report: InsightsReport | null,
  budget: Budget | null,
): AiInsights {
  const facts = useMemo(
    () => (transactions && report ? buildFacts(transactions, report, budget) : null),
    [transactions, report, budget],
  );
  const hash = facts && facts.length > 0 ? hashFacts(facts) : null;
  const [cache, setCache] = useState<AiInsightsCache | null | undefined>(undefined);
  const [thinking, setThinking] = useState(false);
  const [failed, setFailed] = useState<{ hash: string; at: number } | null>(null);

  useEffect(() => {
    getAiInsightsCache().then(setCache, () => setCache(null));
  }, []);

  useEffect(() => {
    const recentlyFailed = failed?.hash === hash && Date.now() - failed.at < RETRY_MS;
    if (!facts || !hash || cache === undefined || cache?.hash === hash || recentlyFailed) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setThinking(true);
      try {
        const result = await fetchCloudInsights(facts, cache?.insights.map(i => i.title) ?? []);
        if (cancelled) {
          return;
        }
        if (result.insights.length >= MIN_USEFUL) {
          const stories = [...result.stories, ...result.insights.map(i => i.title)].slice(0, 2);
          const next = { hash, insights: result.insights, stories, generatedAt: Date.now() };
          setCache(next);
          await saveAiInsightsCache(next);
        } else {
          setFailed({ hash, at: Date.now() });
        }
      } catch {
        if (!cancelled) {
          setFailed({ hash, at: Date.now() });
        }
      } finally {
        if (!cancelled) {
          setThinking(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cache, facts, failed, hash]);

  if (!cache?.insights.length) {
    return { insights: null, stories: null, thinking };
  }
  // Last time's text stays up while new numbers are being worded, but not after that fails.
  const usable = cache.hash === hash || failed?.hash !== hash;
  return usable
    ? { insights: cache.insights, stories: cache.stories, thinking }
    : { insights: null, stories: null, thinking };
}
