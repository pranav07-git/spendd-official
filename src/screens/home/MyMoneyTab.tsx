import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { OutlineButton } from '../../components/Buttons';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookIcon,
  BulbIcon,
  ChevronForwardIcon,
  ChevronLeftIcon,
  SearchIcon,
} from '../../components/Icons';
import { Spotlight } from '../../components/Spotlight';
import { Card, SectionHeading, StoryHeader } from '../../components/Layout';
import { buildMyMoney, comparisonLine, DISCRETIONARY, MICRO_LIMIT, type CategoryChange, type MyMoney } from '../../insights/myMoney';
import { monthStart } from '../../insights/stats';
import { formatDayMonth, formatRupees, LONG_MONTHS } from '../../transactions/format';
import type { Transaction } from '../../transactions/types';
import { jarColorFor, makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, TOUCH_TARGET, type, useTheme } from '../../theme';
import { FadeIn } from './HomeSections';
import { TAB_BAR_CLEARANCE } from './TabBar';

type Props = {
  transactions: Transaction[];
  /** Two quotable lines for Money Stories: Spendd AI's, or the engine's top insights. */
  stories: string[];
  onOpen: (transaction: Transaction) => void;
  onOpenStory: () => void;
  onSearch: () => void;
  onAdd: () => void;
};

const SHORT_MONTHS = LONG_MONTHS.map(m => m.slice(0, 3));
const CELL_LIMIT = 3;


/** "POSITIVE" → "Positive", "NEEDS WORK" → "Needs work" */
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** The opening sentence for the month, from the numbers alone. */
function storyFor(m: MyMoney, monthName: string): string {
  const when = m.isCurrentMonth ? 'this month' : `in ${monthName}`;
  if (!m.hasData) {
    return `Nothing logged for ${monthName} yet.`;
  }
  if (m.income > 0 && m.savings > 0) {
    return `You've kept ${formatRupees(m.savings)} ${when}.`;
  }
  if (m.income > 0 && m.savings < 0) {
    return `Spends ran ${formatRupees(-m.savings)} past income ${when}.`;
  }
  return `You've spent ${formatRupees(m.spending)} ${when}.`;
}

function ChangeBadge({ change }: { change: number | null }) {
  const s = useStyles();
  const { c } = useTheme();
  if (change === null) {
    return (
      <View style={s.badge}>
        <Text style={s.badgeText}>New</Text>
      </View>
    );
  }
  const tone = change > 0 ? c.headsup : change < 0 ? c.peacock : c.inkMuted;
  return (
    <View style={s.badge}>
      {change > 0 ? <ArrowUpIcon size={12} color={tone} strokeWidth={2.2} /> : null}
      {change < 0 ? <ArrowDownIcon size={12} color={tone} strokeWidth={2.2} /> : null}
      <Text style={[s.badgeText, { color: tone }]}>{Math.abs(change)}%</Text>
    </View>
  );
}

function CategoryCell({ item }: { item: CategoryChange }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View
      style={[s.cell, { backgroundColor: jarColorFor(item.category, c) }]}
      accessible
      accessibilityLabel={`${item.category} ${formatRupees(item.amount)}${
        item.changePct !== null ? `, ${item.changePct > 0 ? 'up' : 'down'} ${Math.abs(item.changePct)} percent` : ''
      }`}>
      <Text style={s.cellLabel} numberOfLines={1}>
        {item.category}
      </Text>
      <View style={s.cellBottom}>
        <Text style={s.cellAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatRupees(item.amount)}
        </Text>
        <ChangeBadge change={item.changePct} />
      </View>
    </View>
  );
}

function ScoreBar({ label, value, verdict }: { label: string; value: number; verdict: string }) {
  const s = useStyles();
  return (
    <View style={s.scoreRow}>
      <View style={s.scoreLabels}>
        <Text style={s.scoreLabel}>{label}</Text>
        <Text style={s.scoreVerdict}>{verdict}</Text>
      </View>
      <View style={s.scoreTrack}>
        <View style={[s.scoreFill, { width: `${Math.max(value * 100, 3)}%` }]} />
      </View>
    </View>
  );
}

