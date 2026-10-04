import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { OutlineButton } from '../../components/Buttons';
import { BellIcon } from '../../components/Icons';
import { Screen } from '../../components/Screen';
import { USER_NAME } from '../../config';
import {
  dailyBudget,
  dailyStatus,
  habits,
  insights,
  todaysStory,
} from '../../data/homeSample';
import type { ScreenProps } from '../../navigation/types';
import { getStatement, type ImportedStatement } from '../../storage/appState';
import { colors, fonts } from '../../theme';
import {
  DailyBudgetCard,
  DailyStatusCard,
  FadeIn,
  HabitChips,
  InsightsCard,
  SectionTitle,
  StoryStrip,
} from './HomeSections';
import { TABS, TabBar, type TabKey } from './TabBar';
import { TransactionsTab } from './TransactionsTab';

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (text: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(text);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMessage(null));
    }, 2000);
  };

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const node = message ? (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, { opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  ) : null;

  return { show, node };
}

function HomeFeed({ onSeeAllInsights }: { onSeeAllInsights: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={styles.feed}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn index={0}>
        <Text style={styles.greeting}>
          {greetingFor(new Date())}, {USER_NAME}
        </Text>
        <Text style={styles.subGreeting}>
          You're spending smarter this week.
        </Text>
      </FadeIn>

      <FadeIn index={1}>
        <View style={styles.firstCard}>
          <DailyStatusCard status={dailyStatus} />
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <SectionTitle title="Today's Story" />
        <StoryStrip items={todaysStory} />
      </FadeIn>

      <FadeIn index={3}>
        <SectionTitle
          title="Insights"
          action={{ label: 'SEE ALL', onPress: onSeeAllInsights }}
        />
        <InsightsCard items={insights} />
      </FadeIn>

      <FadeIn index={4}>
        <View style={styles.budget}>
          <DailyBudgetCard budget={dailyBudget} />
        </View>
      </FadeIn>

      <FadeIn index={5}>
        <SectionTitle title="Spending Habits" />
        <HabitChips habits={habits} />
      </FadeIn>
    </ScrollView>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>Coming soon.</Text>
    </View>
  );
}

function Profile({ onLock }: { onLock: () => void }) {
  const [statement, setStatement] = useState<ImportedStatement | null>(null);

  useEffect(() => {
    getStatement().then(setStatement);
  }, []);

  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>{USER_NAME}</Text>
      <Text style={styles.placeholderText}>
        {statement
          ? `Statement imported: ${statement.name}`
          : 'No statement imported yet.'}
      </Text>
      <OutlineButton label="LOCK APP" onPress={onLock} style={styles.lock} />
    </View>
  );
}

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [tab, setTab] = useState<TabKey>('home');
  const toast = useToast();

  // Android back on another tab returns to Home before leaving the app.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (tab !== 'home') {
          setTab('home');
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [tab]),
  );

  // Shared screenshots are confirmed with a notification (Android 13+ asks once).
  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ).catch(() => {});
    }
  }, []);

  const tabTitle = TABS.find(t => t.key === tab)?.label ?? '';

  return (
    <Screen>
      {tab === 'transactions' ? null : (
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => setTab('profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <Text style={styles.avatarInitial}>{USER_NAME.charAt(0)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={12}
            onPress={() => toast.show('You’re all caught up')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <BellIcon size={24} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
        </View>
      )}

      <View style={styles.body}>
        {tab === 'home' ? (
          <HomeFeed onSeeAllInsights={() => setTab('insights')} />
        ) : tab === 'transactions' ? (
          <TransactionsTab
            onBack={() => setTab('home')}
            onOpen={transaction =>
              navigation.navigate('TransactionDetails', { transaction })
            }
            onToast={toast.show}
          />
        ) : tab === 'profile' ? (
          <Profile
            onLock={() =>
              navigation.reset({ index: 0, routes: [{ name: 'Unlock' }] })
            }
          />
        ) : (
          <ComingSoon title={tabTitle} />
        )}
        {toast.node}
      </View>

      <TabBar active={tab} onChange={setTab} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  topBar: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.serif,
    fontSize: 17,
    color: colors.inkMuted,
  },
  body: { flex: 1 },
  feed: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 40 },
  greeting: {
    fontFamily: fonts.serif,
    fontSize: 31,
    lineHeight: 40,
    color: colors.ink,
  },
  subGreeting: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: colors.inkMuted,
    marginTop: 2,
  },
  firstCard: { marginTop: 26 },
  budget: { marginTop: 24 },
  placeholder: { flex: 1, paddingHorizontal: 20, paddingTop: 40 },
  placeholderTitle: {
    fontFamily: fonts.serif,
    fontSize: 31,
    color: colors.ink,
  },
  placeholderText: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkMuted,
    marginTop: 10,
  },
  lock: { marginTop: 32 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 16,
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.background,
  },
});
