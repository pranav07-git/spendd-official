import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { Chips } from '../components/Chips';
import { DayStepper } from '../components/DayStepper';
import { Header } from '../components/Header';
import { Card } from '../components/Layout';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { getBudget, removeBudget, saveBudget } from '../storage/appState';
import { periodFor, type Budget, type BudgetPeriodKind } from '../transactions/budget';
import { addDays, startOfDay } from '../transactions/format';
import { makeStyles, SCREEN_PADDING, SECTION_GAP, space, TOUCH_TARGET, type, useTheme } from '../theme';

const PERIODS: { key: BudgetPeriodKind; label: string; hint: string }[] = [
  { key: 'month', label: 'Monthly', hint: 'Resets on the 1st of every month.' },
  { key: 'week', label: 'Weekly', hint: 'Resets every Monday.' },
  { key: 'custom', label: 'Custom dates', hint: 'For a trip, a festival, or any stretch of days.' },
];

export function SetBudgetScreen({ navigation }: ScreenProps<'SetBudget'>) {
  const s = useStyles();
  const { c } = useTheme();
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
      setError('Add how much you want to spend to set a budget.');
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
      setError('Couldn’t save your budget. Try again.');
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
      <Header title={existing ? 'Edit budget' : 'Set a budget'} onBack={navigation.goBack} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.prompt} accessibilityRole="header">
          How much do you want to spend?
        </Text>
        <View style={s.amountRow}>
          <Text style={[s.amountText, !amount && s.amountPlaceholder]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={c.inkSubtle}
            style={[s.amountText, s.amountInput]}
            autoFocus={!existing}
            accessibilityLabel="Budget amount"
          />
        </View>

        <Card style={s.card}>
          <Text style={s.label}>Budget for</Text>
          <Chips
            options={PERIODS.map(p => p.label)}
            selected={PERIODS.find(p => p.key === period)!.label}
            onSelect={label => setPeriod(PERIODS.find(p => p.label === label)!.key)}
          />
          <Text style={s.hint}>{PERIODS.find(p => p.key === period)!.hint}</Text>
        </Card>

        {period === 'custom' ? (
          <Card style={s.card}>
            <View style={s.row}>
              <Text style={s.label}>From</Text>
              <DayStepper value={start} onChange={changeStart} accessibilityLabel="Start date" />
            </View>
            <View style={s.row}>
              <Text style={s.label}>To</Text>
              <DayStepper value={end} onChange={setEnd} min={start} accessibilityLabel="End date" />
            </View>
            <Text style={s.hint}>
              {days} {days === 1 ? 'day' : 'days'}
            </Text>
          </Card>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}
        <PrimaryButton label={existing ? 'Save budget' : 'Set budget'} onPress={save} loading={saving} style={s.save} />
        {existing ? <TextButton label="Remove budget" color={c.low} onPress={confirmRemove} style={s.remove} /> : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[4], paddingBottom: SECTION_GAP },
  prompt: { ...type.story, color: c.ink },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[4],
    marginBottom: SECTION_GAP,
  },
  amountText: { ...type.amountHero, color: c.ink },
  amountPlaceholder: { color: c.inkSubtle },
  amountInput: { minWidth: 40, paddingVertical: 0, marginLeft: space[1] },
  card: { gap: space[3], marginBottom: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TOUCH_TARGET, gap: space[4] },
  label: { ...type.label, color: c.inkMuted },
  hint: { ...type.caption, color: c.inkMuted },
  error: { ...type.caption, color: c.low, textAlign: 'center', marginTop: space[1] },
  save: { marginTop: space[6] },
  remove: { marginTop: space[3] },
}));
