import { useEffect, useRef } from 'react';
import { Animated, ScrollView, Text, View, type DimensionValue } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { makeStyles, radius, SCREEN_PADDING, SECTION_GAP, space, type, type Palette } from '../theme';

const INSIGHTS: { label: string; quote: string; offset: DimensionValue; jar: keyof Palette['jar'] }[] = [
  { label: 'Food', quote: 'You spent 28% more on food this month.', offset: 0, jar: 'peach' },
  { label: 'Shopping', quote: 'Shopping was your biggest spend this month.', offset: '12%', jar: 'sky' },
  { label: 'Saving', quote: 'You could save ₹4,200 based on your recent spends.', offset: '4%', jar: 'mint' },
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
          {INSIGHTS.map((item, i) => (
            <Animated.View
              key={item.label}
              style={[
                s.card,
                s[item.jar],
                i > 0 && s.cardGap,
                {
                  marginLeft: item.offset,
                  opacity: cardAnims[i],
                  transform: [
                    { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                  ],
                },
              ]}>
              <Text style={s.cardLabel}>{item.label}</Text>
              <Text style={s.cardQuote}>{item.quote}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={s.spacer} />
        <PrimaryButton label="Next" onPress={() => navigation.navigate('Consent')} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  content: { flexGrow: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: space[6], paddingBottom: space[6] },
  // Full-screen onboarding moment: the story style, one step larger.
  headline: { ...type.story, fontSize: 36, lineHeight: 42, color: c.ink, marginTop: space[10] },
  body: { ...type.body, color: c.inkMuted, marginTop: space[4] },
  cards: { marginTop: SECTION_GAP },
  card: {
    width: '84%',
    borderRadius: radius.l,
    paddingHorizontal: space[5],
    paddingVertical: space[5],
  },
  cardGap: { marginTop: space[3] },
  peach: { backgroundColor: c.jar.peach },
  sky: { backgroundColor: c.jar.sky },
  mint: { backgroundColor: c.jar.mint },
  lilac: { backgroundColor: c.jar.lilac },
  haldi: { backgroundColor: c.jar.haldi },
  rose: { backgroundColor: c.jar.rose },
  cardLabel: { ...type.label, color: c.ink, marginBottom: space[2] },
  cardQuote: { ...type.title, color: c.ink },
  spacer: { flexGrow: 1, minHeight: space[10] },
}));
