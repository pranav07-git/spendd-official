import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OutlineButton, PrimaryButton } from '../components/Buttons';
import { Screen } from '../components/Screen';
import { Spotlight } from '../components/Spotlight';
import type { ScreenProps } from '../navigation/types';
import { makeStyles, radius, SCREEN_PADDING, space, type, type SpotlightTone } from '../theme';

const INSIGHTS: { label: string; quote: string; tone: SpotlightTone }[] = [
  { label: 'Food', quote: 'You spent 28% more on food this month.', tone: 'violet' },
  { label: 'Shopping', quote: 'Shopping was your biggest spend this month.', tone: 'magenta' },
  { label: 'Saving', quote: 'You could save ₹4,200 on your spends this month.', tone: 'orange' },
];

/** Usable height (dp, inside the safe area) below which the intro's type and spacing tighten up. */
const COMPACT_BELOW = 760;
/** How long each insight stays in front before the deck moves on. */
const CYCLE_MS = 3200;
/**
 * Every card is laid out the same: label, then a two-line quote, at one fixed height that fits
 * exactly that (26 + 16 + 8 + 2 × 29 + 26), so no card has spare room and nothing shifts.
 */
const QUOTE_LINES = 2;
const CARD_HEIGHT = 136;
/** How far each card behind peeks out below the one in front of it. */
const PEEK = space[3];

export function IntroScreen({ navigation }: ScreenProps<'Intro'>) {
  const s = useStyles();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height - insets.top - insets.bottom < COMPACT_BELOW;

  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const deck = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    Animated.timing(deck, { toValue: 1, duration: 480, delay: 150, useNativeDriver: true }).start();
    return () => sub.remove();
  }, [deck]);

  // Each new front card slides up into place and fades in.
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 0 : 380, useNativeDriver: true }).start();
  }, [index, enter, reduceMotion]);

  const next = useCallback(() => setIndex(i => (i + 1) % INSIGHTS.length), []);

  // Moves on by itself (not with reduce motion on). A tap changes the index, which restarts the timer.
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const timer = setTimeout(next, CYCLE_MS);
    return () => clearTimeout(timer);
  }, [index, next, reduceMotion]);

  const insight = INSIGHTS[index];

  return (
    <Screen>
      <View style={s.content}>
        <Text style={[s.headline, compact && s.headlineCompact]} accessibilityRole="header">
          Know where your money goes
        </Text>
        <Text style={[s.body, compact && s.bodyCompact]}>
          Spendd shows you where your money went, what you pay for every month, and where you could save.
        </Text>

        {/* The deck sits in the middle of whatever room the copy and buttons leave. */}
        <View style={s.stage}>
          <Animated.View
            style={{
              opacity: deck,
              transform: [{ translateY: deck.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            }}>
            <View style={s.deck}>
              <View style={[s.behind, s.behindBack]} />
              <View style={[s.behind, s.behindMid]} />
              <Pressable
                onPress={next}
                accessibilityRole="button"
                accessibilityLabel={`${insight.label}: ${insight.quote}`}
                accessibilityHint="Shows the next example insight">
                <Animated.View
                  style={{
                    opacity: enter,
                    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  }}>
                  <Spotlight tone={insight.tone} style={s.front}>
                    <Text style={s.cardLabel}>{insight.label}</Text>
                    <Text style={s.cardQuote} numberOfLines={QUOTE_LINES} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {insight.quote}
                    </Text>
                  </Spotlight>
                </Animated.View>
              </Pressable>
            </View>

            <View style={s.dots}>
              {INSIGHTS.map((item, i) => (
                <View key={item.label} style={[s.dot, i === index && s.dotActive]} />
              ))}
            </View>
          </Animated.View>
        </View>

        <View style={s.authButtons}>
          <PrimaryButton label="Create account" onPress={() => navigation.navigate('SignUp')} />
          <OutlineButton label="Sign in" onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  content: { flex: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: space[4], paddingBottom: space[5] },
  // The poster moment: the biggest display type in the app, pulled tight. The line height still
  // clears descenders ("y", "g"): Android clips glyphs that hang below the last line's box.
  headline: { ...type.story, fontSize: 46, lineHeight: 52, letterSpacing: -2.2, color: c.ink, marginTop: space[8] },
  headlineCompact: { fontSize: 38, lineHeight: 44, letterSpacing: -1.8, marginTop: space[4] },
  body: { ...type.subhead, color: c.inkMuted, marginTop: space[5] },
  bodyCompact: { ...type.body, marginTop: space[3] },
  stage: { flex: 1, justifyContent: 'center', paddingVertical: space[4] },
  // Room below the front card for the two cards peeking out behind it.
  deck: { paddingBottom: PEEK * 2 },
  behind: { position: 'absolute', height: CARD_HEIGHT, borderRadius: radius.xl },
  behindMid: { left: space[3], right: space[3], bottom: PEEK, backgroundColor: c.surfaceSunken },
  behindBack: { left: space[6], right: space[6], bottom: 0, backgroundColor: c.surface },
  front: { height: CARD_HEIGHT, justifyContent: 'center' },
  cardLabel: { ...type.eyebrow, color: 'rgba(255,255,255,0.75)', marginBottom: space[2] },
  cardQuote: {
    ...type.subhead,
    fontFamily: type.title.fontFamily,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.7,
    color: '#FFFFFF',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[2], marginTop: space[5] },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: c.line },
  dotActive: { width: 20, backgroundColor: c.ink },
  authButtons: { gap: space[3] },
}));
