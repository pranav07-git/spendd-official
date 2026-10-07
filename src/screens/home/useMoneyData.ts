import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DEFAULT_PROFILE, getBudget, getProfile, type Profile } from '../../storage/appState';
import { autoCategorize } from '../../transactions/autoCategorize';
import type { Budget } from '../../transactions/budget';
import { listTransactions } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';

/**
 * Transactions, budget and profile for a screen, reloaded whenever it gains focus or the app comes
 * back. Screenshots are logged in the background and budget/profile are edited on other screens,
 * so every screen showing them keeps itself fresh.
 */
export function useMoneyData() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  const reload = useCallback(async () => {
    const [txs, savedBudget, savedProfile] = await Promise.all([
      listTransactions().catch(() => [] as Transaction[]),
      getBudget().catch(() => null),
      getProfile().catch(() => DEFAULT_PROFILE),
    ]);
    setTransactions(txs);
    setBudget(savedBudget);
    setProfile(savedProfile);

    // Re-file payments from what the user taught Spendd, and ask Spendd AI about new merchants.
    // Runs in the background; the list refreshes only if something actually changed.
    autoCategorize(txs)
      .then(changed => (changed > 0 ? listTransactions().then(setTransactions) : undefined))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => state === 'active' && reload());
    return () => sub.remove();
  }, [reload]);

  return { transactions, budget, profile, reload };
}
