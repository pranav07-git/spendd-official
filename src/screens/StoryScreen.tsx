import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, Text, useWindowDimensions, View, type PanResponderGestureState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { OutlineButton, PrimaryButton, TextButton } from '../components/Buttons';
import { CategoryGlyph } from '../components/CategoryGlyph';
import { CrossIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { kindFor } from '../transactions/categories';
import { addDays, formatDayMonth, formatRupees, formatTime, startOfDay } from '../transactions/format';
import { listTransactions, updateTransaction } from '../transactions/store';
import { categoryLine, monthlyStory, type StorySlide } from '../transactions/stories';
import type { Transaction } from '../transactions/types';
import { elevation, makeStyles, radius, SCREEN_PADDING, space, TOUCH_TARGET, type, useTheme } from '../theme';
import { FadeIn } from './home/HomeSections';

const SLIDE_MS = 6000;

/** "Today at 10:52 am to Ravi" */
function whenAndWho(tx: Transaction): string {
  const day = startOfDay(tx.occurredAt);
  const today = startOfDay(Date.now());
  const date = day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : formatDayMonth(tx.occurredAt);
  const time = tx.hasTime ? ` at ${formatTime(tx.occurredAt)}` : '';
  const who = tx.counterparty ? ` to ${tx.counterparty}` : '';
  return `${date}${time}${who}`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The top half of each slide: what the story is about, and the big number. */
function Headline({ slide }: { slide: StorySlide }) {
  const s = useStyles();
  if (slide.kind === 'empty') {
    return (
      <View style={s.centre}>
        <Text style={s.eyebrow}>This month</Text>
        <Text style={s.storyWord}>Nothing yet</Text>
        <Text style={[s.body, s.bodyGap]}>
          Your story fills up as you pay. Share a payment screenshot to Spendd or add a spend by hand.
        </Text>
      </View>
    );
  }
  if (slide.kind === 'category') {
    return (
      <View style={s.centre}>
        <View style={s.glyphCircle}>
          <CategoryGlyph category={slide.category} size={28} />
        </View>
        <Text style={s.eyebrow}>This month</Text>
        <Text style={s.storyWord}>{slide.category}</Text>
        <Text style={[s.body, s.bodyGap]}>You've spent</Text>
        <Text style={s.hero} adjustsFontSizeToFit numberOfLines={1}>
          {formatRupees(slide.amount)}
        </Text>
      </View>
    );
  }
  if (slide.kind === 'income') {
    return (
      <View style={s.centre}>
        <View style={[s.glyphCircle, s.glyphIncome]}>
          <CategoryGlyph category="Income" size={28} />
        </View>
        <Text style={s.eyebrow}>This month</Text>
        <Text style={s.storyWord}>Income</Text>
        <Text style={[s.body, s.bodyGap]}>You earned</Text>
        <Text style={[s.hero, s.heroIncome]} adjustsFontSizeToFit numberOfLines={1}>
          {formatRupees(slide.total)}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.centre}>
      <Text style={s.eyebrow}>A few to sort</Text>
      <Text style={s.storyWord}>What was this payment for?</Text>
      <Text style={[s.hero, s.bodyGap]} adjustsFontSizeToFit numberOfLines={1}>
        {formatRupees(slide.tx.amount)}
      </Text>
      <Text style={s.meta}>{whenAndWho(slide.tx)}</Text>
    </View>
  );
}

type FactsProps = {
  slide: StorySlide;
  answer: string | undefined;
  error: boolean;
  onDetails: (query: string) => void;
  onOpenTransaction: (tx: Transaction) => void;
  onAnswer: (tx: Transaction, category: string) => void;
  onAdd: () => void;
};

/** The bottom of the card: a fact and an action. Outside the swipe area so taps reach it. */
function Facts({ slide, answer, error, onDetails, onOpenTransaction, onAnswer, onAdd }: FactsProps) {
  const s = useStyles();
  if (slide.kind === 'empty') {
    return <PrimaryButton label="Add a spend" onPress={onAdd} />;
  }

  if (slide.kind === 'category') {
    return (
      <>
        <View style={s.facts}>
          <Text style={s.factLine}>{capitalise(categoryLine(slide.category, slide.count, slide.period))}.</Text>
          <View style={s.factBottom}>
            <View>
              <Text style={s.caption}>Total</Text>
              <Text style={s.factAmount}>{formatRupees(slide.total)}</Text>
            </View>
            <OutlineButton
              label="Details"
              onPress={() => onDetails(slide.category)}
              style={s.smallButton}
            />
          </View>
        </View>
        {slide.of > 1 ? (
          <View style={s.dots} accessibilityLabel={`Category ${slide.position + 1} of ${slide.of}`}>
            {Array.from({ length: slide.of }, (_, i) => (
              <View key={i} style={[s.dot, i === slide.position && s.dotActive]} />
            ))}
          </View>
        ) : null}
      </>
    );
  }

  if (slide.kind === 'income') {
    return (
      <View style={[s.facts, s.factsIncome]}>
        <Text style={s.factLine}>Your biggest income is from</Text>
        <View style={s.incomeRow}>
          <View style={s.incomeIcon}>
            <CategoryGlyph category={slide.top.category === 'Salary' ? 'Salary' : 'Income'} size={22} />
          </View>
          <View style={s.incomeText}>
            <Text style={s.incomeSource} numberOfLines={1}>
              {slide.top.label}
            </Text>
            <Text style={s.incomeAmount}>{formatRupees(slide.top.amount)}</Text>
          </View>
        </View>
        <OutlineButton
          label="View details"
          onPress={() => onDetails(slide.top.category === 'Personal' ? slide.top.label : slide.top.category)}
          style={s.fullButton}
        />
      </View>
    );
  }

  return (
    <View style={s.questionArea}>
      {answer ? (
        <View style={[s.choice, s.choiceSelected, s.answered]} accessibilityLiveRegion="polite">
          <CategoryGlyph category={answer} size={18} />
          <Text style={s.choiceLabel}>{answer === 'Personal' ? 'Kept as personal. Thanks.' : `Marked as ${answer.toLowerCase()}. Thanks.`}</Text>
        </View>
      ) : (
        <View style={s.choices}>
          {slide.suggestions.map(category => (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`It was ${category}`}
              onPress={() => onAnswer(slide.tx, category)}
              style={({ pressed }) => [s.choice, pressed && s.choiceSelected]}>
              <CategoryGlyph category={category} size={18} />
              <Text style={s.choiceLabel}>{category}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {error ? <Text style={s.error}>Couldn’t save that. Try again.</Text> : null}
      {answer ? null : <TextButton label="It was personal" onPress={() => onAnswer(slide.tx, 'Personal')} />}
      <TextButton label="View transaction details" onPress={() => onOpenTransaction(slide.tx)} />
    </View>
  );
}

/** One segment of the progress row: full when seen, filling for the current slide. */
function StoryBar({ state }: { state: 'seen' | 'unseen' | Animated.Value }) {
  const s = useStyles();
  const width =
    state === 'seen'
      ? '100%'
      : state === 'unseen'
        ? '0%'
        : state.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={s.barTrack}>
      <Animated.View style={[s.barFill, { width }]} />
    </View>
  );
}

/**
 * Full-screen story for the month: top categories, income, then payments to place. Slides
 * auto-advance (a question waits for an answer); tap the left or right of the top half (or
 * swipe) to move, hold to pause, swipe down to close.
 */
export function StoryScreen({ navigation, route }: ScreenProps<'Story'>) {
  const s = useStyles();
  const { c } = useTheme();
  const [slides, setSlides] = useState<StorySlide[] | null>(null);
  const [index, setIndex] = useState(route.params.startIndex);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const closed = useRef(false);
  const pressedAt = useRef(0);

  useEffect(() => {
    listTransactions()
      .catch(() => [])
      .then(transactions => setSlides(monthlyStory(transactions)));
  }, []);

  const count = slides?.length ?? 0;
  const current = Math.min(index, Math.max(count - 1, 0));
  const slide = slides?.[current];
  const waiting = slide?.kind === 'question' && !answers[slide.tx.id];

  const close = useCallback(() => {
    if (!closed.current) {
      closed.current = true;
      navigation.goBack();
    }
  }, [navigation]);

  // The timer and gesture handlers outlive renders, so they reach the latest state through a ref.
  const actions = useRef({ go: (_delta: number) => {}, resume: () => {} });

  const resume = useCallback(() => {
    progress.stopAnimation(value => {
      if (waiting) {
        return; // a question stays until it's answered or skipped
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: SLIDE_MS * (1 - value),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => finished && actions.current.go(1));
    });
  }, [progress, waiting]);

  const go = useCallback(
    (delta: number) => {
      const next = current + delta;
      if (next >= count) {
        close();
      } else if (next < 0) {
        progress.setValue(0);
        resume();
      } else {
        setIndex(next);
      }
    },
    [close, count, current, progress, resume],
  );

  useEffect(() => {
    actions.current = { go, resume };
  }, [go, resume]);

  useEffect(() => {
    if (!slides) {
      return;
    }
    progress.setValue(0);
    actions.current.resume();
    return () => progress.stopAnimation();
  }, [current, slides, progress]);

  // Pause while a transaction is open on top of the story.
  useFocusEffect(
    useCallback(() => {
      actions.current.resume();
      return () => progress.stopAnimation();
    }, [progress]),
  );

  const onRelease = useCallback(
    (g: PanResponderGestureState) => {
      const { dx, dy, x0 } = g;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        actions.current.go(dx < 0 ? 1 : -1);
      } else if (dy > 80) {
        close();
      } else if (Date.now() - pressedAt.current < 250 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        actions.current.go(x0 < width * 0.3 ? -1 : 1);
      } else {
        actions.current.resume(); // a hold pauses; letting go continues
      }
    },
    [close, width],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pressedAt.current = Date.now();
          progress.stopAnimation();
        },
        onPanResponderRelease: (_e, g) => onRelease(g),
        onPanResponderTerminate: () => actions.current.resume(),
      }),
    [onRelease, progress],
  );

  const answer = async (tx: Transaction, category: string) => {
    setFailed(null);
    try {
      await updateTransaction(tx.id, { category, kind: kindFor(category), categoryConfirmed: true });
      setAnswers(a => ({ ...a, [tx.id]: category }));
      setTimeout(() => actions.current.go(1), 900);
    } catch {
      setFailed(tx.id);
    }
  };

  return (
    <Screen>
      <View style={s.bars}>
        {(slides ?? []).map((_, i) => (
          <StoryBar key={i} state={i < current ? 'seen' : i === current ? progress : 'unseen'} />
        ))}
      </View>
      <View style={s.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close story"
          onPress={close}
          style={({ pressed }) => [s.close, pressed && s.pressed]}>
          <CrossIcon size={18} color={c.inkMuted} />
        </Pressable>
      </View>

      <View style={s.storyCard}>
        <View
          style={s.stage}
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={slides ? `Story ${current + 1} of ${count}` : 'Loading story'}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => go(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
          {slide ? (
            <FadeIn key={current} index={0}>
              <Headline slide={slide} />
            </FadeIn>
          ) : null}
        </View>

        <View style={s.cardArea}>
          {slide ? (
            <FadeIn key={`card-${current}`} index={1}>
              <Facts
                slide={slide}
                answer={slide.kind === 'question' ? answers[slide.tx.id] : undefined}
                error={slide.kind === 'question' && failed === slide.tx.id}
                onDetails={query => navigation.navigate('Home', { tab: 'transactions', query })}
                onOpenTransaction={transaction => navigation.navigate('TransactionDetails', { transaction })}
                onAnswer={answer}
                onAdd={() => navigation.replace('AddTransaction')}
              />
            </FadeIn>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c, isDark) => ({
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  bars: { flexDirection: 'row', gap: space[1], paddingHorizontal: SCREEN_PADDING, paddingTop: space[4] },
  barTrack: { flex: 1, height: 3, borderRadius: radius.pill, backgroundColor: c.line, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.ink },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SCREEN_PADDING - space[3] },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },

  storyCard: {
    flex: 1,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: space[5],
    borderRadius: radius.xl,
    backgroundColor: c.surface,
    ...elevation(2, c, isDark),
  },
  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: space[6] },
  centre: { alignItems: 'center' },
  glyphCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[4],
  },
  glyphIncome: { backgroundColor: c.peacockSoft },
  eyebrow: { ...type.label, color: c.inkMuted },
  storyWord: { ...type.story, color: c.ink, marginTop: space[1], textAlign: 'center' },
  body: { ...type.body, color: c.inkMuted, textAlign: 'center' },
  bodyGap: { marginTop: space[6] },
  hero: { ...type.amountHero, color: c.ink },
  heroIncome: { color: c.peacock },
  meta: { ...type.caption, color: c.inkMuted, marginTop: space[1], textAlign: 'center' },
  caption: { ...type.caption, color: c.inkMuted },

  cardArea: { padding: space[6], paddingTop: 0, minHeight: 200, justifyContent: 'flex-end' },
  facts: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: space[5] },
  factsIncome: { gap: space[4] },
  factLine: { ...type.body, color: c.ink },
  factBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space[4] },
  factAmount: { ...type.amountMedium, color: c.ink },
  smallButton: { minHeight: TOUCH_TARGET, paddingHorizontal: space[5] },
  fullButton: { alignSelf: 'stretch' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[3], marginTop: space[5] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.line },
  dotActive: { backgroundColor: c.ink },

  incomeRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  incomeIcon: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: c.peacockSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeText: { flex: 1 },
  incomeSource: { ...type.bodyStrong, color: c.ink },
  incomeAmount: { ...type.amountMedium, color: c.peacock },

  questionArea: { alignItems: 'stretch', gap: space[2] },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  choice: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  choiceSelected: { backgroundColor: c.surfaceSunken, borderColor: c.ink },
  answered: { flexGrow: 0 },
  choiceLabel: { ...type.label, color: c.ink },
  error: { ...type.caption, color: c.low, textAlign: 'center' },
}));
