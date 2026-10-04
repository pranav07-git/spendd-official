import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { ChevronLeftIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { formatDate, formatTime, initialFor, signedAmount, titleFor } from '../transactions/format';
import { removeTransaction, updateTransaction } from '../transactions/store';
import type { Transaction } from '../transactions/types';
import { colors, fonts } from '../theme';

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {typeof children === 'string' ? (
        <Text style={styles.value} numberOfLines={1} selectable>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

/** Corrects what OCR read (or fills in what it couldn't). */
function EditCard({ tx, onSaved }: { tx: Transaction; onSaved: (tx: Transaction) => void }) {
  const [amount, setAmount] = useState(tx.amount != null ? String(tx.amount) : '');
  const [name, setName] = useState(tx.counterparty ?? '');
  const [direction, setDirection] = useState(tx.direction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const value = Number(amount.replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount that was paid.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateTransaction(tx.id, {
        amount: value,
        counterparty: name.trim() || null,
        direction,
        needsReview: false,
      });
      if (updated) {
        onSaved(updated);
      }
    } catch {
      setError('Couldn’t save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>AMOUNT</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="₹0"
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        accessibilityLabel="Amount"
      />
      <Text style={styles.label}>{direction === 'credit' ? 'RECEIVED FROM' : 'PAID TO'}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name or UPI ID"
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        autoCapitalize="words"
        accessibilityLabel="Paid to"
      />
      <View style={styles.toggle}>
        {(['debit', 'credit'] as const).map(d => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: direction === d }}
            onPress={() => setDirection(d)}
            style={[styles.toggleOption, direction === d && styles.toggleActive]}>
            <Text style={[styles.toggleLabel, direction === d && styles.toggleLabelActive]}>
              {d === 'debit' ? 'MONEY OUT' : 'MONEY IN'}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label="SAVE" onPress={save} loading={saving} />
    </View>
  );
}

export function TransactionDetailsScreen({ navigation, route }: ScreenProps<'TransactionDetails'>) {
  const [tx, setTx] = useState(route.params.transaction);
  const [editing, setEditing] = useState(tx.amount == null);
  const credit = tx.direction === 'credit';

  const confirmDelete = () =>
    Alert.alert('Delete transaction?', `${titleFor(tx)} (${signedAmount(tx)}) will be removed from Spendd.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTransaction(tx.id);
          navigation.goBack();
        },
      },
    ]);

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
        <Text style={styles.headerTitle}>Transaction Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialFor(tx)}</Text>
        </View>
        <Text style={styles.name}>{titleFor(tx)}</Text>
        <Text style={styles.kind}>{tx.kind === 'personal' ? 'PERSONAL TRANSACTION' : 'MERCHANT PAYMENT'}</Text>

        {tx.needsReview ? (
          <Text style={styles.review}>
            {tx.amount == null
              ? 'We couldn’t read the amount on this screenshot. Add it below.'
              : 'Some details couldn’t be read. Check them below.'}
          </Text>
        ) : null}

        {editing ? (
          <EditCard
            tx={tx}
            onSaved={updated => {
              setTx(updated);
              setEditing(false);
            }}
          />
        ) : null}

        <Card>
          <Row label="TYPE">
            <View style={[styles.badge, credit ? styles.badgeCredit : styles.badgeDebit]}>
              <Text style={styles.badgeText}>{credit ? 'CREDIT' : 'DEBIT'}</Text>
            </View>
          </Row>
          <Row label="DESCRIPTION">
            <Text style={styles.description}>{tx.category.toLowerCase()}</Text>
          </Row>
        </Card>

        <Card>
          <Row label="BANK">{tx.bank ?? tx.source ?? '—'}</Row>
          <Row label="AMOUNT">
            <Text style={styles.amount}>{signedAmount(tx)}</Text>
          </Row>
        </Card>

        <Card>
          <Row label="DATE">{formatDate(tx.occurredAt)}</Row>
          <Row label="TIME">{tx.hasTime ? formatTime(tx.occurredAt) : '—'}</Row>
        </Card>

        {tx.handle || tx.txnRef || tx.source ? (
          <Card>
            {tx.handle ? <Row label="UPI ID">{tx.handle}</Row> : null}
            {tx.txnRef ? <Row label="TXN ID">{tx.txnRef}</Row> : null}
            {tx.source ? <Row label="PAID VIA">{tx.source}</Row> : null}
          </Card>
        ) : null}

        {!tx.dateFromReceipt ? (
          <Text style={styles.note}>No date was found on the screenshot, so the time it was shared is used.</Text>
        ) : null}

        {editing ? null : <TextButton label="EDIT DETAILS" color={colors.ink} onPress={() => setEditing(true)} style={styles.delete} />}
        <TextButton label="DELETE TRANSACTION" color={colors.danger} onPress={confirmDelete} />
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
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  avatar: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  avatarText: { fontFamily: fonts.serifBold, fontSize: 44, color: '#1A1A1A' },
  name: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 40,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 24,
  },
  kind: {
    fontFamily: fonts.sans,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1C1C1C',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 20,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, gap: 16 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2.2, color: colors.inkMuted },
  value: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink, textAlign: 'right' },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 2 },
  badgeCredit: { backgroundColor: '#22C55E' },
  badgeDebit: { backgroundColor: '#D9534F' },
  badgeText: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 1, color: '#FFFFFF' },
  description: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.ink },
  amount: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink },
  note: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.inkMuted, textAlign: 'center', marginTop: 4 },
  delete: { marginTop: 20 },
  review: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.glow,
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 20,
  },
  input: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 8,
    marginTop: -12,
  },
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
  error: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger },
});
