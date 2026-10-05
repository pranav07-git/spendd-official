import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { TextButton } from '../../components/Buttons';
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BotIcon,
  FlameIcon,
  InfoIcon,
} from '../../components/Icons';
import { Card, SectionHeading } from '../../components/Layout';
import type {
  DailyBudget,
  DailyStatus,
  Habit,
  Insight,
  InsightKind,
  StoryItem,
} from '../../insights/types';
import { formatRupees } from '../../transactions/format';
import { elevation, jarColorFor, makeStyles, radius, space, type, useTheme } from '../../theme';
import { CategoryGlyph } from '../../components/CategoryGlyph';

// Kept as an export from here for screens that already import it.
export { formatRupees };

/** Jar colours in a fixed order, for tiles that need one. */

/** Gentle fade-and-rise entrance, staggered by `index`. */
export function FadeIn({ index, children }: { index: number; children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay: 60 + index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}

/** Section heading with an optional quiet action ("See all"). */
export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const s = useStyles();
  return (
    <SectionHeading
      title={title}
      action={action ? <TextButton label={action.label} onPress={action.onPress} style={s.sectionAction} /> : undefined}
    />
  );
}

export function DailyStatusCard({ status }: { status: DailyStatus }) {
  const s = useStyles();
  const { c } = useTheme();
  const less = (status.changeVsUsualPct ?? 0) <= 0;
  const Arrow = less ? ArrowDownIcon : ArrowUpIcon;
  const changeColor = less ? c.peacock : c.headsup;
  return (
    <Card>
      <Text style={s.cardLabel}>Daily status</Text>

      <View accessible accessibilityLabel={`${formatRupees(status.safeToSpend)} safe to spend`}>
        <Text style={s.heroAmount}>{formatRupees(status.safeToSpend)}</Text>
        <Text style={s.heroCaption}>safe to spend</Text>
      </View>

      {status.spendBelowToday != null ? (
        <Text style={s.statusLine}>
          Spend under <Text style={s.strong}>{formatRupees(status.spendBelowToday)}</Text> today to stay on track.
        </Text>
      ) : (
        <Text style={s.statusLine}>Log a few days of spends, or set a budget, and you’ll get a daily limit here.</Text>
      )}
      {status.changeVsUsualPct != null ? (
        <View style={s.changeRow}>
          <Arrow size={16} color={changeColor} strokeWidth={2} />
          <Text style={[s.changeLabel, { color: changeColor }]}>
            {Math.abs(status.changeVsUsualPct)}% {less ? 'less' : 'more'} than your usual spending
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const STORY_CARD_WIDTH = 148;
const STORY_GAP = space[3];

export function StoryStrip({ items, onPress }: { items: StoryItem[]; onPress: (index: number) => void }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={STORY_CARD_WIDTH + STORY_GAP}
      decelerationRate="fast"
      style={s.storyScroll}
      contentContainerStyle={s.storyRow}>
      {items.map((item, i) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.caption}`}
          accessibilityHint="Opens the story"
          onPress={() => onPress(i)}
          style={({ pressed }) => [s.storyCard, pressed && s.pressed]}>
          <View style={[s.tile, { backgroundColor: jarColorFor(item.id, c) }]}>
            <CategoryGlyph category={item.glyph} size={20} />
          </View>
          <View>
            <Text style={s.storyTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={s.caption} numberOfLines={2}>
              {item.caption}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const INSIGHT_ICONS: Record<InsightKind, (p: { size: number; color: string; strokeWidth: number }) => ReactNode> = {
  agent: BotIcon,
  alert: AlertTriangleIcon,
  win: FlameIcon,
};

export function InsightsCard({ items }: { items: Insight[] }) {
  const s = useStyles();
  const { c } = useTheme();
  const look: Record<InsightKind, { bg: string; fg: string }> = {
    agent: { bg: c.surfaceSunken, fg: c.ink },
    alert: { bg: c.marigoldSoft, fg: c.headsup },
    win: { bg: c.peacockSoft, fg: c.peacock },
  };
  return (
    <Card padded={false}>
      {items.map((item, i) => {
        const Icon = INSIGHT_ICONS[item.kind];
        const { bg, fg } = look[item.kind];
        return (
          <View
            key={item.id}
            style={[s.insightRow, i > 0 && s.divider]}
            accessible
            accessibilityLabel={`${item.title}. ${item.caption}`}>
            <View style={[s.tile, { backgroundColor: bg }]}>
              <Icon size={20} color={fg} strokeWidth={1.8} />
            </View>
            <View style={s.flex}>
              <Text style={s.insightTitle}>{item.title}</Text>
              <Text style={s.caption}>{item.caption}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

/** Says where the insights above came from: Spendd AI (Gemini), or that it's writing them. */
export function AiNote({ thinking, written }: { thinking: boolean; written: boolean }) {
  const s = useStyles();
  const { c } = useTheme();
  if (!thinking && !written) {
    return null;
  }
  return (
    <View style={s.aiNote} accessibilityLiveRegion="polite">
      {thinking ? (
        <ActivityIndicator size="small" color={c.inkMuted} />
      ) : (
        <BotIcon size={14} color={c.inkMuted} strokeWidth={1.8} />
      )}
      <Text style={s.aiNoteText}>
        {thinking ? 'Spendd AI is writing your insights…' : 'Written by Spendd from your numbers'}
      </Text>
    </View>
  );
}

export function DailyBudgetCard({ budget }: { budget: DailyBudget }) {
  const s = useStyles();
  const { c } = useTheme();
  const [explained, setExplained] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;
  const usedPct = Math.round(budget.usedFraction * 100);
  const fillColor = budget.usedFraction >= 0.75 ? c.headsup : c.peacock;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: budget.usedFraction,
      duration: 900,
      delay: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [budget.usedFraction, fill]);

  return (
    <Card>
      <View style={s.budgetHead}>
        <View style={s.flex}>
          <Text style={s.cardLabel}>Daily budget</Text>
          <Text style={s.budgetAmount}>{formatRupees(budget.amount)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="What is the daily budget?"
          accessibilityState={{ expanded: explained }}
          onPress={() => setExplained(e => !e)}
          style={({ pressed }) => [s.infoButton, pressed && s.pressed]}>
          <View style={[s.infoDot, explained && s.infoDotActive]}>
            <InfoIcon size={18} color={c.ink} strokeWidth={1.8} />
          </View>
        </Pressable>
      </View>

      <View
        style={s.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`${usedPct}% of today's budget used`}
        accessibilityValue={{ min: 0, max: 100, now: usedPct }}>
        <Animated.View
          style={[
            s.trackFill,
            { backgroundColor: fillColor, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <Text style={s.budgetCaption}>
        {usedPct}% used · {budget.basis === 'budget' ? 'keeps you within your budget' : 'based on your usual day'}
      </Text>

      {explained ? (
        <Text style={s.explainer}>
          {budget.basis === 'budget'
            ? 'What’s left of your budget, split evenly across the days remaining.'
            : 'Your average day of spending since you started logging (up to the last 30 days, not counting today). Set a budget on the Accounts tab to plan against a goal instead.'}{' '}
          You’ve used {usedPct}% of it so far today.
        </Text>
      ) : null}
    </Card>
  );
}

/** Read-only habit chips (DESIGN.md §5.5): surface with a line outline. */
export function HabitChips({ habits }: { habits: Habit[] }) {
  const s = useStyles();
  return (
    <View style={s.chips}>
      {habits.map(h => (
        <View key={h.id} style={s.chip} accessible accessibilityLabel={`${h.label} ${h.sharePct} percent`}>
          <CategoryGlyph category={h.label} size={16} />
          <Text style={s.chipLabel}>
            {h.label} <Text style={s.chipPct}>{h.sharePct}%</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c, isDark) => ({
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  flex: { flex: 1 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  caption: { ...type.caption, color: c.inkMuted, marginTop: 2 },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.s + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionAction: { alignSelf: 'auto', paddingHorizontal: space[2], marginRight: -space[2] },

  cardLabel: { ...type.label, color: c.inkMuted },
  heroAmount: { ...type.amountHero, color: c.ink, marginTop: space[2] },
  heroCaption: { ...type.body, color: c.inkMuted },
  statusLine: { ...type.body, color: c.ink, marginTop: space[4] },
  strong: { ...type.bodyStrong, color: c.ink },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginTop: space[2] },
  changeLabel: { ...type.label },

  storyScroll: { marginHorizontal: -space[5] },
  storyRow: { paddingHorizontal: space[5], gap: STORY_GAP, paddingBottom: space[1] },
  storyCard: {
    width: STORY_CARD_WIDTH,
    minHeight: 168,
    padding: space[4],
    borderRadius: radius.l,
    backgroundColor: c.surface,
    justifyContent: 'space-between',
    gap: space[4],
    ...elevation(1, c, isDark),
  },
  storyTitle: { ...type.bodyStrong, color: c.ink },

  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: space[4] },
  insightTitle: { ...type.bodyStrong, color: c.ink },

  aiNote: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3], paddingHorizontal: space[1] },
  aiNoteText: { ...type.caption, color: c.inkMuted, flexShrink: 1 },

  budgetHead: { flexDirection: 'row', alignItems: 'flex-start' },
  budgetAmount: { ...type.amountMedium, color: c.ink, marginTop: space[1] },
  infoButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -space[1],
    marginRight: -space[1],
  },
  infoDot: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDotActive: { backgroundColor: c.surfaceSunken },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSunken,
    marginTop: space[4],
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: radius.pill },
  budgetCaption: { ...type.caption, color: c.inkMuted, marginTop: space[2] },
  explainer: {
    ...type.caption,
    color: c.inkMuted,
    marginTop: space[4],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: c.line,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 36,
    borderRadius: radius.s,
    paddingHorizontal: space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  chipLabel: { ...type.label, color: c.ink },
  chipPct: { ...type.label, color: c.inkMuted },
}));
