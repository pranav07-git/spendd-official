import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from '../../components/Avatar';
import { TextButton } from '../../components/Buttons';
import { ChevronForwardIcon } from '../../components/Icons';
import { Card, PrivacyBadge, SectionHeading } from '../../components/Layout';
import { lifetimeStats } from '../../insights/engine';
import type { Profile } from '../../storage/appState';
import { wipeAllData } from '../../storage/reset';
import { disableBiometrics, enableBiometrics, getBiometryType, isBiometricsEnabled } from '../../storage/secure';
import { budgetStatus, type Budget } from '../../transactions/budget';
import { transactionsToCsv } from '../../transactions/csv';
import { formatDate, formatRupees } from '../../transactions/format';
import { clearTransactions } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';
import { signOut } from '../../auth/firebase';
import {
  makeStyles,
  SCREEN_PADDING,
  SECTION_GAP,
  space,
  type,
  useTheme,
  type Palette,
} from '../../theme';
import { FadeIn } from './HomeSections';
import { TAB_BAR_CLEARANCE } from './TabBar';

type Props = {
  profile: Profile;
  transactions: Transaction[];
  budget: Budget | null;
  onEditProfile: () => void;
  onSetBudget: () => void;
  onChangePin: () => void;
  onLock: () => void;
  /** After everything is wiped: back to onboarding. */
  onReset: () => void;
  onReload: () => Promise<void>;
  onToast: (message: string) => void;
};

const PERIOD_NAME: Record<Budget['period'], string> = { month: 'Monthly', week: 'Weekly', custom: 'Custom' };

/** On = the blue selection accent (docs/DESIGN.md). */
const switchColors = (c: Palette, isDark: boolean) => ({
  trackColor: { false: c.surfaceSunken, true: c.info },
  thumbColor: isDark ? c.ink : c.surface,
});