/** The My Money tab: the month's income, spending and savings, where it went, and what to do about it. */
export function MyMoneyTab({ transactions, stories, onOpen, onOpenStory, onSearch, onAdd }: Props) {
  const s = useStyles();
  const { c } = useTheme();
  const thisMonth = monthStart(Date.now());
  const [month, setMonth] = useState(thisMonth);
  const [showAll, setShowAll] = useState(false);
  const [explainScore, setExplainScore] = useState(false);
  const m = useMemo(() => buildMyMoney(transactions, month), [transactions, month]);
  const comparison = comparisonLine(m);
  const cells = showAll ? m.categories : m.categories.slice(0, CELL_LIMIT);
  const monthName = LONG_MONTHS[new Date(month).getMonth()];
  const earliest = Math.min(thisMonth, ...transactions.map(tx => monthStart(tx.occurredAt)));
  const atStart = month <= earliest;
  const atEnd = month >= thisMonth;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">
          My money
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search transactions"
          onPress={onSearch}
          style={({ pressed }) => [s.iconButton, pressed && s.pressed]}>
          <SearchIcon size={24} color={c.ink} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.feed} showsVerticalScrollIndicator={false}>
        <FadeIn index={0}>
          <View style={s.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              disabled={atStart}
              onPress={() => setMonth(monthStart(month, -1))}
              style={({ pressed }) => [s.iconButton, atStart && s.disabled, pressed && s.pressed]}>
              <ChevronLeftIcon size={20} color={c.ink} strokeWidth={2} />
            </Pressable>
            <Text style={s.stepperLabel}>{monthName}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              disabled={atEnd}
              onPress={() => setMonth(monthStart(month, 1))}
              style={({ pressed }) => [s.iconButton, atEnd && s.disabled, pressed && s.pressed]}>
              <ChevronForwardIcon size={20} color={c.ink} strokeWidth={2} />
            </Pressable>
          </View>

          <StoryHeader
            story={storyFor(m, monthName)}
            caption={
              comparison ??
              (m.hasData
                ? 'Your comparison with last month shows up once there are spends in both.'
                : 'Share a UPI screenshot or add a spend to start.')
            }
          />

          <SectionHeading title="Monthly summary" />
          {/* My Money's one gradient spotlight (docs/DESIGN.md); everything on it is white. */}
          <Spotlight tone="magenta">
            <Text style={[s.smallLabel, s.onSpotlightMuted]}>Income</Text>
            <Text style={[s.income, s.onSpotlight]} numberOfLines={1} adjustsFontSizeToFit>
              {formatRupees(m.income)}
            </Text>
            <View style={[s.rule, s.onSpotlightRule]} />
            <View style={s.split}>
              <View style={s.splitItem}>
                <Text style={[s.smallLabel, s.onSpotlightMuted]}>Spent</Text>
                <Text style={[s.splitValue, s.onSpotlight]}>{formatRupees(m.spending)}</Text>
              </View>
              <View style={s.splitItem}>
                <Text style={[s.smallLabel, s.onSpotlightMuted]}>{m.savings < 0 ? 'Over by' : 'Kept'}</Text>
                <Text style={[s.splitValue, s.onSpotlight]}>{formatRupees(Math.abs(m.savings))}</Text>
              </View>
            </View>
          </Spotlight>
          {!m.hasData && month === thisMonth ? <OutlineButton label="Add a spend" onPress={onAdd} style={s.emptyButton} /> : null}
        </FadeIn>

        <FadeIn index={1}>
          <SectionHeading title="Where your money went" />
          <View style={s.grid}>
            {cells.length === 0 ? (
              <Card style={s.cellWide}>
                <Text style={s.placeholder}>No spends logged this month.</Text>
              </Card>
            ) : (
              cells.map(item => <CategoryCell key={item.category} item={item} />)
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={m.categories.length > CELL_LIMIT ? (showAll ? 'Show fewer categories' : 'View all categories') : 'View all transactions'}
              onPress={() => (m.categories.length > CELL_LIMIT ? setShowAll(v => !v) : onSearch())}
              style={({ pressed }) => [s.cell, s.viewAll, cells.length % 2 === 0 && s.cellWide, pressed && s.pressed]}>
              <Text style={s.viewAllText}>{showAll ? 'Show less' : 'View all'}</Text>
            </Pressable>
          </View>
        </FadeIn>

        <FadeIn index={2}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens this month's story"
            onPress={onOpenStory}
            style={({ pressed }) => [s.stories, pressed && s.pressed]}>
            <Card>
              <View style={s.storiesHead}>
                <Text style={s.cardTitle}>Money stories</Text>
                <BookIcon size={24} color={c.inkMuted} strokeWidth={1.6} />
              </View>
              {(stories.length > 0 ? stories : ['Your money stories show up as you log payments.']).map((text, i) => (
                <View key={text} style={i > 0 && s.divider}>
                  <Text style={s.storyText}>“{text.replace(/^["“]|["”]$/g, '')}”</Text>
                </View>
              ))}
              <Text style={s.storiesCta}>See this month's story</Text>
            </Card>
          </Pressable>
        </FadeIn>

        <FadeIn index={3}>
          <SectionHeading title="Big moments" />
          <Card padded={false}>
            {m.moments.length === 0 ? (
              <Text style={[s.placeholder, s.boxPlaceholder]}>Your biggest payments of the month show up here.</Text>
            ) : (
              m.moments.map(({ tx, when }, i) => (
                <Pressable
                  key={tx.id}
                  accessibilityRole="button"
                  onPress={() => onOpen(tx)}
                  style={({ pressed }) => [s.moment, i > 0 && s.divider, pressed && s.rowPressed]}>
                  <View style={s.momentText}>
                    <Text style={s.momentTitle} numberOfLines={1}>
                      {tx.note || tx.counterparty || tx.category}
                    </Text>
                    <Text style={s.caption}>
                      {tx.category} · {sentenceCase(when)} {SHORT_MONTHS[new Date(tx.occurredAt).getMonth()]}
                    </Text>
                  </View>
                  <Text style={s.momentAmount}>{formatRupees(tx.amount)}</Text>
                </Pressable>
              ))
            )}
          </Card>
        </FadeIn>

        <FadeIn index={4}>
          <SectionHeading title="How the month looks" />
          <View style={s.pair}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                m.standpoint ? `Standpoint score ${m.standpoint.score} out of 100. How is this worked out?` : 'Standpoint. How is this worked out?'
              }
              onPress={() => setExplainScore(e => !e)}
              style={({ pressed }) => [s.half, pressed && s.pressed]}>
              <Card style={s.fill}>
                <Text style={s.smallLabel}>Standpoint</Text>
                <Text style={[s.score, !m.standpoint && s.scoreEmpty]}>{m.standpoint ? m.standpoint.score : '–'}</Text>
                <ScoreBar
                  label="Savings"
                  verdict={m.standpoint ? sentenceCase(m.standpoint.savingsLabel) : 'No income yet'}
                  value={m.standpoint?.savings ?? 0}
                />
                <ScoreBar
                  label="Lifestyle"
                  verdict={m.standpoint ? sentenceCase(m.standpoint.lifestyleLabel) : '–'}
                  value={m.standpoint?.lifestyle ?? 0}
                />
                <Text style={s.howLink}>{explainScore ? 'Hide how it works' : 'How it works'}</Text>
              </Card>
            </Pressable>
            <View style={[s.half, s.pairRight]}>
              <Card>
                <View
                  accessible
                  accessibilityLabel={`${m.micro.count} payments under ${formatRupees(MICRO_LIMIT)}, ${formatRupees(m.micro.total)} in total`}>
                  <Text style={s.smallLabel}>Small spends</Text>
                  <Text style={s.microAmount}>{formatRupees(m.micro.total)}</Text>
                  <Text style={s.caption}>
                    {m.micro.count} under {formatRupees(MICRO_LIMIT)}
                  </Text>
                </View>
              </Card>
              <View style={s.opportunity}>
                <Text style={s.opportunityLabel}>Opportunity</Text>
                <Text style={s.opportunityText}>
                  {m.opportunity
                    ? `Save ${formatRupees(m.opportunity.monthlySaving)} a month by trimming ${m.opportunity.category.toLowerCase()}.`
                    : 'Log food, shopping and fun spends to spot savings.'}
                </Text>
              </View>
            </View>
          </View>
          {explainScore ? (
            <Text style={s.explainer}>
              Standpoint scores your month out of 100: 60% from how much of your income you kept (saving 30% or more
              scores full marks) and 40% from how much went to {DISCRETIONARY.join(', ').toLowerCase()} (under 20% of
              spending scores full marks).{m.standpoint ? '' : ' Log your income this month to get a score.'}
            </Text>
          ) : null}
        </FadeIn>

        <FadeIn index={5}>
          <SectionHeading title="Monthly timeline" />
          {m.timeline.length === 0 ? (
            <Text style={s.placeholder}>Salary, rent, bills and big payments line up here as they happen.</Text>
          ) : (
            <View style={s.timeline}>
              <View style={s.timelineLine} />
              {m.timeline.map(event => {
                const income = event.tx.direction === 'credit';
                return (
                  <Pressable
                    key={event.tx.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDayMonth(event.tx.occurredAt)}, ${event.title}, ${formatRupees(event.tx.amount)}`}
                    onPress={() => onOpen(event.tx)}
                    style={({ pressed }) => [s.event, pressed && s.pressed]}>
                    <View
                      style={[s.marker, income ? s.markerIncome : event.tone === 'highlight' ? s.markerOn : s.markerOff]}
                    />
                    <View style={s.eventText}>
                      <Text style={s.caption}>{formatDayMonth(event.tx.occurredAt)}</Text>
                      <Text style={s.eventTitle}>{event.title}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </FadeIn>

        <FadeIn index={6}>
          <Card style={s.guidance} padded={false}>
            <View style={s.guidanceBar} />
            <View style={s.guidanceBody}>
              <BulbIcon size={22} color={c.peacock} strokeWidth={1.8} />
              <View style={s.guidanceText}>
                <Text style={s.cardTitle}>A tip from Spendd</Text>
                <Text style={s.guidanceCopy}>
                  {m.guidance ?? 'Log your first payment this month and Spendd will start pointing things out.'}
                </Text>
              </View>
            </View>
          </Card>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  rowPressed: { backgroundColor: c.surfaceSunken },
  disabled: { opacity: 0.3 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SCREEN_PADDING,
    paddingRight: SCREEN_PADDING - space[3],
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  title: { ...type.title, color: c.ink },
  iconButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  feed: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[4], paddingBottom: TAB_BAR_CLEARANCE },
  caption: { ...type.caption, color: c.inkMuted },
  smallLabel: { ...type.eyebrow, color: c.inkMuted },
  onSpotlight: { color: '#FFFFFF' },
  onSpotlightMuted: { color: 'rgba(255,255,255,0.75)' },
  onSpotlightRule: { backgroundColor: 'rgba(255,255,255,0.25)' },
  cardTitle: { ...type.heading, color: c.ink },
  placeholder: { ...type.body, color: c.inkMuted },
  divider: { borderTopWidth: 1, borderTopColor: c.line },

  stepper: { flexDirection: 'row', alignItems: 'center', marginLeft: -space[3], marginBottom: space[2] },
  stepperLabel: { ...type.label, color: c.ink, minWidth: 88, textAlign: 'center' },

  income: { ...type.amountHero, color: c.peacock, marginTop: space[1] },
  rule: { height: 1, backgroundColor: c.line, marginVertical: space[4] },
  split: { flexDirection: 'row', gap: space[4] },
  splitItem: { flex: 1, gap: space[1] },
  splitValue: { ...type.amountMedium, color: c.ink },
  positive: { color: c.peacock },
  emptyButton: { marginTop: space[4] },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space[3] },
  cell: {
    width: '48.5%',
    minHeight: 104,
    padding: space[4],
    borderRadius: radius.l,
    justifyContent: 'space-between',
  },
  cellWide: { width: '100%' },
  cellLabel: { ...type.label, color: c.ink },
  cellBottom: { gap: space[2], marginTop: space[3], alignItems: 'flex-start' },
  cellAmount: { ...type.amountMedium, color: c.ink },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeText: { ...type.caption, fontFamily: type.label.fontFamily, color: c.inkMuted },
  viewAll: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  viewAllText: { ...type.label, color: c.ink },

  stories: { marginTop: SECTION_GAP },
  storiesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[2] },
  storyText: { ...type.body, color: c.ink, paddingVertical: space[3] },
  storiesCta: { ...type.label, color: c.ink, marginTop: space[2] },

  moment: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space[4], paddingVertical: space[3], gap: space[3] },
  momentText: { flex: 1 },
  momentTitle: { ...type.bodyStrong, color: c.ink },
  momentAmount: { ...type.amount, color: c.ink },
  boxPlaceholder: { padding: space[4] },

  pair: { flexDirection: 'row', gap: space[3] },
  half: { flex: 1 },
  fill: { flex: 1 },
  pairRight: { gap: space[3] },
  score: { ...type.amountHero, color: c.ink, marginTop: space[1] },
  scoreEmpty: { color: c.inkSubtle },
  scoreRow: { marginTop: space[2] },
  scoreLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: space[1] },
  scoreLabel: { ...type.caption, fontFamily: type.label.fontFamily, color: c.ink },
  scoreVerdict: { ...type.caption, color: c.inkMuted, flexShrink: 1, textAlign: 'right' },
  scoreTrack: { height: 6, borderRadius: radius.pill, backgroundColor: c.surfaceSunken, marginTop: space[1], overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.peacock },
  howLink: { ...type.caption, color: c.info, marginTop: space[3] },
  microAmount: { ...type.amountMedium, color: c.ink, marginTop: space[1] },
  opportunity: { backgroundColor: c.peacockSoft, borderRadius: radius.l, padding: space[4] },
  opportunityLabel: { ...type.label, color: c.ink },
  opportunityText: { ...type.caption, color: c.ink, marginTop: space[1] },
  explainer: { ...type.caption, color: c.inkMuted, marginTop: space[3] },

  timeline: { paddingTop: space[1] },
  timelineLine: { position: 'absolute', left: 5, top: space[5], bottom: space[5], width: 2, borderRadius: 1, backgroundColor: c.line },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: space[4], minHeight: TOUCH_TARGET, paddingVertical: space[2] },
  eventText: { flex: 1 },
  marker: { width: 12, height: 12, borderRadius: 6, marginTop: 3, borderWidth: 2 },
  markerIncome: { backgroundColor: c.peacock, borderColor: c.peacock },
  markerOn: { backgroundColor: c.ink, borderColor: c.ink },
  markerOff: { backgroundColor: c.bg, borderColor: c.ink },
  eventTitle: { ...type.body, color: c.ink },

  guidance: { marginTop: SECTION_GAP, flexDirection: 'row' },
  guidanceBar: { width: 4, backgroundColor: c.peacock },
  guidanceBody: { flex: 1, flexDirection: 'row', gap: space[3], padding: space[4] },
  guidanceText: { flex: 1 },
  guidanceCopy: { ...type.body, color: c.ink, marginTop: space[1] },
}));
