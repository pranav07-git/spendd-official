import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { PrimaryButton } from '../components/Buttons';
import { ProgressBars } from '../components/ProgressBars';
import { Screen } from '../components/Screen';
import type { ScreenProps } from '../navigation/types';
import { colors, fonts } from '../theme';

const INSIGHTS: { label: string; quote: ReactNode; offset: DimensionValue }[] = [
  {
    label: 'DINING',
    quote: (
      <>
        "You spent <Text style={{ fontFamily: fonts.serif }}>28% more</Text> on food this month."
      </>
    ),
    offset: 0,
  },
  { label: 'GROCERIES', quote: '“Your biggest expense category is Shopping”', offset: '18%' },
  { label: 'OPPORTUNITY', quote: '“You could save ₹4,200 based on recent patterns.”', offset: '2%' },
];

export function IntroScreen({ navigation }: ScreenProps<'Intro'>) {
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProgressBars total={2} active={0} />

        <Text style={styles.headline}>
          Know where{'\n'}your <Text style={styles.headlineItalic}>money</Text>
          {'\n'}goes
        </Text>
        <Text style={styles.body}>
          Spendd helps you understand your spending, subscriptions, habits, and opportunities to save.
        </Text>

        <View style={styles.cards}>
          {INSIGHTS.map((item, i) => (
            <Animated.View
              key={item.label}
              style={[
                styles.card,
                i > 0 && styles.cardOverlap,
                {
                  marginLeft: item.offset,
                  zIndex: i,
                  opacity: cardAnims[i],
                  transform: [
                    { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                  ],
                },
              ]}>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={styles.cardQuote}>{item.quote}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.spacer} />
        <PrimaryButton label="NEXT" withArrow onPress={() => navigation.navigate('Statement')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 52,
    lineHeight: 60,
    color: colors.text,
    marginTop: 40,
    letterSpacing: -1,
  },
  headlineItalic: { fontFamily: fonts.serifItalic },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 26,
    color: colors.textMuted,
    marginTop: 24,
  },
  cards: { marginTop: 36 },
  card: {
    width: '85%',
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 30,
    // Hard offset "shadow" from the design: white edge on the right and bottom.
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.text,
  },
  cardOverlap: { marginTop: -4 },
  cardLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
    marginBottom: 18,
  },
  cardQuote: {
    fontFamily: fonts.serifItalic,
    fontSize: 23,
    lineHeight: 29,
    color: colors.text,
  },
  spacer: { flexGrow: 1, minHeight: 40 },
});
