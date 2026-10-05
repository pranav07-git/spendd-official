import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from '../../components/Avatar';
import { TextButton } from '../../components/Buttons';
import { ChevronForwardIcon } from '../../components/Icons';
import { AI_MODEL } from '../../insights/aiPrompt';
import { lifetimeStats } from '../../insights/engine';
import type { AiModel } from '../../insights/useAiModel';
import { getStatement, type ImportedStatement, type Profile } from '../../storage/appState';
import { wipeAllData } from '../../storage/reset';
import { disableBiometrics, enableBiometrics, getBiometryType, isBiometricsEnabled } from '../../storage/secure';
import { budgetStatus, type Budget } from '../../transactions/budget';
import { emojiFor } from '../../transactions/categories';
import { transactionsToCsv } from '../../transactions/csv';
import { formatDate, formatRupees } from '../../transactions/format';
import { clearTransactions } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';
import { colors, fonts } from '../../theme';
import { FadeIn, SectionTitle } from './HomeSections';

type Props = {
  profile: Profile;
  transactions: Transaction[];
  budget: Budget | null;
  aiModel: AiModel;
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
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronForwardIcon size={18} color={danger ? colors.danger : colors.inkMuted} strokeWidth={2} /> : null)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      android_ripple={{ color: '#1A1A1A' }}
      style={[styles.row, !first && styles.rowDivider]}>
      {content}
    </Pressable>
  ) : (
    <View style={[styles.row, !first && styles.rowDivider]} accessible accessibilityLabel={value ? `${label}, ${value}` : label}>
      {content}
    </View>
  );
}

const mb = (bytes: number) => Math.round(bytes / 1e6);

