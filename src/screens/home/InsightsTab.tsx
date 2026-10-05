import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OutlineButton } from '../../components/Buttons';
import { BotIcon } from '../../components/Icons';
import { AI_MODEL } from '../../insights/aiPrompt';
import type { Forecast, InsightsReport } from '../../insights/types';
import type { AiInsights } from '../../insights/useAiInsights';
import type { AiModel } from '../../insights/useAiModel';
import { formatDayMonth, formatRupees } from '../../transactions/format';
import { paymentCount, todaysSpending } from '../../transactions/summary';
import type { Transaction } from '../../transactions/types';
import { colors, fonts } from '../../theme';
import { CategoryBreakdown } from './CategoryBreakdown';
import { AiNote, FadeIn, InsightsCard, SectionTitle } from './HomeSections';

type Props = {
  report: InsightsReport;
  ai: AiInsights;
  aiModel: AiModel;
  transactions: Transaction[];
  onOpen: (transaction: Transaction) => void;
  onAdd: () => void;
  onSetBudget: () => void;
  /** Opens the Spendd AI settings in Profile. */
  onSetUpAi: () => void;
};

/** Spent so far, then the projected rest, against the budget marker if there is one. */
function PaceBar({ forecast }: { forecast: Forecast }) {
  const scale = Math.max(forecast.high, forecast.budget ?? 0, 1) * 1.05;
  const spentPct = (forecast.spent / scale) * 100;
  const projectedPct = (Math.max(0, forecast.projected - forecast.spent) / scale) * 100;
  const budgetPct = forecast.budget != null ? (forecast.budget / scale) * 100 : null;
  const over = forecast.budget != null && forecast.projected > forecast.budget;
  return (
    <View
      accessible
      accessibilityLabel={`Spent ${formatRupees(forecast.spent)}, projected ${formatRupees(forecast.projected)}${
        forecast.budget != null ? `, budget ${formatRupees(forecast.budget)}` : ''
      }`}>
      <View style={styles.paceTrack}>
        <View style={[styles.paceSpent, { width: `${spentPct}%` }]} />
        <View style={[styles.paceProjected, over && styles.paceOver, { width: `${projectedPct}%` }]} />
        {budgetPct != null ? <View style={[styles.budgetMarker, { left: `${budgetPct}%` }]} /> : null}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.paceSpent]} />
          <Text style={styles.legendLabel}>SPENT {formatRupees(forecast.spent)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.paceProjected, over && styles.paceOver]} />
          <Text style={styles.legendLabel}>PROJECTED</Text>
        </View>
        {forecast.budget != null ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.budgetSwatch]} />
            <Text style={styles.legendLabel}>BUDGET</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The 4th tab: the on-device model's forecast, tips and patterns, plus today's breakdown. */
