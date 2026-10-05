import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/Buttons';
import { budgetStatus, periodFor, type Budget } from '../../transactions/budget';
import { formatDayMonth, formatRupees } from '../../transactions/format';
import { paymentCount } from '../../transactions/summary';
import type { Transaction } from '../../transactions/types';
import { colors, fonts } from '../../theme';
import { CategoryBreakdown } from './CategoryBreakdown';
import { FadeIn, SectionTitle } from './HomeSections';

type Props = {
  transactions: Transaction[];
  /** Loaded by HomeScreen; null when none is set. */
  budget: Budget | null;
  onOpen: (transaction: Transaction) => void;
  onSetBudget: () => void;
};

const PERIOD_BADGE: Record<Budget['period'], string> = {
  month: 'MONTHLY BUDGET',
  week: 'WEEKLY BUDGET',
  custom: 'CUSTOM BUDGET',
};

// With no budget set, still show what this month has cost so far.
const THIS_MONTH: Budget = { amount: 0, period: 'month' };

/** The 1st tab: a budget for this month, this week or any custom dates, and where the money went. */
export function AccountsTab({ transactions, budget, onOpen, onSetBudget }: Props) {
  const status = budgetStatus(budget ?? THIS_MONTH, transactions);
  const over = budget != null && status.remaining < 0;
  const usedPct = Math.round(status.usedFraction * 100);

  let statusLine: string;
  if (!budget) {
    statusLine = '';
  } else if (status.state === 'upcoming') {
    statusLine = `Starts on ${formatDayMonth(status.period.start)}.`;
  } else if (status.state === 'ended') {
    statusLine = over
      ? `Ended ${formatRupees(-status.remaining)} over budget.`
      : `Ended with ${formatRupees(status.remaining)} to spare. Nice.`;
  } else if (over) {
    statusLine = `You’re ${formatRupees(-status.remaining)} over. Go easy until ${formatDayMonth(status.period.end - 1)}.`;
  } else {
    statusLine = `Spend up to ${formatRupees(status.perDay)} a day to stay on budget.`;
  }

  return (
    <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
      <FadeIn index={0}>
        <Text style={styles.title} accessibilityRole="header">
          Budget
        </Text>
        <Text style={styles.subtitle}>{periodFor(budget ?? THIS_MONTH).label}</Text>
      </FadeIn>

      <FadeIn index={1}>
        {budget ? (
          <View style={[styles.card, styles.cardPadded, styles.firstCard]}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <View style={styles.badgeSquare} />
                <Text style={styles.badgeLabel}>{PERIOD_BADGE[budget.period]}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit budget"
                hitSlop={12}
                onPress={onSetBudget}
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.edit}>EDIT</Text>
              </Pressable>
            </View>

            <View
              style={styles.amountRow}
              accessible
              accessibilityLabel={`${formatRupees(status.spent)} spent of ${formatRupees(budget.amount)}`}>
              <Text style={styles.heroAmount}>{formatRupees(status.spent)}</Text>
              <Text style={styles.heroCaption}>of {formatRupees(budget.amount)}</Text>
            </View>

            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityLabel={`${usedPct}% of budget used`}
              accessibilityValue={{ min: 0, max: 100, now: Math.min(usedPct, 100) }}>
              <View style={[styles.trackFill, over && styles.trackOver, { width: `${Math.min(usedPct, 100)}%` }]} />
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, over && styles.metaOver]}>
                {over ? `${formatRupees(-status.remaining)} OVER` : `${formatRupees(status.remaining)} LEFT`}
              </Text>
              <Text style={styles.meta}>
                {status.state === 'ended'
                  ? 'ENDED'
                  : `${status.daysLeft} ${status.daysLeft === 1 ? 'DAY' : 'DAYS'} ${status.state === 'upcoming' ? 'LONG' : 'TO GO'}`}
              </Text>
            </View>
            <Text style={styles.statusLine}>{statusLine}</Text>
          </View>
        ) : (
          <View style={[styles.card, styles.cardPadded, styles.firstCard]}>
            <View style={styles.badge}>
              <View style={styles.badgeSquare} />
              <Text style={styles.badgeLabel}>THIS MONTH</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.heroAmount}>{formatRupees(status.spent)}</Text>
              <Text style={styles.heroCaption}>spent so far</Text>
            </View>
            <Text style={styles.statusLine}>
              Set a budget for the month, or for any stretch of days like a trip, and Spendd keeps count from your
              transactions.
            </Text>
            <PrimaryButton label="SET A BUDGET" withArrow onPress={onSetBudget} style={styles.cta} />
          </View>
        )}
      </FadeIn>

      <FadeIn index={2}>
        <SectionTitle title="Where It Went" />
        {status.spending.categories.length > 0 ? (
          <>
            <Text style={styles.sectionCaption}>
              {paymentCount(status.spending.count).toUpperCase()} • {status.period.label.toUpperCase()}
            </Text>
            <CategoryBreakdown categories={status.spending.categories} showDates onOpen={onOpen} />
          </>
        ) : (
          <Text style={styles.empty}>
            {status.state === 'upcoming' ? 'This budget hasn’t started yet.' : 'No spending in this period yet.'}
          </Text>
        )}
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  feed: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 40 },
  title: { fontFamily: fonts.serif, fontSize: 31, lineHeight: 40, color: colors.ink },
  subtitle: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.inkMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardPadded: { padding: 24 },
  firstCard: { marginTop: 26 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeSquare: { width: 7, height: 7, backgroundColor: colors.ink },
  badgeLabel: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 1.6, color: colors.ink },
  edit: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 2, color: colors.ink },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 14 },
  heroAmount: { fontFamily: fonts.serif, fontSize: 50, lineHeight: 66, color: colors.ink },
  heroCaption: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.inkMuted, marginLeft: 10 },
  track: { height: 6, backgroundColor: colors.track, marginTop: 18, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.ink },
  trackOver: { backgroundColor: colors.danger },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 0.6, color: colors.ink },
  metaOver: { color: colors.danger },
  statusLine: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: 16 },
  cta: { marginTop: 24 },

  sectionCaption: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.inkMuted,
    marginTop: -6,
    marginBottom: 14,
  },
  empty: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkMuted },
});