function Row({
  label,
  value,
  danger,
  onPress,
  right,
  first,
}: {
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  right?: ReactNode;
  first?: boolean;
}) {
  const s = useStyles();
  const { c } = useTheme();
  const content = (
    <>
      <View style={s.rowText}>
        <Text style={[s.rowLabel, danger && s.danger]}>{label}</Text>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronForwardIcon size={18} color={danger ? c.low : c.inkMuted} strokeWidth={2} /> : null)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      android_ripple={{ color: c.surfaceSunken }}
      style={({ pressed }) => [s.row, !first && s.rowDivider, pressed && s.rowPressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={[s.row, !first && s.rowDivider]} accessible accessibilityLabel={value ? `${label}, ${value}` : label}>
      {content}
    </View>
  );
}

/** What Spendd AI sends, and how it learns. */
function AiSection() {
  return (
    <>
      <Row
        first
        label="What’s sent"
        value="Monthly totals, and the names and UPI IDs of businesses you pay. Never screenshots, your transaction list, or anything about people you pay."
      />
      <Row
        label="Learning"
        value="When you change a payment’s category, Spendd uses it for that payee from then on. This stays on your phone."
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/** The 5th tab: who you are, your numbers, security and data controls. */
export function ProfileTab({
  profile,
  transactions,
  budget,
  onEditProfile,
  onSetBudget,
  onChangePin,
  onLock,
  onReset,
  onReload,
  onToast,
}: Props) {
  const s = useStyles();
  const { c, isDark } = useTheme();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [togglingBiometrics, setTogglingBiometrics] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getBiometryType().then(kind => setBiometricsAvailable(kind != null), () => setBiometricsAvailable(false));
      isBiometricsEnabled().then(setBiometricsOn, () => setBiometricsOn(false));
    }, []),
  );

  const stats = lifetimeStats(transactions);
  const status = budget ? budgetStatus(budget, transactions) : null;

  const toggleBiometrics = async (on: boolean) => {
    setTogglingBiometrics(true);
    try {
      if (on) {
        await enableBiometrics(); // shows the system prompt
        onToast('Biometric unlock is on');
      } else {
        await disableBiometrics();
        onToast('Biometric unlock is off');
      }
      setBiometricsOn(on);
    } catch {
      onToast('Biometric setup didn’t complete');
    } finally {
      setTogglingBiometrics(false);
    }
  };

  const exportCsv = async () => {
    if (transactions.length === 0) {
      onToast('Nothing to export yet');
      return;
    }
    try {
      await Share.share({ title: 'Spendd transactions', message: transactionsToCsv(transactions) });
    } catch {
      onToast('Couldn’t open the share sheet');
    }
  };

  const confirmClear = () =>
    Alert.alert(
      'Clear all transactions?',
      `All ${transactions.length} transactions will be deleted from this phone. Export them first if you want a copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearTransactions();
            await onReload();
            onToast('Transactions cleared');
          },
        },
      ],
    );

  const confirmReset = () =>
    Alert.alert(
      'Reset Spendd?',
      'This removes your PIN, biometric unlock, transactions, budget and profile from this phone, and you’ll set up Spendd again. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await wipeAllData();
            onReset();
          },
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={s.feed} showsVerticalScrollIndicator={false}>
      <FadeIn index={0}>
        <View style={s.identity}>
          <Avatar profile={profile} size={80} />
          <View style={s.identityText}>
            <Text style={s.name} accessibilityRole="header" numberOfLines={2}>
              {profile.name}
            </Text>
            <Text style={s.since}>
              {stats.since != null ? `Tracking since ${formatDate(stats.since)}` : 'New to Spendd'}
            </Text>
          </View>
        </View>
        <TextButton label="Edit profile" onPress={onEditProfile} style={s.editProfile} />
      </FadeIn>

      <FadeIn index={1}>
        <Card padded={false} style={s.statsCard}>
          <View style={s.statRow}>
            <Stat label="Spent this month" value={formatRupees(Math.round(stats.thisMonth))} />
            <Stat label="Spent all time" value={formatRupees(Math.round(stats.totalSpent))} />
          </View>
          <View style={[s.statRow, s.rowDivider]}>
            <Stat label="Payments logged" value={String(stats.transactions)} />
            <Stat
              label="Top category"
              value={stats.topCategory ?? '—'}
            />
          </View>
          <View style={[s.statRow, s.rowDivider]}>
            <Stat label="Days tracked" value={String(stats.daysTracked)} />
            <Stat label="Budget used" value={status ? `${Math.round(status.usedFraction * 100)}%` : '—'} />
          </View>
        </Card>
      </FadeIn>

      <FadeIn index={2}>
        <SectionHeading title="Budget" />
        <Card padded={false}>
          <Row
            first
            label={budget ? `${PERIOD_NAME[budget.period]} budget` : 'No budget set'}
            value={
              budget && status
                ? `${formatRupees(budget.amount)} • ${status.period.label}`
                : 'Set one to get a daily limit and heads-ups'
            }
            onPress={onSetBudget}
          />
        </Card>

        <SectionHeading title="Spendd data processing" />
        <Card padded={false}>
          <AiSection />
        </Card>

        <SectionHeading title="Security" />
        <Card padded={false}>
          <Row first label="Change PIN" onPress={onChangePin} />
          <Row
            label="Biometric unlock"
            value={biometricsAvailable ? 'Fingerprint or face to unlock' : 'Not set up on this phone'}
            right={
              togglingBiometrics ? (
                <ActivityIndicator color={c.ink} />
              ) : (
                <Switch
                  value={biometricsOn}
                  disabled={!biometricsAvailable && !biometricsOn}
                  onValueChange={toggleBiometrics}
                  {...switchColors(c, isDark)}
                  accessibilityLabel="Biometric unlock"
                />
              )
            }
          />
          <Row label="Lock app now" onPress={onLock} />
          <Row
            label="Sign out"
            danger
            onPress={() =>
              Alert.alert(
                'Sign out?',
                "You'll need to sign in again to access Spendd. Your local data stays on this phone.",
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => signOut().catch(() => {}),
                  },
                ],
              )
            }
          />
        </Card>

        <SectionHeading title="Your data" />
        <Card padded={false}>
          <Row label="Export transactions" value="As a CSV for Excel or Sheets" onPress={exportCsv} />
          <Row label="Clear all transactions" danger onPress={confirmClear} />
          <Row label="Reset Spendd" value="Erase everything on this phone" danger onPress={confirmReset} />
        </Card>

        <PrivacyBadge text="Your transactions stay on this phone." style={s.footer} />
      </FadeIn>
    </ScrollView>
  );
}

const useStyles = makeStyles(c => ({
  feed: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[6], paddingBottom: TAB_BAR_CLEARANCE },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  identityText: { flex: 1 },
  name: { ...type.story, color: c.ink },
  since: { ...type.caption, color: c.inkMuted, marginTop: space[1] },
  editProfile: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: space[2], marginBottom: space[4] },
  statsCard: { marginTop: space[2] },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, paddingHorizontal: space[4], paddingVertical: space[4] },
  statLabel: { ...type.eyebrow, color: c.inkMuted },
  statValue: { ...type.amountMedium, color: c.ink, marginTop: space[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  rowPressed: { backgroundColor: c.surfaceSunken },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.line },
  rowText: { flex: 1 },
  rowLabel: { ...type.bodyStrong, color: c.ink },
  rowValue: { ...type.caption, color: c.inkMuted, marginTop: 2 },
  danger: { color: c.low },
  footer: { alignSelf: 'center', marginTop: SECTION_GAP },
}));
