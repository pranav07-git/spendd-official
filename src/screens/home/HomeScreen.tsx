import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
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
import { Avatar } from '../../components/Avatar';
import { BellIcon } from '../../components/Icons';
import { Screen } from '../../components/Screen';
import { buildInsights } from '../../insights/engine';
import type { InsightsReport, StoryItem } from '../../insights/types';
import { useAiInsights, type AiInsights } from '../../insights/useAiInsights';
import { useAiModel } from '../../insights/useAiModel';
import type { ScreenProps } from '../../navigation/types';
import {
  DEFAULT_PROFILE,
  getBudget,
  getProfile,
  type Profile,
} from '../../storage/appState';
import type { Budget } from '../../transactions/budget';
import { emojiFor } from '../../transactions/categories';
import { formatRupees } from '../../transactions/format';
import { todaysStory } from '../../transactions/stories';
import { listTransactions } from '../../transactions/store';
import { paymentCount } from '../../transactions/summary';
import type { Transaction } from '../../transactions/types';
import { colors, fonts } from '../../theme';
import { AccountsTab } from './AccountsTab';
import {
  AiNote,
  DailyBudgetCard,
  DailyStatusCard,
  FadeIn,
  HabitChips,
  InsightsCard,
  SectionTitle,
  StoryStrip,
} from './HomeSections';
import { InsightsTab } from './InsightsTab';
import { ProfileTab } from './ProfileTab';
import { TabBar, type TabKey } from './TabBar';
import { TransactionsTab } from './TransactionsTab';

/** How many insights the home feed previews; the Insights tab shows them all. */
const HOME_INSIGHTS = 3;

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

/** One card per story slide, in the same order the story viewer shows them. */
function storiesFor(transactions: Transaction[]): StoryItem[] {
  return todaysStory(transactions).map(slide => {
    if (slide.kind === 'empty') {
      return {
        id: 'empty',
        emoji: '🌱',
        title: 'No spends yet',
        caption: 'Nothing logged today',
      };
    }
    if (slide.kind === 'total') {
      return {
        id: 'total',
        emoji: '💰',
        title: formatRupees(slide.summary.total),
        caption: `Spent today • ${paymentCount(slide.summary.count)}`,
      };
    }
    return {
      id: slide.item.category,
      emoji: emojiFor(slide.item.category),
      title: slide.item.category,
      caption: `${formatRupees(slide.item.amount)} • ${paymentCount(
        slide.item.count,
      )}`,
    };
  });
}

