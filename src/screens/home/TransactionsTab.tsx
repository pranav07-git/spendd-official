import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { OutlineButton, PrimaryButton, TextButton } from '../../components/Buttons';
import { PayeeAvatar } from '../../components/PayeeAvatar';
import { Chips } from '../../components/Chips';
import { ChevronLeftIcon, FilterIcon, SearchIcon } from '../../components/Icons';
import { StoryHeader } from '../../components/Layout';
import { lifetimeStats } from '../../insights/engine';
import {
  addDays,
  formatDayMonth,
  formatRupees,
  LONG_MONTHS,
  matchesQuery,
  startOfDay,
  subtitleFor,
  titleFor,
} from '../../transactions/format';
import { importScreenshot } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';
import { makeStyles, radius, SCREEN_PADDING, space, TOUCH_TARGET, type, useTheme } from '../../theme';
import { TAB_BAR_CLEARANCE } from './TabBar';

type Filter = 'all' | 'debit' | 'credit';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'debit', label: 'Spent' },
  { key: 'credit', label: 'Received' },
];

/** "₹420" for a spend, "+₹420" for money in. */
function rowAmount(tx: Transaction): string {
  if (tx.amount == null) {
    return '';
  }
  return tx.direction === 'credit' ? `+${formatRupees(tx.amount)}` : formatRupees(tx.amount);
}

function dayTitle(day: number, now: number): string {
  const today = startOfDay(now);
  if (day === today) {
    return 'Today';
  }
  if (day === addDays(today, -1)) {
    return 'Yesterday';
  }
  const label = formatDayMonth(day);
  return new Date(day).getFullYear() === new Date(now).getFullYear() ? label : `${label} ${new Date(day).getFullYear()}`;
}

type DayGroup = { title: string; total: number; data: Transaction[] };

/** Newest first, grouped under Today / Yesterday / 12 Oct, with each day's spend total. */
function groupDays(transactions: Transaction[], now: number = Date.now()): DayGroup[] {
  const days = new Map<number, Transaction[]>();
  [...transactions]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .forEach(tx => {
      const day = startOfDay(tx.occurredAt);
      days.set(day, [...(days.get(day) ?? []), tx]);
    });
  return [...days.entries()].map(([day, data]) => ({
    title: dayTitle(day, now),
    total: data.reduce((sum, tx) => sum + (tx.direction === 'debit' && tx.amount != null ? tx.amount : 0), 0),
    data,
  }));
}

type Props = {
  /** Loaded and kept fresh by HomeScreen; null until the first load. */
  transactions: Transaction[] | null;
  onReload: () => Promise<void>;
  onBack: () => void;
  onOpen: (transaction: Transaction) => void;
  onAdd: () => void;
  onToast: (message: string) => void;
  /** Pre-filled search, e.g. a category opened from the story. */
  initialQuery?: string;
};

