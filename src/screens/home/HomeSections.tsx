import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BotIcon,
  ChevronRightIcon,
  FlameIcon,
  InfoIcon,
} from '../../components/Icons';
import type {
  DailyBudget,
  DailyStatus,
  Habit,
  Insight,
  InsightKind,
  StoryItem,
} from '../../insights/types';
import { colors, fonts } from '../../theme';

export const formatRupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

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

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={action.onPress}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
          <Text style={styles.sectionActionLabel}>{action.label}</Text>
          <ChevronRightIcon size={16} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function DailyStatusCard({ status }: { status: DailyStatus }) {
  const less = (status.changeVsUsualPct ?? 0) <= 0;
  const Arrow = less ? ArrowDownIcon : ArrowUpIcon;
  return (
    <View style={[styles.card, styles.cardPadded]}>
      <View style={styles.badge}>
        <View style={styles.badgeSquare} />
        <Text style={styles.badgeLabel}>DAILY STATUS</Text>
      </View>

      <View style={styles.amountRow} accessible accessibilityLabel={`${formatRupees(status.safeToSpend)} safe to spend`}>
        <Text style={styles.heroAmount}>{formatRupees(status.safeToSpend)}</Text>
        <Text style={styles.heroCaption}>safe to spend</Text>
      </View>

      {status.spendBelowToday != null ? (
        <Text style={styles.statusLine}>
          Spend below <Text style={styles.underline}>{formatRupees(status.spendBelowToday)}</Text> today to stay on
          track
        </Text>
      ) : (
        <Text style={styles.statusLine}>Log a few days of spending, or set a budget, to get a daily limit.</Text>
      )}
      {status.changeVsUsualPct != null ? (
        <View style={styles.changeRow}>
          <Arrow size={13} color={colors.ink} strokeWidth={2} />
          <Text style={styles.changeLabel}>
            {Math.abs(status.changeVsUsualPct)}% {less ? 'LESS' : 'MORE'} THAN YOUR USUAL SPENDING
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const STORY_CARD_WIDTH = 160;

export function StoryStrip({ items, onPress }: { items: StoryItem[]; onPress: (index: number) => void }) {
  return (
    <View style={[styles.card, styles.storyFrame]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STORY_CARD_WIDTH}
        decelerationRate="fast">
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.caption}`}
            accessibilityHint="Opens the story"
            onPress={() => onPress(i)}
            android_ripple={{ color: '#1A1A1A' }}
            style={[styles.storyCard, i < items.length - 1 && styles.storyDivider]}>
            <View style={styles.emojiTile}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <View>
              <Text style={styles.storyTitle}>{item.title}</Text>
              <Text style={styles.storyCaption}>{item.caption.toUpperCase()}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const INSIGHT_ICONS: Record<InsightKind, (p: { size: number; color: string; strokeWidth: number }) => ReactNode> = {
  agent: BotIcon,
  alert: AlertTriangleIcon,
  win: FlameIcon,
};

export function InsightsCard({ items }: { items: Insight[] }) {
  return (
    <View style={styles.card}>
      {items.map((item, i) => {
        const Icon = INSIGHT_ICONS[item.kind];
        return (
          <View
            key={item.id}
            style={[styles.insightRow, i > 0 && styles.insightDivider]}
            accessible
            accessibilityLabel={`${item.title}. ${item.caption}`}>
            <View style={styles.insightIcon}>
              <Icon size={20} color={colors.background} strokeWidth={1.8} />
            </View>
            <View style={styles.insightText}>
              <Text style={styles.insightTitle}>{item.title}</Text>
              <Text style={styles.insightCaption}>{item.caption.toUpperCase()}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Says where the insights above came from: the on-device model, or that it's rewriting them. */
export function AiNote({ thinking, written }: { thinking: boolean; written: boolean }) {
  if (!thinking && !written) {
    return null;
  }
  return (
    <View style={styles.aiNote} accessibilityLiveRegion="polite">
      {thinking ? (
        <ActivityIndicator size="small" color={colors.inkMuted} />
      ) : (
        <BotIcon size={14} color={colors.inkMuted} strokeWidth={1.8} />
      )}
      <Text style={styles.aiNoteText}>
        {thinking ? 'SPENDD AI IS WRITING YOUR INSIGHTS…' : 'WRITTEN BY SPENDD AI ON YOUR PHONE'}
      </Text>
    </View>
  );
}

export function DailyBudgetCard({ budget }: { budget: DailyBudget }) {
  const [explained, setExplained] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;
  const usedPct = Math.round(budget.usedFraction * 100);

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
    <View style={[styles.card, styles.cardPadded]}>
      <Text style={styles.budgetLabel}>DAILY BUDGET</Text>
      <Text style={styles.budgetAmount}>{formatRupees(budget.amount)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="What is the daily budget?"
        accessibilityState={{ expanded: explained }}
        hitSlop={8}
        onPress={() => setExplained(e => !e)}
        style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}>
        <InfoIcon size={18} color={colors.background} strokeWidth={1.8} />
      </Pressable>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={`${usedPct}% of today's budget used`}
        accessibilityValue={{ min: 0, max: 100, now: usedPct }}>
        <Animated.View
          style={[styles.trackFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
      <Text style={styles.budgetCaption}>
        {budget.basis === 'budget' ? 'TO STAY WITHIN YOUR BUDGET' : 'BASED ON YOUR USUAL DAY'}
      </Text>

      {explained ? (
        <Text style={styles.explainer}>
          {budget.basis === 'budget'
            ? 'What’s left of your budget, split evenly across the days remaining.'
            : 'Your average day over the last 30 days. Set a budget on the Accounts tab to plan against a goal instead.'}{' '}
          You’ve used {usedPct}% of it so far today.
        </Text>
      ) : null}
    </View>
  );
}

export function HabitChips({ habits }: { habits: Habit[] }) {
  return (
    <View style={styles.chips}>
      {habits.map(h => (
        <View key={h.id} style={styles.chip} accessible accessibilityLabel={`${h.label} ${h.sharePct} percent`}>
          <Text style={styles.chipLabel}>
            {h.emoji} {h.label.toUpperCase()} {h.sharePct}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardPadded: { padding: 24 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 2, color: colors.ink },

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
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 14 },
  heroAmount: { fontFamily: fonts.serif, fontSize: 50, lineHeight: 66, color: colors.ink },
  heroCaption: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.inkMuted, marginLeft: 10 },
  statusLine: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: 20 },
  underline: { textDecorationLine: 'underline' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  changeLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 0.6, color: colors.ink },

  storyFrame: { borderRadius: 20 },
  storyCard: {
    width: STORY_CARD_WIDTH,
    height: 190,
    padding: 16,
    justifyContent: 'space-between',
  },
  storyDivider: { borderRightWidth: 1, borderRightColor: colors.cardBorder },
  emojiTile: {
    width: 40,
    height: 40,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  storyTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  storyCaption: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkMuted, marginTop: 4 },

  insightRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 18 },
  insightDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  insightIcon: {
    width: 40,
    height: 40,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  insightText: { flex: 1 },
  insightTitle: { fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 25, color: colors.ink },
  insightCaption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.4,
    color: colors.inkMuted,
    marginTop: 4,
  },

  aiNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  aiNoteText: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, letterSpacing: 1.6, color: colors.inkMuted },

  budgetLabel: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.inkMuted },
  budgetAmount: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 46, color: colors.ink, marginTop: 4 },
  infoButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 32,
    height: 32,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 6, backgroundColor: colors.track, marginTop: 18, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.ink },
  budgetCaption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  explainer: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkMuted,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 1, color: colors.ink },
});