function HomeFeed({
  name,
  transactions,
  report,
  ai,
  onOpenStory,
  onSeeAllInsights,
}: {
  name: string;
  transactions: Transaction[];
  report: InsightsReport;
  ai: AiInsights;
  onOpenStory: (index: number) => void;
  onSeeAllInsights: () => void;
}) {
  const top = (ai.insights ?? report.insights).slice(0, HOME_INSIGHTS);
  return (
    <ScrollView
      contentContainerStyle={styles.feed}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn index={0}>
        <Text style={styles.greeting}>
          {greetingFor(new Date())}, {name}
        </Text>
        <Text style={styles.subGreeting}>{report.headline}</Text>
      </FadeIn>

      <FadeIn index={1}>
        <View style={styles.firstCard}>
          <DailyStatusCard status={report.dailyStatus} />
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <SectionTitle title="Today's Story" />
        <StoryStrip items={storiesFor(transactions)} onPress={onOpenStory} />
      </FadeIn>

      <FadeIn index={3}>
        <SectionTitle
          title="Insights"
          action={{ label: 'SEE ALL', onPress: onSeeAllInsights }}
        />
        <InsightsCard items={top} />
        <AiNote thinking={ai.thinking} written={ai.insights != null} />
      </FadeIn>

      {report.dailyBudget ? (
        <FadeIn index={4}>
          <View style={styles.budget}>
            <DailyBudgetCard budget={report.dailyBudget} />
          </View>
        </FadeIn>
      ) : null}

      {report.habits.length > 0 ? (
        <FadeIn index={5}>
          <SectionTitle title="Spending Habits" />
          <HabitChips habits={report.habits} />
        </FadeIn>
      ) : null}
    </ScrollView>
  );
}

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [tab, setTab] = useState<TabKey>('home');
  const [transactions, setTransactions] = useState<Transaction[] | null>(
    null,
  );
  const [budget, setBudget] = useState<Budget | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const toast = useToast();

  const reload = useCallback(async () => {
    const [txs, savedBudget, savedProfile] = await Promise.all([
      listTransactions().catch(() => [] as Transaction[]),
      getBudget().catch(() => null),
      getProfile().catch(() => DEFAULT_PROFILE),
    ]);
    setTransactions(txs);
    setBudget(savedBudget);
    setProfile(savedProfile);
  }, []);

  // Screenshots are logged in the background, and budget/profile are edited on
  // other screens, so reload on return to the app or this screen, or a tab switch.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      state => state === 'active' && reload(),
    );
    return () => sub.remove();
  }, [reload]);

  // The on-device insights model: pure and fast, so it reruns on every change.
  const report = useMemo(
    () => (transactions ? buildInsights(transactions, budget) : null),
    [transactions, budget],
  );

  // Spendd AI: the optional on-device model rewrites the engine's facts into its own insights.
  const aiModel = useAiModel();
  const ai = useAiInsights(
    report,
    aiModel.enabled && aiModel.phase === 'ready' ? aiModel.path : null,
  );

  const openTab = (next: TabKey) => {
    setTab(next);
    reload();
  };
  const openTransaction = (transaction: Transaction) =>
    navigation.navigate('TransactionDetails', { transaction });
  const addTransaction = () => navigation.navigate('AddTransaction');
  const setBudgetScreen = () => navigation.navigate('SetBudget');

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

  return (
    <Screen>
      {tab === 'transactions' ? null : (
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => openTab('profile')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar profile={profile} size={40} round />
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
        {!transactions || !report ? null : tab === 'home' ? (
          <HomeFeed
            name={profile.name}
            transactions={transactions}
            report={report}
            ai={ai}
            onOpenStory={startIndex =>
              navigation.navigate('Story', { startIndex })
            }
            onSeeAllInsights={() => openTab('insights')}
          />
        ) : tab === 'transactions' ? (
          <TransactionsTab
            transactions={transactions}
            onReload={reload}
            onBack={() => openTab('home')}
            onOpen={openTransaction}
            onAdd={addTransaction}
            onToast={toast.show}
          />
        ) : tab === 'insights' ? (
          <InsightsTab
            report={report}
            ai={ai}
            aiModel={aiModel}
            transactions={transactions}
            onOpen={openTransaction}
            onAdd={addTransaction}
            onSetBudget={setBudgetScreen}
            onSetUpAi={() => openTab('profile')}
          />
        ) : tab === 'accounts' ? (
          <AccountsTab
            transactions={transactions}
            budget={budget}
            onOpen={openTransaction}
            onSetBudget={setBudgetScreen}
          />
        ) : (
          <ProfileTab
            profile={profile}
            transactions={transactions}
            budget={budget}
            aiModel={aiModel}
            onEditProfile={() => navigation.navigate('EditProfile')}
            onSetBudget={setBudgetScreen}
            onChangePin={() => navigation.navigate('ChangePin')}
            onLock={() =>
              navigation.reset({ index: 0, routes: [{ name: 'Unlock' }] })
            }
            onReset={() =>
              navigation.reset({ index: 0, routes: [{ name: 'Intro' }] })
            }
            onReload={reload}
            onToast={toast.show}
          />
        )}
        {toast.node}
      </View>

      <TabBar active={tab} onChange={next => openTab(next)} />
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
