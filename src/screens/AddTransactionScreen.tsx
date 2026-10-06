import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { Chips } from '../components/Chips';
import { DayStepper } from '../components/DayStepper';
import { Header } from '../components/Header';
import { Card } from '../components/Layout';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { categoriesFor, kindFor, PAYMENT_METHODS } from '../transactions/categories';
import { startOfDay } from '../transactions/format';
import { addTransaction } from '../transactions/store';
import type { Transaction } from '../transactions/types';
import { makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, TOUCH_TARGET, type, useTheme } from '../theme';

/** Now, for today; midday (no time of day shown) for an earlier day. */
function occurredAtFor(day: number): number {
  return day === startOfDay(Date.now()) ? Date.now() : day + 12 * 60 * 60 * 1000;
}

export function AddTransactionScreen({ navigation }: ScreenProps<'AddTransaction'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [direction, setDirection] = useState<Transaction['direction']>('debit');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState('UPI');
  const today = startOfDay(Date.now());
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = categoriesFor(direction);

  const changeDirection = (d: Transaction['direction']) => {
    setDirection(d);
    if (category && !categoriesFor(d).includes(category)) {
      setCategory(null);
    }
  };

  const save = async () => {
    const value = Number(amount.replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError(direction === 'credit' ? 'Add how much you got to save this.' : 'Add how much you paid to save this.');
      return;
    }
    if (!category) {
      setError('Pick a category so this lands in the right place.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addTransaction({
        amount: Math.round(value * 100) / 100,
        currency: 'INR',
        direction,
        counterparty: name.trim() || null,
        handle: null,
        txnRef: null,
        bank: null,
        source: method,
        category,
        kind: kindFor(category),
        occurredAt: occurredAtFor(day),
        hasTime: day === today,
        dateFromReceipt: false,
        manual: true,
        note: note.trim() || null,
        rawText: '',
      });
      // The Transactions tab reloads when it regains focus.
      navigation.goBack();
    } catch {
      setError('Couldn’t save this. Try again.');
      setSaving(false);
    }
  };

  const credit = direction === 'credit';

  return (
    <Screen>
      <Header title="Add a payment" onBack={navigation.goBack} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.toggle}>
          {(['debit', 'credit'] as const).map(d => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: direction === d }}
              onPress={() => changeDirection(d)}
              style={({ pressed }) => [s.toggleOption, direction === d && s.toggleActive, pressed && s.pressed]}>
              <Text style={s.toggleLabel}>{d === 'debit' ? 'Spent' : 'Received'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.amountRow}>
          <Text style={[s.amountText, !amount && s.amountPlaceholder, credit && amount ? s.amountIn : null]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={c.inkSubtle}
            style={[s.amountText, s.amountInput, credit && s.amountIn]}
            autoFocus
            accessibilityLabel="Amount"
          />
        </View>

        <Card style={s.card}>
          <Text style={s.label}>{credit ? 'Received from' : 'Paid to'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Optional, e.g. Apollo Pharmacy"
            placeholderTextColor={c.inkSubtle}
            style={s.input}
            autoCapitalize="words"
            accessibilityLabel={credit ? 'Received from' : 'Paid to'}
          />
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>Category</Text>
          <Chips options={categories} selected={category} onSelect={setCategory} />
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>{credit ? 'Received via' : 'Paid via'}</Text>
          <Chips options={PAYMENT_METHODS} selected={method} onSelect={setMethod} />
        </Card>

        <Card style={s.card}>
          <View style={s.row}>
            <Text style={s.label}>Date</Text>
            <DayStepper value={day} onChange={setDay} max={today} accessibilityLabel="Date" />
          </View>
        </Card>

        <Card style={s.card}>
          <Text style={s.label}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={c.inkSubtle}
            style={s.input}
            maxLength={120}
            accessibilityLabel="Note"
          />
        </Card>

        {error ? <Text style={s.error}>{error}</Text> : null}
        <PrimaryButton label={credit ? 'Save money received' : 'Save spend'} onPress={save} loading={saving} style={s.save} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  pressed: { opacity: 0.7 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[2], paddingBottom: SECTION_GAP },
  toggle: { flexDirection: 'row', gap: space[2] },
  toggleOption: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: c.surfaceSunken, borderColor: c.ink },
  toggleLabel: { ...type.label, color: c.ink },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SECTION_GAP,
  },
  amountText: { ...type.amountHero, color: c.ink },
  amountPlaceholder: { color: c.inkSubtle },
  amountIn: { color: c.peacock },
  amountInput: { minWidth: 40, paddingVertical: 0, marginLeft: space[1] },
  card: { gap: space[3], marginBottom: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TOUCH_TARGET, gap: space[4] },
  label: { ...type.eyebrow, color: c.inkMuted },
  input: {
    ...type.body,
    color: c.ink,
    minHeight: 48,
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.s,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  error: { ...type.caption, color: c.low, textAlign: 'center', marginTop: space[1] },
  save: { marginTop: space[6] },
}));
