import { ScrollView, Text, View } from 'react-native';
import { PrimaryButton, TextButton } from '../../components/Buttons';
import { Card, StoryHeader } from '../../components/Layout';
import { budgetStatus, periodFor, type Budget } from '../../transactions/budget';
import { formatDayMonth, formatRupees } from '../../transactions/format';
import { paymentCount } from '../../transactions/summary';
import type { Transaction } from '../../transactions/types';
import { makeStyles, SCREEN_PADDING, space, radius, type, useTheme } from '../../theme';
import { CategoryBreakdown } from './CategoryBreakdown';
import { FadeIn, SectionTitle } from './HomeSections';
import { TAB_BAR_CLEARANCE } from './TabBar';

type Props = {
  transactions: Transaction[];
  /** Loaded by HomeScreen; null when none is set. */
  budget: Budget | null;
  onOpen: (transaction: Transaction) => void;
  onSetBudget: () => void;
};

const PERIOD_LABEL: Record<Budget['period'], string> = {
  month: 'Monthly budget',
  week: 'Weekly budget',
  custom: 'Custom budget',
};

// With no budget set, still show what this month has cost so far.
const THIS_MONTH: Budget = { amount: 0, period: 'month' };

/** The 1st tab: a budget for this month, this week or any custom dates, and where the money went. */
export function AccountsTab({ transactions, budget, onOpen, onSetBudget }: Props) {
  const s = useStyles();
  const { c } = useTheme();
  const status = budgetStatus(budget ?? THIS_MONTH, transactions);
  const over = budget != null && status.remaining < 0;
  const usedPct = Math.round(status.usedFraction * 100);
  const fillColor = over || status.usedFraction >= 0.75 ? c.headsup : c.peacock;

  let statusLine: string;
  if (!budget) {
    statusLine = `${formatRupees(status.spent)} spent so far this month.`;
  } else if (status.state === 'upcoming') {
    statusLine = `Your budget starts on ${formatDayMonth(status.period.start)}.`;
  } else if (status.state === 'ended') {
    statusLine = over
      ? `Ended ${formatRupees(-status.remaining)} over budget.`
      : `Ended with ${formatRupees(status.remaining)} to spare. Nice.`;
  } else if (over) {
    statusLine = `${formatRupees(-status.remaining)} over, with ${status.daysLeft} ${status.daysLeft === 1 ? 'day' : 'days'} to go. Want to slow down a bit?`;
  } else {
    statusLine = `You can spend up to ${formatRupees(status.perDay)} a day to stay on budget.`;
  }

  return (
    <ScrollView contentContainerStyle={s.feed} showsVerticalScrollIndicator={false}>
      <FadeIn index={0}>
        <Text style={s.title} accessibilityRole="header">
          Budget
        </Text>
        <StoryHeader story={statusLine} caption={periodFor(budget ?? THIS_MONTH).label} style={s.story} />
      </FadeIn>

      <FadeIn index={1}>
        {budget ? (
          <Card style={s.firstCard}>
            <View style={s.labelRow}>
              <Text style={s.cardLabel}>{PERIOD_LABEL[budget.period]}</Text>
              <TextButton label="Edit" onPress={onSetBudget} style={s.edit} />
            </View>

            <View
              style={s.amountRow}
              accessible
              accessibilityLabel={`${formatRupees(status.spent)} spent of ${formatRupees(budget.amount)}`}>
              <Text style={s.heroAmount}>{formatRupees(status.spent)}</Text>
              <Text style={s.heroCaption}>spent of {formatRupees(budget.amount)}</Text>
            </View>

            <View
              style={s.track}
              accessibilityRole="progressbar"
              accessibilityLabel={`${usedPct}% of budget used`}
              accessibilityValue={{ min: 0, max: 100, now: Math.min(usedPct, 100) }}>
              <View style={[s.trackFill, { backgroundColor: fillColor, width: `${Math.min(usedPct, 100)}%` }]} />
            </View>
            <View style={s.metaRow}>
              <Text style={[s.meta, over && s.metaOver]}>
                {over ? `${formatRupees(-status.remaining)} over` : `${formatRupees(status.remaining)} left`}
              </Text>
              <Text style={s.meta}>
                {status.state === 'ended'
                  ? 'Ended'
                  : `${status.daysLeft} ${status.daysLeft === 1 ? 'day' : 'days'} ${status.state === 'upcoming' ? 'long' : 'to go'}`}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={s.firstCard}>
            <Text style={s.cardLabel}>This month</Text>
            <View style={s.amountRow}>
              <Text style={s.heroAmount}>{formatRupees(status.spent)}</Text>
              <Text style={s.heroCaption}>spent so far</Text>
            </View>
            <Text style={s.statusLine}>
              Set a budget for the month, or for a stretch of days like a trip, and Spendd keeps count from your
              spends.
            </Text>
            <PrimaryButton label="Set a budget" onPress={onSetBudget} style={s.cta} />
          </Card>
        )}
      </FadeIn>

      <FadeIn index={2}>
        <SectionTitle title="Where it went" />
        {status.spending.categories.length > 0 ? (
          <>
            <Text style={s.sectionCaption}>
              {paymentCount(status.spending.count)} · {status.period.label}
            </Text>
            <CategoryBreakdown categories={status.spending.categories} showDates onOpen={onOpen} />
          </>
        ) : (
          <Text style={s.empty}>
            {status.state === 'upcoming'
              ? 'This budget hasn’t started yet.'
              : 'No spends in this period yet. Share your next UPI screenshot to start.'}
          </Text>
        )}
      </FadeIn>
    </ScrollView>
  );
}

const useStyles = makeStyles(c => ({
  feed: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[2], paddingBottom: TAB_BAR_CLEARANCE },
  title: { ...type.heading, color: c.inkMuted },
  story: { marginTop: space[1] },
  firstCard: { marginTop: space[6] },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -space[3] },
  cardLabel: { ...type.eyebrow, color: c.inkMuted },
  edit: { alignSelf: 'auto', paddingHorizontal: space[2], marginRight: -space[2] },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space[2], marginTop: space[1] },
  heroAmount: { ...type.amountHero, color: c.ink },
  heroCaption: { ...type.body, color: c.inkMuted },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSunken,
    marginTop: space[4],
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: radius.pill },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[2] },
  meta: { ...type.label, color: c.ink, fontVariant: ['tabular-nums'] },
  metaOver: { color: c.headsup },
  statusLine: { ...type.body, color: c.ink, marginTop: space[3] },
  cta: { marginTop: space[6] },

  sectionCaption: { ...type.caption, color: c.inkMuted, marginTop: -space[1], marginBottom: space[3] },
  empty: { ...type.body, color: c.inkMuted },
}));
