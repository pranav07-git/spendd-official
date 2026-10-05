import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { Chips } from '../components/Chips';
import { Header } from '../components/Header';
import { AlertTriangleIcon } from '../components/Icons';
import { Card } from '../components/Layout';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { categoriesFor, kindFor } from '../transactions/categories';
import { formatDate, formatRupees, formatTime, signedAmount, titleFor } from '../transactions/format';
import { removeTransaction, updateTransaction } from '../transactions/store';
import type { Transaction } from '../transactions/types';
import { makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, TOUCH_TARGET, type, useTheme } from '../theme';
import { PayeeAvatar } from '../components/PayeeAvatar';

function Row({ label, children, first }: { label: string; children: ReactNode; first?: boolean }) {
  const s = useStyles();
  return (
    <View style={[s.row, !first && s.rowDivider]}>
      <Text style={s.label}>{label}</Text>
      {typeof children === 'string' ? (
        <Text style={s.value} numberOfLines={1} selectable>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

/** Spent / Received as two chips. */
function DirectionToggle({
  value,
  onChange,
}: {
  value: Transaction['direction'];
  onChange: (d: Transaction['direction']) => void;
}) {
  const s = useStyles();
  return (
    <View style={s.toggle}>
      {(['debit', 'credit'] as const).map(d => (
        <Pressable
          key={d}
          accessibilityRole="button"
          accessibilityState={{ selected: value === d }}
          onPress={() => onChange(d)}
          style={({ pressed }) => [s.toggleOption, value === d && s.toggleActive, pressed && s.pressed]}>
          <Text style={s.toggleLabel}>{d === 'debit' ? 'Spent' : 'Received'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Corrects what OCR read (or fills in what it couldn't). */
function EditCard({ tx, onSaved }: { tx: Transaction; onSaved: (tx: Transaction) => void }) {
  const s = useStyles();
  const { c } = useTheme();
  const [amount, setAmount] = useState(tx.amount != null ? String(tx.amount) : '');
  const [name, setName] = useState(tx.counterparty ?? '');
  const [direction, setDirection] = useState(tx.direction);
  const [category, setCategory] = useState(tx.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const value = Number(amount.replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Add the amount that was paid to save this.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateTransaction(tx.id, {
        amount: value,
        counterparty: name.trim() || null,
        direction,
        category,
        kind: kindFor(category),
        needsReview: false,
      });
      if (updated) {
        onSaved(updated);
      }
    } catch {
      setError('Couldn’t save your changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={s.card}>
      <View style={s.field}>
        <Text style={s.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="₹0"
          placeholderTextColor={c.inkSubtle}
          style={s.input}
          accessibilityLabel="Amount"
        />
      </View>
      <View style={s.field}>
        <Text style={s.label}>{direction === 'credit' ? 'Received from' : 'Paid to'}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name or UPI ID"
          placeholderTextColor={c.inkSubtle}
          style={s.input}
          autoCapitalize="words"
          accessibilityLabel="Paid to"
        />
      </View>
      <DirectionToggle value={direction} onChange={setDirection} />
      <View style={s.field}>
        <Text style={s.label}>Category</Text>
        <Chips options={categoriesFor(direction)} selected={category} onSelect={setCategory} />
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <PrimaryButton label="Save changes" onPress={save} loading={saving} />
    </Card>
  );
}

/** Exactly what on-device OCR read from the screenshot, for checking or reporting a misread. */
function ScannedText({ text }: { text: string }) {
  const s = useStyles();
  const [open, setOpen] = useState(false);
  const lines = text.split('\n');
  return (
    <Card style={s.card}>
      <View style={s.scannedHead}>
        <Text style={s.cardTitle}>Scanned text</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share scanned text"
          onPress={() => Share.share({ message: text }).catch(() => {})}
          style={({ pressed }) => [s.smallAction, pressed && s.pressed]}>
          <Text style={s.smallActionLabel}>Share</Text>
        </Pressable>
      </View>
      <Text style={s.scanned} selectable>
        {(open ? lines : lines.slice(0, 4)).join('\n')}
      </Text>
      {lines.length > 4 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(o => !o)}
          style={({ pressed }) => [s.smallAction, s.smallActionStart, pressed && s.pressed]}>
          <Text style={s.smallActionLabel}>{open ? 'Show less' : `Show all ${lines.length} lines`}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function TransactionDetailsScreen({ navigation, route }: ScreenProps<'TransactionDetails'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [tx, setTx] = useState(route.params.transaction);
  const [editing, setEditing] = useState(tx.amount == null);
  const credit = tx.direction === 'credit';

  const confirmDelete = () =>
    Alert.alert(
      credit ? 'Delete this payment?' : 'Delete this spend?',
      `${titleFor(tx)} (${signedAmount(tx)}) will be removed from Spendd.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeTransaction(tx.id);
            navigation.goBack();
          },
        },
      ],
    );

  return (
    <Screen>
      <Header title={credit ? 'Money received' : 'Spend'} onBack={navigation.goBack} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <PayeeAvatar tx={tx} size={64} />
          <Text style={s.name}>{titleFor(tx)}</Text>
          <Text style={s.kind}>
            {tx.manual ? 'Added by hand' : tx.kind === 'personal' ? 'Personal payment' : 'Business payment'}
          </Text>
          {tx.amount == null ? (
            <Text style={[s.amount, s.amountMissing]}>₹ —</Text>
          ) : (
            <Text style={[s.amount, credit && s.amountIn]} accessibilityLabel={`${formatRupees(tx.amount)} ${credit ? 'received' : 'spent'}`}>
              {credit ? `+${formatRupees(tx.amount)}` : formatRupees(tx.amount)}
            </Text>
          )}
        </View>

        {tx.needsReview ? (
          <View style={s.review}>
            <AlertTriangleIcon size={18} color={c.headsup} />
            <Text style={s.reviewText}>
              {tx.amount == null
                ? 'We couldn’t read the amount on this screenshot. Add it below.'
                : 'Some details couldn’t be read. Check them below.'}
            </Text>
          </View>
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

        <Card style={s.card}>
          <Row first label="Type">
            <View style={[s.badge, credit ? s.badgeIn : s.badgeOut]}>
              <Text style={s.badgeText}>{credit ? 'Received' : 'Spent'}</Text>
            </View>
          </Row>
          <Row label="Category">{tx.category}</Row>
          <Row label="Bank">{tx.bank ?? tx.source ?? '—'}</Row>
        </Card>

        <Card style={s.card}>
          <Row first label="Date">
            {formatDate(tx.occurredAt)}
          </Row>
          <Row label="Time">{tx.hasTime ? formatTime(tx.occurredAt) : '—'}</Row>
        </Card>

        {tx.note ? (
          <Card style={s.card}>
            <Text style={s.label}>Note</Text>
            <Text style={s.noteText} selectable>
              {tx.note}
            </Text>
          </Card>
        ) : null}

        {tx.handle || tx.txnRef || tx.source ? (
          <Card style={s.card}>
            {tx.handle ? (
              <Row first label="UPI ID">
                {tx.handle}
              </Row>
            ) : null}
            {tx.txnRef ? (
              <Row first={!tx.handle} label="Txn ID">
                {tx.txnRef}
              </Row>
            ) : null}
            {tx.source ? (
              <Row first={!tx.handle && !tx.txnRef} label="Paid via">
                {tx.source}
              </Row>
            ) : null}
          </Card>
        ) : null}

        {!tx.dateFromReceipt && !tx.manual ? (
          <Text style={s.note}>No date was found on the screenshot, so the time you shared it is used.</Text>
        ) : null}

        {tx.rawText ? <ScannedText text={tx.rawText} /> : null}

        <View style={s.actions}>
          {editing ? null : <TextButton label="Edit" onPress={() => setEditing(true)} />}
          <TextButton label="Delete" color={c.low} onPress={confirmDelete} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  pressed: { opacity: 0.7 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SECTION_GAP },
  hero: { alignItems: 'center', paddingTop: space[4], paddingBottom: space[6] },
  name: { ...type.title, color: c.ink, textAlign: 'center', marginTop: space[4] },
  kind: { ...type.caption, color: c.inkMuted, textAlign: 'center', marginTop: space[1] },
  amount: { ...type.amountHero, color: c.ink, marginTop: space[4] },
  amountIn: { color: c.peacock },
  amountMissing: { color: c.inkSubtle },
  card: { marginBottom: space[3] },
  cardTitle: { ...type.heading, color: c.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TOUCH_TARGET,
    gap: space[4],
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.line, marginTop: space[2], paddingTop: space[2] },
  label: { ...type.caption, color: c.inkMuted },
  value: { ...type.body, flexShrink: 1, color: c.ink, textAlign: 'right' },
  badge: { paddingHorizontal: space[3], paddingVertical: space[1], borderRadius: radius.s },
  badgeIn: { backgroundColor: c.peacockSoft },
  badgeOut: { backgroundColor: c.surfaceSunken },
  badgeText: { ...type.label, color: c.ink },
  noteText: { ...type.body, color: c.ink, marginTop: space[1] },
  note: { ...type.caption, color: c.inkMuted, marginTop: space[1], marginBottom: space[3] },
  review: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    marginBottom: space[4],
  },
  reviewText: { ...type.body, flex: 1, color: c.ink },
  field: { gap: space[2], marginBottom: space[4] },
  input: {
    ...type.body,
    color: c.ink,
    minHeight: 48,
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.s,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  toggle: { flexDirection: 'row', gap: space[2], marginBottom: space[4] },
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
  error: { ...type.caption, color: c.low, marginBottom: space[3] },
  scannedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[2] },
  smallAction: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET, alignItems: 'flex-end', justifyContent: 'center' },
  smallActionStart: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  smallActionLabel: { ...type.label, color: c.ink },
  scanned: { fontFamily: 'monospace', fontSize: type.caption.fontSize, lineHeight: type.caption.lineHeight, color: c.inkMuted },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space[4], marginTop: space[6] },
}));
