import { useEffect, useMemo, useState } from 'react';
import { getAiInsightsCache, saveAiInsightsCache, type AiInsightsCache } from '../storage/appState';
import { factSheet, hashFacts } from './aiPrompt';
import { generateAiInsights } from './aiRuntime';
import type { Insight, InsightsReport } from './types';

/** Wait for the user to stop adding transactions before spending ~10 s of CPU on a rewrite. */
const DEBOUNCE_MS = 2500;
/** Fewer than this many usable insights and the engine's own list is better. */
const MIN_USEFUL = 2;

export type AiInsights = {
  /** AI-written insights for the current facts (or the last ones while rewriting); null = use the engine's. */
  insights: Insight[] | null;
  thinking: boolean;
};

/**
 * AI-written insights for `report`, cached by a hash of the facts so the model only runs when
 * the user's numbers actually change. Pass a null `modelPath` to turn it off.
 */
export function useAiInsights(report: InsightsReport | null, modelPath: string | null): AiInsights {
  const facts = useMemo(() => (report ? factSheet(report) : null), [report]);
  const hash = facts ? hashFacts(facts) : null;
  const [cache, setCache] = useState<AiInsightsCache | null | undefined>(undefined);
  const [thinking, setThinking] = useState(false);
  const [failedHash, setFailedHash] = useState<string | null>(null);

  useEffect(() => {
    getAiInsightsCache().then(setCache, () => setCache(null));
  }, []);

  useEffect(() => {
    if (!modelPath || !facts || !hash || cache === undefined || cache?.hash === hash || failedHash === hash) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setThinking(true);
      try {
        const insights = await generateAiInsights(modelPath, facts);
        if (cancelled) {
          return;
        }
        if (insights.length >= MIN_USEFUL) {
          const next = { hash, insights, generatedAt: Date.now() };
          setCache(next);
          await saveAiInsightsCache(next);
        } else {
          setFailedHash(hash);
        }
      } catch {
        if (!cancelled) {
          setFailedHash(hash);
        }
      } finally {
        setThinking(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cache, facts, failedHash, hash, modelPath]);

  if (!modelPath) {
    return { insights: null, thinking: false };
  }
  // Last run's insights stay up while a rewrite is pending, but not once it has failed.
  const usable = cache?.insights?.length && (cache.hash === hash || failedHash !== hash);
  return { insights: usable ? cache!.insights : null, thinking };
}
