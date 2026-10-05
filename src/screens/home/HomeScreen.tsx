import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from '../../components/Avatar';
import { BellIcon } from '../../components/Icons';
import { StoryHeader } from '../../components/Layout';
import { Screen } from '../../components/Screen';
import { buildInsights } from '../../insights/engine';
import type { InsightsReport, StoryItem } from '../../insights/types';
import { useCloudInsights, type AiInsights } from '../../insights/useCloudInsights';
import type { ScreenProps } from '../../navigation/types';
import {
  DEFAULT_PROFILE,
  getBudget,
  getProfile,
  type Profile,
} from '../../storage/appState';
import type { Budget } from '../../transactions/budget';
import { formatRupees } from '../../transactions/format';
import { monthlyStory } from '../../transactions/stories';
import { autoCategorize } from '../../transactions/autoCategorize';
import { listTransactions } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';
import { makeStyles, radius, SCREEN_PADDING, space, type, useTheme } from '../../theme';
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
import { MyMoneyTab } from './MyMoneyTab';
import { ProfileTab } from './ProfileTab';
import { TabBar, type TabKey, TAB_BAR_CLEARANCE } from './TabBar';
import { TransactionsTab } from './TransactionsTab';

/** How many insights the home feed previews; the Insights tab shows them all. */
const HOME_INSIGHTS = 3;

function useToast() {
  const s = useStyles();
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
      style={[s.toast, { opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={s.toastText}>{message}</Text>
    </Animated.View>
  ) : null;

  return { show, node };
}

/** One card per story slide, in the same order the story viewer shows them. */
function storiesFor(transactions: Transaction[]): StoryItem[] {
  return monthlyStory(transactions).map(slide => {
    switch (slide.kind) {
      case 'empty':
        return { id: 'empty', glyph: 'Empty', title: 'No spends yet', caption: 'Nothing logged this month' };
      case 'category':
        return {
          id: slide.category,
          glyph: slide.category,
          title: slide.category,
          caption: `${formatRupees(slide.amount)} this month`,
        };
      case 'income':
        return { id: 'income', glyph: 'Income', title: 'Income', caption: `${formatRupees(slide.total)} earned` };
      case 'question':
        return {
          id: slide.tx.id,
          glyph: 'Question',
          title: formatRupees(slide.tx.amount),
          caption: 'What was this for?',
        };
    }
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
  const s = useStyles();
  const top = (ai.insights ?? report.insights).slice(0, HOME_INSIGHTS);
  const firstName = name.trim();
  return (
    <ScrollView
      contentContainerStyle={s.feed}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn index={0}>
        <Text style={s.greeting}>{firstName ? `Hi ${firstName}` : 'Hi there'}</Text>
        <StoryHeader story={report.headline} style={s.story} />
      </FadeIn>

      <FadeIn index={1}>
        <View style={s.firstCard}>
          <DailyStatusCard status={report.dailyStatus} />
        </View>
      </FadeIn>

      <FadeIn index={2}>
        <SectionTitle title="This month’s story" />
        <StoryStrip items={storiesFor(transactions)} onPress={onOpenStory} />
      </FadeIn>

      <FadeIn index={3}>
        <SectionTitle
          title="Insights"
          action={{ label: 'See all', onPress: onSeeAllInsights }}
        />
        <InsightsCard items={top} />
        <AiNote thinking={ai.thinking} written={ai.insights != null} />
      </FadeIn>

      {report.dailyBudget ? (
        <FadeIn index={4}>
          <View style={s.budget}>
            <DailyBudgetCard budget={report.dailyBudget} />
          </View>
        </FadeIn>
      ) : null}

      {report.habits.length > 0 ? (
        <FadeIn index={5}>
          <SectionTitle title="Spending habits" />
          <HabitChips habits={report.habits} />
        </FadeIn>
      ) : null}
    </ScrollView>
  );
}

export function HomeScreen({ navigation, route }: ScreenProps<'Home'>) {
  const [tab, setTab] = useState<TabKey>('home');
  const [txQuery, setTxQuery] = useState('');
  const [transactions, setTransactions] = useState<Transaction[] | null>(
    null,
  );
  const [budget, setBudget] = useState<Budget | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const toast = useToast();
  const s = useStyles();
  const { c } = useTheme();

  const reload = useCallback(async () => {
    const [txs, savedBudget, savedProfile] = await Promise.all([
      listTransactions().catch(() => [] as Transaction[]),
      getBudget().catch(() => null),
      getProfile().catch(() => DEFAULT_PROFILE),
    ]);
    setTransactions(txs);
    setBudget(savedBudget);
    setProfile(savedProfile);

    // Re-file payments from what the user taught Spendd, and ask Spendd AI about new merchants.
    // Runs in the background; the list refreshes only if something actually changed.
    autoCategorize(txs)
      .then(changed => (changed > 0 ? listTransactions().then(setTransactions) : undefined))
      .catch(() => {});
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

  // Spendd AI: Gemini words the eight fixed parameters computed from these transactions.
  const ai = useCloudInsights(transactions, report, budget);
  const openTab = (next: TabKey) => {
    setTab(next);
    reload();
  };

  // Other screens (the story's Details) open a tab here, optionally with a search filled in.
  const requested = route.params;
  useEffect(() => {
    if (requested?.tab) {
      setTab(requested.tab);
      setTxQuery(requested.query ?? '');
      navigation.setParams({ tab: undefined, query: undefined });
    }
  }, [requested, navigation]);
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
      {tab === 'transactions' || tab === 'insights' ? null : (
        <View style={s.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => openTab('profile')}
            style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
          >
            <Avatar profile={profile} size={40} round />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => toast.show('You’re all caught up')}
            style={({ pressed }) => [s.iconButton, s.bell, pressed && s.pressed]}
          >
            <BellIcon size={24} color={c.ink} strokeWidth={1.8} />
          </Pressable>
        </View>
      )}

      <View style={s.body}>
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
            key={txQuery}
            initialQuery={txQuery}
            transactions={transactions}
            onReload={reload}
            onBack={() => openTab('home')}
            onOpen={openTransaction}
            onAdd={addTransaction}
            onToast={toast.show}
          />
        ) : tab === 'insights' ? (
          <MyMoneyTab
            transactions={transactions}
            stories={ai.stories ?? report.insights.slice(0, 2).map(i => i.title)}
            onOpen={openTransaction}
            onOpenStory={() => navigation.navigate('Story', { startIndex: 0 })}
            onSearch={() => {
              setTxQuery('');
              openTab('transactions');
            }}
            onAdd={addTransaction}
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
        <TabBar active={tab} onChange={next => openTab(next)} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: c.bg,
  },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  bell: { borderRadius: radius.pill, marginRight: -space[2] },
  body: { flex: 1 },
  feed: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[2], paddingBottom: TAB_BAR_CLEARANCE },
  greeting: { ...type.heading, color: c.inkMuted },
  story: { marginTop: space[1] },
  firstCard: { marginTop: space[6] },
  budget: { marginTop: space[6] },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: TAB_BAR_CLEARANCE - space[4],
    maxWidth: '90%',
    backgroundColor: c.ink,
    borderRadius: radius.pill,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
  },
  toastText: { ...type.label, color: c.onInk },
}));