/** Download, switch on/off, and delete the on-device model. */
function AiSection({ ai, onToast }: { ai: AiModel; onToast: (message: string) => void }) {
  const confirmDownload = () => {
    const lowRam = ai.memoryBytes != null && ai.memoryBytes < AI_MODEL.minMemoryBytes;
    Alert.alert(
      'Download Spendd AI?',
      `Spendd AI is a small language model (${AI_MODEL.name}) that runs entirely on your phone and writes personal insights from your spending. Nothing is sent anywhere.

It’s a one-time ${mb(AI_MODEL.bytes)} MB download, so Wi-Fi is best.${
        lowRam ? `

Your phone has ${(ai.memoryBytes! / 1024 ** 3).toFixed(1)} GB of RAM, so Spendd AI may be slow on it.` : ''
      }`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => ai.download().catch(() => onToast('Couldn’t start the download')),
        },
      ],
    );
  };

  const confirmDelete = () =>
    Alert.alert('Delete Spendd AI?', `This frees ${mb(AI_MODEL.bytes)} MB. Insights go back to Spendd’s built-in engine.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => ai.remove() },
    ]);

  switch (ai.phase) {
    case 'checking':
      return <Row first label="Spendd AI" value="Checking…" />;
    case 'none':
      return (
        <Row first label="Get Spendd AI" value={`AI insights written on your phone • ${mb(AI_MODEL.bytes)} MB`} onPress={confirmDownload} />
      );
    case 'failed':
      return <Row first label="Spendd AI" value={`${ai.reason ?? 'Download failed'}. Tap to try again.`} onPress={confirmDownload} />;
    case 'downloading':
    case 'paused': {
      const pct = ai.totalBytes > 0 ? Math.floor((ai.downloadedBytes / ai.totalBytes) * 100) : 0;
      return (
        <>
          <Row
            first
            label="Downloading Spendd AI"
            value={
              ai.phase === 'paused'
                ? `Waiting for a connection • ${pct}%`
                : `${pct}% • ${mb(ai.downloadedBytes)} of ${mb(ai.totalBytes)} MB`
            }
          />
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: pct }}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Row label="Cancel download" danger onPress={() => ai.cancel()} />
        </>
      );
    }
    case 'verifying':
      return <Row first label="Spendd AI" value="Checking the download…" right={<ActivityIndicator color={colors.ink} />} />;
    case 'ready':
      return (
        <>
          <Row
            first
            label="Spendd AI"
            value={ai.enabled ? 'On • writes your insights on this phone' : 'Off • using the built-in engine'}
            right={
              <Switch
                value={ai.enabled}
                onValueChange={on => ai.setEnabled(on)}
                trackColor={{ false: colors.track, true: colors.ink }}
                thumbColor={ai.enabled ? colors.background : colors.inkMuted}
                accessibilityLabel="Spendd AI"
              />
            }
          />
          <Row label="Model" value={`${AI_MODEL.name} • ${mb(AI_MODEL.bytes)} MB on this phone`} />
          <Row label="Delete model" danger onPress={confirmDelete} />
        </>
      );
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
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
  aiModel,
  onEditProfile,
  onSetBudget,
  onChangePin,
  onLock,
  onReset,
  onReload,
  onToast,
}: Props) {
  const [statement, setStatement] = useState<ImportedStatement | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [togglingBiometrics, setTogglingBiometrics] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getStatement().then(setStatement, () => setStatement(null));
      getBiometryType().then(type => setBiometricsAvailable(type != null), () => setBiometricsAvailable(false));
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
    <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
      <FadeIn index={0}>
        <View style={styles.identity}>
          <Avatar profile={profile} size={96} />
          <Text style={styles.name} accessibilityRole="header">
            {profile.name}
          </Text>
          <Text style={styles.since}>
            {stats.since != null ? `TRACKING SINCE ${formatDate(stats.since).toUpperCase()}` : 'NEW TO SPENDD'}
          </Text>
          <TextButton label="EDIT PROFILE" color={colors.ink} onPress={onEditProfile} />
        </View>
      </FadeIn>

      <FadeIn index={1}>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Stat label="THIS MONTH" value={formatRupees(Math.round(stats.thisMonth))} />
            <Stat label="ALL TIME" value={formatRupees(Math.round(stats.totalSpent))} />
          </View>
          <View style={[styles.statRow, styles.rowDivider]}>
            <Stat label="TRANSACTIONS" value={String(stats.transactions)} />
            <Stat
              label="TOP CATEGORY"
              value={stats.topCategory ? `${emojiFor(stats.topCategory)} ${stats.topCategory}` : '—'}
            />
          </View>
          <View style={[styles.statRow, styles.rowDivider]}>
            <Stat label="DAYS TRACKED" value={String(stats.daysTracked)} />
            <Stat
              label="BUDGET USED"
              value={status ? `${Math.round(status.usedFraction * 100)}%` : '—'}
            />
          </View>
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <SectionTitle title="Budget" />
        <View style={styles.card}>
          <Row
            first
            label={budget ? `${PERIOD_NAME[budget.period]} budget` : 'No budget set'}
            value={
              budget && status
                ? `${formatRupees(budget.amount)} • ${status.period.label}`
                : 'Set one to get daily limits and alerts'
            }
            onPress={onSetBudget}
          />
        </View>

        <SectionTitle title="Spendd AI" />
        <View style={styles.card}>
          <AiSection ai={aiModel} onToast={onToast} />
        </View>

        <SectionTitle title="Security" />
        <View style={styles.card}>
          <Row first label="Change PIN" onPress={onChangePin} />
          <Row
            label="Biometric unlock"
            value={biometricsAvailable ? 'Fingerprint or face to unlock' : 'Not set up on this phone'}
            right={
              togglingBiometrics ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Switch
                  value={biometricsOn}
                  disabled={!biometricsAvailable && !biometricsOn}
                  onValueChange={toggleBiometrics}
                  trackColor={{ false: colors.track, true: colors.ink }}
                  thumbColor={biometricsOn ? colors.background : colors.inkMuted}
                  accessibilityLabel="Biometric unlock"
                />
              )
            }
          />
          <Row label="Lock app now" onPress={onLock} />
        </View>

        <SectionTitle title="Your Data" />
        <View style={styles.card}>
          <Row
            first
            label="Bank statement"
            value={statement ? `${statement.name} • ${formatDate(Date.parse(statement.importedAt))}` : 'None imported'}
          />
          <Row label="Export transactions" value="As a CSV for Excel or Sheets" onPress={exportCsv} />
          <Row label="Clear all transactions" danger onPress={confirmClear} />
          <Row label="Reset Spendd" value="Erase everything on this phone" danger onPress={confirmReset} />
        </View>

        <Text style={styles.footer}>YOUR DATA AND INSIGHTS STAY ON THIS PHONE</Text>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  feed: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },
  identity: { alignItems: 'center', marginBottom: 24 },
  name: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 40,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 20,
  },
  since: { fontFamily: fonts.sans, fontSize: 12, letterSpacing: 2, color: colors.inkMuted, marginTop: 6 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    overflow: 'hidden',
  },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, paddingHorizontal: 20, paddingVertical: 18 },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2, color: colors.inkMuted },
  statValue: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 32, color: colors.ink, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink },
  rowValue: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkMuted, marginTop: 3 },
  danger: { color: colors.danger },
  progressTrack: { height: 4, backgroundColor: colors.track, marginHorizontal: 20, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.ink },
  footer: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 32,
  },
});
