import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { DayStepper } from '../components/DayStepper';
import { ChevronLeftIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { getBudget, removeBudget, saveBudget } from '../storage/appState';
import { periodFor, type Budget, type BudgetPeriodKind } from '../transactions/budget';
import { addDays, startOfDay } from '../transactions/format';
import { colors, fonts } from '../theme';

const PERIODS: { key: BudgetPeriodKind; label: string; hint: string }[] = [
  { key: 'month', label: 'MONTHLY', hint: 'Resets on the 1st of every month.' },
  { key: 'week', label: 'WEEKLY', hint: 'Resets every Monday.' },
  { key: 'custom', label: 'CUSTOM DATES', hint: 'For a trip, a festival, or any stretch of days.' },
];

export function SetBudgetScreen({ navigation }: ScreenProps<'SetBudget'>) {
  const today = startOfDay(Date.now());
  const [existing, setExisting] = useState<Budget | null>(null);
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriodKind>('month');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBudget().then(budget => {
      if (!budget) {
        return;
      }
      setExisting(budget);
      setAmount(String(budget.amount));
      setPeriod(budget.period);
      if (budget.period === 'custom') {
        const p = periodFor(budget);
        setStart(p.start);
        setEnd(addDays(p.end, -1));
      }
    });
  }, []);

  const changeStart = (day: number) => {
    setStart(day);
    if (end < day) {
      setEnd(day);
    }
  };

  const save = async () => {
    const value = Number(amount.replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter how much you want to spend.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveBudget({
        amount: Math.round(value),
        period,
        ...(period === 'custom' ? { start, end } : {}),
      });
      navigation.goBack();
    } catch {
      setError('Couldn’t save. Try again.');
      setSaving(false);
    }
  };

  const confirmRemove = () =>
    Alert.alert('Remove budget?', 'Your spending is still tracked; you just won’t have a limit.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeBudget();
          navigation.goBack();
        },
      },
    ]);

  const days = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ChevronLeftIcon size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {existing ? 'Edit Budget' : 'Set a Budget'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.prompt}>How much do you want to spend?</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amountText, !amount && styles.amountPlaceholder]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.inkFaint}
            style={[styles.amountText, styles.amountInput]}
            autoFocus={!existing}
            accessibilityLabel="Budget amount"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>BUDGET FOR</Text>
          <View style={styles.periods}>
            {PERIODS.map(p => (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{ selected: period === p.key }}
                onPress={() => setPeriod(p.key)}
                style={[styles.periodOption, period === p.key && styles.periodActive]}>
                <Text style={[styles.periodLabel, period === p.key && styles.periodLabelActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{PERIODS.find(p => p.key === period)!.hint}</Text>
        </View>

        {period === 'custom' ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>FROM</Text>
              <DayStepper value={start} onChange={changeStart} accessibilityLabel="Start date" />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>TO</Text>
              <DayStepper value={end} onChange={setEnd} min={start} accessibilityLabel="End date" />
            </View>
            <Text style={styles.hint}>
              {days} {days === 1 ? 'day' : 'days'}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="SAVE BUDGET" onPress={save} loading={saving} style={styles.save} />
        {existing ? <TextButton label="REMOVE BUDGET" color={colors.danger} onPress={confirmRemove} style={styles.remove} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  header: { height: 72, justifyContent: 'center', alignItems: 'center' },
  back: {
    position: 'absolute',
    left: 24,
    width: 40,
    height: 40,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  prompt: { fontFamily: fonts.serifItalic, fontSize: 19, color: colors.inkMuted, textAlign: 'center' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 36,
  },
  amountText: { fontFamily: fonts.serifBold, fontSize: 48, color: colors.ink },
  amountPlaceholder: { color: colors.inkFaint },
  amountInput: { minWidth: 40, paddingVertical: 0, marginLeft: 6 },
  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 16,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, gap: 16 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2.2, color: colors.inkMuted },
  periods: { gap: 8 },
  periodOption: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  periodLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.inkMuted },
  periodLabelActive: { color: colors.background },
  hint: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 4 },
  save: { marginTop: 16 },
  remove: { marginTop: 12 },
});