export function InsightsTab({ report, ai, aiModel, transactions, onOpen, onAdd, onSetBudget, onSetUpAi }: Props) {
  const { forecast } = report;
  const headline = report.insights.find(i => i.id === 'forecast');
  const tips = report.insights.filter(i => i.id !== 'forecast');
  const today = todaysSpending(transactions);
  const hasSpending = forecast.spent > 0 || forecast.pace > 0;

  return (
    <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
      <FadeIn index={0}>
        <Text style={styles.title} accessibilityRole="header">
          Insights
        </Text>
        <Text style={styles.subtitle}>Your spending coach, running on this phone</Text>
      </FadeIn>

      <FadeIn index={1}>
        <View style={[styles.card, styles.cardPadded, styles.firstCard]}>
          <View style={styles.badge}>
            <View style={styles.badgeSquare} />
            <Text style={styles.badgeLabel}>AT THIS RATE</Text>
          </View>

          {hasSpending ? (
            <>
              <View
                style={styles.amountRow}
                accessible
                accessibilityLabel={`About ${formatRupees(forecast.projected)} by ${formatDayMonth(forecast.lastDay)}`}>
                <Text style={styles.heroAmount}>{formatRupees(forecast.projected)}</Text>
                <Text style={styles.heroCaption}>by {formatDayMonth(forecast.lastDay)}</Text>
              </View>
              <Text style={styles.range}>
                LIKELY {formatRupees(forecast.low)} – {formatRupees(forecast.high)} • ~{formatRupees(forecast.pace)} A DAY
              </Text>
              <PaceBar forecast={forecast} />
              {headline ? (
                <>
                  <Text style={styles.headline}>{headline.title}</Text>
                  <Text style={styles.headlineCaption}>{headline.caption}</Text>
                </>
              ) : null}
              {!forecast.confident ? (
                <Text style={styles.note}>A rough estimate for now. It sharpens after a week of logging.</Text>
              ) : null}
              {forecast.budget == null ? (
                <Pressable accessibilityRole="button" onPress={onSetBudget} hitSlop={8} style={styles.inlineAction}>
                  <Text style={styles.inlineActionText}>+ SET A BUDGET TO TRACK AGAINST</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No forecast yet</Text>
              <Text style={styles.emptyText}>
                Once you log a few payments, Spendd projects where your month is heading and warns you before you
                overspend.
              </Text>
              <OutlineButton label="ADD A TRANSACTION" onPress={onAdd} style={styles.emptyButton} />
            </>
          )}
        </View>
      </FadeIn>

      <FadeIn index={2}>
        {ai.insights || ai.thinking ? (
          <>
            <SectionTitle title="From Spendd AI" />
            {ai.insights ? <InsightsCard items={ai.insights} /> : null}
            <AiNote thinking={ai.thinking} written={ai.insights != null} />
          </>
        ) : aiModel.phase === 'none' || aiModel.phase === 'failed' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set up Spendd AI"
            onPress={onSetUpAi}
            android_ripple={{ color: '#1A1A1A' }}
            style={[styles.card, styles.cardPadded, styles.promo]}>
            <View style={styles.promoIcon}>
              <BotIcon size={22} color={colors.background} strokeWidth={1.8} />
            </View>
            <Text style={styles.promoTitle}>Get Spendd AI</Text>
            <Text style={styles.promoText}>
              A small AI that runs on your phone and writes personal advice from your spending. Works offline, and
              nothing leaves your phone.
            </Text>
            <Text style={styles.inlineActionText}>
              SET UP • {Math.round(AI_MODEL.bytes / 1e6)} MB DOWNLOAD
            </Text>
          </Pressable>
        ) : null}
      </FadeIn>

      {tips.length > 0 ? (
        <FadeIn index={3}>
          <SectionTitle title={ai.insights ? 'All Patterns' : 'Tips & Patterns'} />
          <InsightsCard items={tips} />
        </FadeIn>
      ) : null}

      <FadeIn index={4}>
        <SectionTitle title="Today" />
        {today.categories.length > 0 ? (
          <>
            <Text style={styles.sectionCaption}>
              {formatRupees(today.total)} ACROSS {paymentCount(today.count).toUpperCase()}
            </Text>
            <CategoryBreakdown categories={today.categories} onOpen={onOpen} />
          </>
        ) : (
          <Text style={styles.quiet}>Nothing spent yet today.</Text>
        )}
        <Text style={styles.footer}>WORKED OUT ON YOUR PHONE. NOTHING IS SENT ANYWHERE.</Text>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 14 },
  heroAmount: { fontFamily: fonts.serif, fontSize: 50, lineHeight: 66, color: colors.ink },
  heroCaption: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.inkMuted, marginLeft: 10 },
  range: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, letterSpacing: 0.8, color: colors.inkMuted },

  paceTrack: {
    height: 10,
    flexDirection: 'row',
    backgroundColor: colors.track,
    marginTop: 20,
  },
  paceSpent: { height: '100%', backgroundColor: colors.ink },
  paceProjected: { height: '100%', backgroundColor: colors.inkFaint },
  paceOver: { backgroundColor: colors.danger },
  budgetMarker: { position: 'absolute', top: -5, bottom: -5, width: 2, marginLeft: -1, backgroundColor: colors.glow },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10 },
  budgetSwatch: { width: 2, backgroundColor: colors.glow },
  legendLabel: { fontFamily: fonts.sansMedium, fontSize: 10.5, letterSpacing: 1.2, color: colors.inkMuted },

  headline: { fontFamily: fonts.serifItalic, fontSize: 20, lineHeight: 27, color: colors.ink, marginTop: 22 },
  headlineCaption: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.inkMuted, marginTop: 6 },
  note: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.glow, marginTop: 14 },
  inlineAction: { alignSelf: 'flex-start', marginTop: 18 },
  inlineActionText: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 2, color: colors.ink },

  promo: { marginTop: 24 },
  promoIcon: {
    width: 40,
    height: 40,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink, marginTop: 16 },
  promoText: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 22, color: colors.inkMuted, marginTop: 8, marginBottom: 18 },

  emptyTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink, marginTop: 16 },
  emptyText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.inkMuted, marginTop: 10 },
  emptyButton: { marginTop: 22 },

  sectionCaption: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.inkMuted,
    marginTop: -6,
    marginBottom: 14,
  },
  quiet: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkMuted },
  footer: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 32,
  },
});
