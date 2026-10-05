import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type PanResponderGestureState,
} from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { ArrowDownIcon, ArrowUpIcon, CrossIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { emojiFor } from '../transactions/categories';
import { formatDayMonth, formatRupees, formatTime, titleFor } from '../transactions/format';
import { listTransactions } from '../transactions/store';
import { todaysStory, type StorySlide } from '../transactions/stories';
import { paymentCount } from '../transactions/summary';
import { colors, fonts } from '../theme';
import { FadeIn } from './home/HomeSections';

const SLIDE_MS = 5000;
const MAX_ROWS = 4;

function More({ hidden }: { hidden: number }) {
  return hidden > 0 ? <Text style={styles.more}>+{hidden} MORE</Text> : null;
}

function SlideContent({ slide }: { slide: StorySlide }) {
  if (slide.kind === 'empty') {
    return (
      <>
        <View style={styles.emojiTile}>
          <Text style={styles.emojiLarge}>🌱</Text>
        </View>
        <Text style={styles.heading}>Nothing spent yet</Text>
        <Text style={styles.body}>
          Your story fills up as you pay. Share a payment screenshot to Spendd or add a transaction by hand.
        </Text>
      </>
    );
  }

  if (slide.kind === 'total') {
    const { summary, change } = slide;
    const Arrow = change !== null && change > 0 ? ArrowUpIcon : ArrowDownIcon;
    return (
      <>
        <Text style={styles.eyebrow}>SPENT TODAY</Text>
        <Text style={styles.hero} adjustsFontSizeToFit numberOfLines={1}>
          {formatRupees(summary.total)}
        </Text>
        <Text style={styles.heroCaption}>across {paymentCount(summary.count)}</Text>
        {change !== null ? (
          <View style={styles.changeRow}>
            <Arrow size={13} color={colors.ink} strokeWidth={2} />
            <Text style={styles.changeLabel}>
              {Math.abs(change)}% {change > 0 ? 'MORE' : 'LESS'} THAN YOUR DAILY AVERAGE
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {summary.categories.slice(0, MAX_ROWS).map(c => (
            <View key={c.category} style={styles.shareRow}>
              <View style={styles.shareTop}>
                <Text style={styles.rowTitle}>
                  {emojiFor(c.category)}  {c.category}
                </Text>
                <Text style={styles.rowAmount}>{formatRupees(c.amount)}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${Math.max(Math.round(c.share * 100), 2)}%` }]} />
              </View>
            </View>
          ))}
          <More hidden={summary.categories.length - MAX_ROWS} />
        </View>
      </>
    );
  }

  const { item } = slide;
  return (
    <>
      <View style={styles.emojiTile}>
        <Text style={styles.emojiLarge}>{emojiFor(item.category)}</Text>
      </View>
      <Text style={styles.eyebrow}>TODAY ON</Text>
      <Text style={styles.heading}>{item.category}</Text>
      <Text style={styles.hero} adjustsFontSizeToFit numberOfLines={1}>
        {formatRupees(item.amount)}
      </Text>
      <Text style={styles.changeLabel}>
        {Math.round(item.share * 100)}% OF TODAY’S SPENDING • {paymentCount(item.count).toUpperCase()}
      </Text>

      <View style={styles.list}>
        {item.transactions.slice(0, MAX_ROWS).map(tx => (
          <View key={tx.id} style={styles.txRow}>
            <View style={styles.txText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {titleFor(tx)}
              </Text>
              <Text style={styles.txMeta} numberOfLines={1}>
                {[tx.source, tx.hasTime ? formatTime(tx.occurredAt) : null].filter(Boolean).join(' • ').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.rowAmount}>-{formatRupees(tx.amount!)}</Text>
          </View>
        ))}
        <More hidden={item.transactions.length - MAX_ROWS} />
      </View>
    </>
  );
}

/** One segment of the progress row: full when seen, filling for the current slide. */
function StoryBar({ state }: { state: 'seen' | 'unseen' | Animated.Value }) {
  const width =
    state === 'seen'
      ? '100%'
      : state === 'unseen'
        ? '0%'
        : state.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { width }]} />
    </View>
  );
}

/**
 * Full-screen, Instagram-style viewer for Today's Story. Slides auto-advance; tap the left or right
 * side (or swipe) to move, hold to pause, swipe down to close.
 */
export function StoryScreen({ navigation, route }: ScreenProps<'Story'>) {
  const [slides, setSlides] = useState<StorySlide[] | null>(null);
  const [index, setIndex] = useState(route.params.startIndex);
  const progress = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const closed = useRef(false);
  const pressedAt = useRef(0);

  useEffect(() => {
    listTransactions()
      .catch(() => [])
      .then(transactions => setSlides(todaysStory(transactions)));
  }, []);

  const count = slides?.length ?? 0;
  const current = Math.min(index, Math.max(count - 1, 0));

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
      Animated.timing(progress, {
        toValue: 1,
        duration: SLIDE_MS * (1 - value),
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(({ finished }) => finished && actions.current.go(1));
    });
  }, [progress]);

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
    resume();
    return () => progress.stopAnimation();
  }, [current, slides, progress, resume]);

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

  const slide = slides?.[current];

  return (
    <Screen>
      <View style={styles.bars}>
        {(slides ?? []).map((_, i) => (
          <StoryBar key={i} state={i < current ? 'seen' : i === current ? progress : 'unseen'} />
        ))}
      </View>

      <View style={styles.topRow}>
        <View style={styles.badgeSquare} />
        <Text style={styles.storyName}>Today’s Story</Text>
        <Text style={styles.storyDate}>{formatDayMonth(Date.now()).toUpperCase()}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close story"
          hitSlop={14}
          onPress={close}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <CrossIcon size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View
        style={styles.stage}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={slides ? `Story ${current + 1} of ${count}` : 'Loading story'}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => go(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
        {slide ? (
          <FadeIn key={current} index={0}>
            <SlideContent slide={slide} />
          </FadeIn>
        ) : null}
      </View>

      {slide?.kind === 'empty' ? (
        <PrimaryButton
          label="ADD A TRANSACTION"
          withArrow
          onPress={() => navigation.replace('AddTransaction')}
          style={styles.cta}
        />
      ) : (
        <Text style={styles.hint}>TAP TO CONTINUE • SWIPE DOWN TO CLOSE</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 10 },
  barTrack: { flex: 1, height: 3, backgroundColor: colors.track, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.ink },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  badgeSquare: { width: 8, height: 8, backgroundColor: colors.ink },
  storyName: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink },
  storyDate: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.5, color: colors.inkMuted },
  close: { marginLeft: 'auto', padding: 4 },

  stage: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  emojiTile: {
    width: 72,
    height: 72,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  emojiLarge: { fontSize: 34 },
  eyebrow: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 2.4, color: colors.inkMuted },
  heading: { fontFamily: fonts.serifBold, fontSize: 44, lineHeight: 54, color: colors.ink, marginTop: 6 },
  hero: { fontFamily: fonts.serif, fontSize: 64, lineHeight: 82, color: colors.ink },
  heroCaption: { fontFamily: fonts.serifItalic, fontSize: 19, color: colors.inkMuted, marginTop: -4 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 25, color: colors.inkMuted, marginTop: 14 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
  changeLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 0.8, color: colors.ink, marginTop: 4 },

  list: { marginTop: 40, gap: 18 },
  shareRow: { gap: 8 },
  shareTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
  rowAmount: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
  track: { height: 4, backgroundColor: colors.track, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.ink },
  txRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 14 },
  txText: { flex: 1, marginRight: 12 },
  txMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkMuted, marginTop: 3 },
  more: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 2, color: colors.inkMuted },

  hint: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.inkFaint,
    textAlign: 'center',
    paddingVertical: 20,
  },
  cta: { marginHorizontal: 20, marginBottom: 20 },
});
