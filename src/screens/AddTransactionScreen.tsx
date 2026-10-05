import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { Chips } from '../components/Chips';
import { DayStepper } from '../components/DayStepper';
import { ChevronLeftIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { categoriesFor, kindFor, PAYMENT_METHODS } from '../transactions/categories';
import { startOfDay } from '../transactions/format';
import { addTransaction } from '../transactions/store';
import type { Transaction } from '../transactions/types';
import { colors, fonts } from '../theme';

/** Now, for today; midday (no time of day shown) for an earlier day. */
function occurredAtFor(day: number): number {
  return day === startOfDay(Date.now()) ? Date.now() : day + 12 * 60 * 60 * 1000;
}

export function AddTransactionScreen({ navigation }: ScreenProps<'AddTransaction'>) {
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
      setError('Enter the amount.');
      return;
    }
    if (!category) {
      setError('Pick a category.');
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
      setError('Couldn’t save. Try again.');
      setSaving(false);
    }
  };

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
          Add Transaction
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.toggle}>
          {(['debit', 'credit'] as const).map(d => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: direction === d }}
              onPress={() => changeDirection(d)}
              style={[styles.toggleOption, direction === d && styles.toggleActive]}>
              <Text style={[styles.toggleLabel, direction === d && styles.toggleLabelActive]}>
                {d === 'debit' ? 'MONEY OUT' : 'MONEY IN'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.amountRow}>
          <Text style={[styles.amountText, !amount && styles.amountPlaceholder]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.inkFaint}
            style={[styles.amountText, styles.amountInput]}
            autoFocus
            accessibilityLabel="Amount"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{direction === 'credit' ? 'RECEIVED FROM' : 'PAID TO'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Optional — e.g. Apollo Pharmacy"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            autoCapitalize="words"
            accessibilityLabel={direction === 'credit' ? 'Received from' : 'Paid to'}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>CATEGORY</Text>
          <Chips options={categories} selected={category} onSelect={setCategory} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{direction === 'credit' ? 'RECEIVED VIA' : 'PAID VIA'}</Text>
          <Chips options={PAYMENT_METHODS} selected={method} onSelect={setMethod} />
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>DATE</Text>
            <DayStepper value={day} onChange={setDay} max={today} accessibilityLabel="Date" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>NOTE</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            maxLength={120}
            accessibilityLabel="Note"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="SAVE TRANSACTION" onPress={save} loading={saving} style={styles.save} />
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
  toggle: { flexDirection: 'row', gap: 8 },
  toggleOption: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.inkMuted },
  toggleLabelActive: { color: colors.background },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
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
  input: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 8,
    marginTop: -8,
  },
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: 4 },
  save: { marginTop: 16 },
});