export function TransactionsTab({ transactions, onReload, onBack, onOpen, onAdd, onToast, initialQuery = '' }: Props) {
  const s = useStyles();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const pendingRefreshes = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = pendingRefreshes.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await onReload();
    setRefreshing(false);
  };

  const addScreenshot = async () => {
    try {
      const [file] = await pick({ type: [types.images] });
      await importScreenshot(file.uri);
      onToast('Reading your screenshot…');
      // OCR runs in a background worker; check back shortly.
      pendingRefreshes.current.push(setTimeout(onReload, 2500), setTimeout(onReload, 6000));
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) {
        onToast('Couldn’t open that image. Try another screenshot.');
      }
    }
  };

  const visible = (transactions ?? []).filter(
    tx => (filter === 'all' || tx.direction === filter) && matchesQuery(tx, query),
  );
  const sections = groupDays(visible);
  const isEmpty = transactions !== null && transactions.length === 0;

  const thisMonth = transactions && transactions.length > 0 ? lifetimeStats(transactions).thisMonth : 0;
  const monthName = LONG_MONTHS[new Date().getMonth()];
  const story =
    isEmpty
        ? 'No spends yet. Share your next UPI screenshot to start.'
        : thisMonth > 0
          ? `${formatRupees(Math.round(thisMonth))} spent in ${monthName}.`
          : `Nothing spent in ${monthName} yet.`;
  const caption = transactions && !isEmpty ? `${transactions.length} ${transactions.length === 1 ? 'payment' : 'payments'} logged so far.` : null;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={onBack}
          style={({ pressed }) => [s.iconButton, pressed && s.pressed]}>
          <ChevronLeftIcon size={24} color={c.ink} strokeWidth={2} />
        </Pressable>
        <Text style={s.title} accessibilityRole="header">
          Transactions
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filter === 'all' ? 'Filter transactions' : `Filter transactions, showing ${FILTERS.find(f => f.key === filter)!.label.toLowerCase()}`}
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters(open => !open)}
          style={({ pressed }) => [s.iconButton, filter !== 'all' && s.iconButtonActive, pressed && s.pressed]}>
          <FilterIcon size={22} color={c.ink} strokeWidth={1.8} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={tx => tx.id}
        contentContainerStyle={s.list}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={c.ink}
            colors={[c.ink]}
            progressBackgroundColor={c.surface}
          />
        }
        ListHeaderComponent={
          <>
            {transactions && !isEmpty ? <StoryHeader story={story} caption={caption} style={s.story} /> : null}
            {isEmpty ? null : (
              <View style={s.search}>
                <SearchIcon size={20} color={c.inkMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search spends"
                  placeholderTextColor={c.inkSubtle}
                  style={s.searchInput}
                  returnKeyType="search"
                  autoCorrect={false}
                  accessibilityLabel="Search transactions"
                />
              </View>
            )}
            {showFilters ? (
              <View style={s.filters}>
                <Chips
                  options={FILTERS.map(f => f.label)}
                  selected={FILTERS.find(f => f.key === filter)!.label}
                  onSelect={label => setFilter(FILTERS.find(f => f.label === label)!.key)}
                />
              </View>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={s.dayHeader} accessible accessibilityRole="header">
            <Text style={s.dayTitle}>{section.title}</Text>
            {section.total > 0 ? <Text style={s.dayTotal}>{formatRupees(Math.round(section.total))}</Text> : null}
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const credit = item.direction === 'credit';
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${titleFor(item)}, ${
                item.amount == null ? 'amount missing' : `${formatRupees(item.amount)} ${credit ? 'received' : 'spent'}`
              }, ${subtitleFor(item)}${item.needsReview ? ', needs a look' : ''}`}
              onPress={() => onOpen(item)}
              android_ripple={{ color: c.surfaceSunken }}
              style={({ pressed }) => [
                s.row,
                first && s.rowFirst,
                last && s.rowLast,
                !first && s.rowDivider,
                pressed && s.rowPressed,
              ]}>
              <PayeeAvatar tx={item} />
              <View style={s.rowText}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {titleFor(item)}
                </Text>
                <View style={s.metaLine}>
                  {item.needsReview ? (
                    <View style={s.tag}>
                      <Text style={s.tagText}>Needs a look</Text>
                    </View>
                  ) : null}
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {subtitleFor(item)}
                  </Text>
                </View>
              </View>
              {item.amount == null ? (
                <Text style={s.rowAddAmount}>Add amount</Text>
              ) : (
                <Text style={[s.rowAmount, credit && s.rowAmountIn]}>{rowAmount(item)}</Text>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isEmpty ? (
            <View style={s.empty}>
              <StoryHeader story={story} />
              <Text style={s.emptyText}>
                After paying in any UPI or bank app, tap Share on the payment screen and choose Spendd. We’ll read
                the amount, payee, date and time and log it here. Paid in cash? Add it yourself.
              </Text>
              <PrimaryButton label="Add a screenshot" onPress={addScreenshot} style={s.emptyButton} />
              <OutlineButton label="Add manually" onPress={onAdd} style={s.emptyButtonNext} />
            </View>
          ) : transactions !== null ? (
            <Text style={s.noMatch}>
              {query.trim()
                ? `Nothing matches “${query.trim()}”. Try a payee, category or amount.`
                : 'Nothing here with this filter. Try All.'}
            </Text>
          ) : undefined
        }
        ListFooterComponent={
          transactions && transactions.length > 0 ? (
            <View style={s.footerActions}>
              <TextButton label="Add a screenshot" onPress={addScreenshot} />
              <TextButton label="Add manually" onPress={onAdd} />
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const useStyles = makeStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING - 10,
  },
  iconButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: { backgroundColor: c.surfaceSunken },
  pressed: { opacity: 0.7 },
  title: { ...type.title, color: c.ink },
  list: { paddingHorizontal: SCREEN_PADDING, paddingTop: space[4], paddingBottom: TAB_BAR_CLEARANCE },
  story: { marginBottom: space[6] },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 48,
    borderRadius: radius.m,
    backgroundColor: c.surfaceSunken,
    paddingHorizontal: space[4],
  },
  searchInput: { ...type.body, flex: 1, color: c.ink, paddingVertical: space[2] },
  filters: { marginTop: space[3] },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space[6],
    marginBottom: space[2],
  },
  dayTitle: { ...type.label, color: c.inkMuted },
  dayTotal: { ...type.caption, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: c.surface,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  rowFirst: { borderTopLeftRadius: radius.m, borderTopRightRadius: radius.m },
  rowLast: { borderBottomLeftRadius: radius.m, borderBottomRightRadius: radius.m },
  rowDivider: { borderTopWidth: 1, borderTopColor: c.line },
  rowPressed: { backgroundColor: c.surfaceSunken },
  rowText: { flex: 1 },
  rowTitle: { ...type.bodyStrong, color: c.ink },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowMeta: { ...type.caption, color: c.inkMuted, flexShrink: 1 },
  tag: {
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: c.headsup,
    paddingHorizontal: space[1] + 2,
  },
  tagText: { ...type.caption, fontSize: 12, lineHeight: 16, color: c.headsup },
  rowAmount: { ...type.amount, color: c.ink },
  rowAmountIn: { color: c.peacock },
  rowAddAmount: { ...type.label, color: c.headsup },
  empty: { paddingTop: space[4] },
  emptyText: { ...type.body, color: c.inkMuted, marginTop: space[4] },
  emptyButton: { marginTop: space[8] },
  emptyButtonNext: { marginTop: space[3] },
  noMatch: { ...type.body, color: c.inkMuted, textAlign: 'center', marginTop: space[10] },
  footerActions: { flexDirection: 'row', justifyContent: 'center', gap: space[4], marginTop: space[4] },
}));
