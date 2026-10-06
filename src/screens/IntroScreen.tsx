import { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import { OutlineButton, PrimaryButton } from '../components/Buttons';
import { Screen } from '../components/Screen';
import { Spotlight } from '../components/Spotlight';
import type { ScreenProps } from '../navigation/types';
import { makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, type } from '../theme';

const INSIGHTS: { label: string; quote: string }[] = [
  { label: 'Food', quote: 'You spent 28% more on food this month.' },
  { label: 'Shopping', quote: 'Shopping was your biggest spend this month.' },
  { label: 'Saving', quote: 'You could save ₹4,200 based on your recent spends.' },
];

export function IntroScreen({ navigation }: ScreenProps<'Intro'>) {
  const s = useStyles();
  const cardAnims = useRef(INSIGHTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      140,
      cardAnims.map(v =>
        Animated.timing(v, { toValue: 1, duration: 420, delay: 200, useNativeDriver: true }),
      ),
    ).start();
  }, [cardAnims]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.headline} accessibilityRole="header">
          Know where your money goes
        </Text>
        <Text style={s.body}>
          Spendd shows you where your money went, what you pay for every month, and where you could save.
        </Text>

        <View style={s.cards}>
          {INSIGHTS.map((item, i) => {
            const content = (
              <>
                <Text style={[s.cardLabel, i === 0 && s.onSpotlight]}>{item.label}</Text>
                <Text style={[s.cardQuote, i === 0 && s.spotlightQuote]}>{item.quote}</Text>
              </>
            );
            return (
              <Animated.View
                key={item.label}
                style={[
                  i > 0 && s.cardGap,
                  {
                    opacity: cardAnims[i],
                    transform: [
                      { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                    ],
                  },
                ]}>
                {/* The first card is the screen's one gradient spotlight; the rest are charcoal. */}
                {i === 0 ? <Spotlight tone="violet">{content}</Spotlight> : <View style={s.card}>{content}</View>}
              </Animated.View>
            );
          })}
        </View>

        <View style={s.spacer} />
        <View style={s.authButtons}>
          <PrimaryButton label="Create account" onPress={() => navigation.navigate('SignUp')} />
          <OutlineButton label="Sign in" onPress={() => navigation.navigate('Login')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  content: { flexGrow: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: space[6], paddingBottom: space[6] },
  // The poster moment: the biggest display type in the app, pulled tight.
  headline: { ...type.story, fontSize: 46, lineHeight: 46, letterSpacing: -2.2, color: c.ink, marginTop: space[10] },
  body: { ...type.subhead, color: c.inkMuted, marginTop: space[5] },
  cards: { marginTop: SECTION_GAP },
  card: { borderRadius: radius.l, backgroundColor: c.surface, padding: space[5] },
  cardGap: { marginTop: space[3] },
  cardLabel: { ...type.eyebrow, color: c.inkMuted, marginBottom: space[2] },
  cardQuote: { ...type.bodyStrong, fontSize: 17, lineHeight: 23, letterSpacing: -0.3, color: c.ink },
  onSpotlight: { color: 'rgba(255,255,255,0.75)' },
  spotlightQuote: { ...type.subhead, fontFamily: type.title.fontFamily, fontSize: 22, lineHeight: 27, letterSpacing: -0.6 },
  spacer: { flexGrow: 1, minHeight: space[10] },
  authButtons: { gap: space[3] },
}));
