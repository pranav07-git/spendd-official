import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BellIcon } from '../../components/Icons';
import { StoryHeader } from '../../components/Layout';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { buildInsights } from '../../insights/engine';
import type { InsightsReport, StoryItem } from '../../insights/types';
import { useCloudInsights, type AiInsights } from '../../insights/useCloudInsights';
import type { ScreenProps } from '../../navigation/types';
import { firstName } from '../../storage/appState';
import { formatRupees } from '../../transactions/format';
import { monthlyStory } from '../../transactions/stories';
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
import { useMoneyData } from './useMoneyData';

/** How many insights the home feed previews; the Insights tab shows them all. */
const HOME_INSIGHTS = 3;

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
  const first = firstName(name);
  return (
    <ScrollView
      contentContainerStyle={s.feed}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn index={0}>
        <Text style={s.greeting}>{first ? `Hi ${first}` : 'Hi there'}</Text>
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

export function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const [tab, setTab] = useState<TabKey>('home');
  const { transactions, budget, profile, reload } = useMoneyData();
  const toast = useToast(TAB_BAR_CLEARANCE - space[4]);
  const s = useStyles();
  const { c } = useTheme();

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

  const openTransaction = (transaction: Transaction) =>
    navigation.navigate('TransactionDetails', { transaction });
  const addTransaction = () => navigation.navigate('AddTransaction');
  const setBudgetScreen = () => navigation.navigate('SetBudget');
  const searchTransactions = (query = '') => navigation.navigate('Transactions', { query });

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
      {tab !== 'home' ? null : (
        <View style={s.topBar}>
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
            onSeeAllInsights={() =>
              navigation.navigate('Insights', {
                items: ai.insights ?? report.insights,
                written: ai.insights != null,
              })
            }
          />
        ) : tab === 'transactions' ? (
          <TransactionsTab
            transactions={transactions}
            onReload={reload}
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
            onSearch={() => searchTransactions()}
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
    justifyContent: 'flex-end',
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
}));
