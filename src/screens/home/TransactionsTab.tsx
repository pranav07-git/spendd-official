import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { OutlineButton } from '../../components/Buttons';
import { ChevronLeftIcon, FilterIcon } from '../../components/Icons';
import { groupByDay, initialFor, matchesQuery, signedAmount, subtitleFor, titleFor } from '../../transactions/format';
import { importScreenshot, listTransactions } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';
import { colors, fonts } from '../../theme';

type Filter = 'all' | 'debit' | 'credit';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'debit', label: 'MONEY OUT' },
  { key: 'credit', label: 'MONEY IN' },
];

type Props = {
  onBack: () => void;
  onOpen: (transaction: Transaction) => void;
  onToast: (message: string) => void;
};

export function TransactionsTab({ onBack, onOpen, onToast }: Props) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const pendingRefreshes = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(async () => {
    try {
      setTransactions(await listTransactions());
    } catch {
      setTransactions([]);
    }
  }, []);

  // Screenshots are logged in the background, so reload whenever the user comes back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => state === 'active' && load());
    const timers = pendingRefreshes.current;
    return () => {
      sub.remove();
      timers.forEach(clearTimeout);
    };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addScreenshot = async () => {
    try {
      const [file] = await pick({ type: [types.images] });
      await importScreenshot(file.uri);
      onToast('Logging transaction…');
      // OCR runs in a background worker; check back shortly.
      pendingRefreshes.current.push(setTimeout(load, 2500), setTimeout(load, 6000));
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) {
        onToast('Couldn’t open that image');
      }
    }
  };

  const visible = (transactions ?? []).filter(
    tx => (filter === 'all' || tx.direction === filter) && matchesQuery(tx, query),
  );
  const sections = groupByDay(visible);
  const isEmpty = transactions !== null && transactions.length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to home" hitSlop={12} onPress={onBack}>
          <ChevronLeftIcon size={26} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Transactions
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter transactions"
          accessibilityState={{ expanded: showFilters }}
          hitSlop={12}
          onPress={() => setShowFilters(s => !s)}>
          <FilterIcon size={24} color={filter === 'all' ? colors.ink : colors.glow} strokeWidth={1.8} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={tx => tx.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} colors={[colors.background]} progressBackgroundColor={colors.ink} />
        }
        ListHeaderComponent={
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="SEARCH TRANSACTIONS"
              placeholderTextColor="#6B6B6B"
              style={[styles.search, query ? styles.searchFilled : null]}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search transactions"
            />
            {showFilters ? (
              <View style={styles.filters}>
                {FILTERS.map(f => (
                  <Pressable
                    key={f.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === f.key }}
                    onPress={() => setFilter(f.key)}
                    style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
                    <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>{f.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${titleFor(item)}, ${signedAmount(item)}, ${subtitleFor(item)}`}
            onPress={() => onOpen(item)}
            android_ripple={{ color: '#222222' }}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialFor(item)}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {titleFor(item)}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {item.needsReview ? 'NEEDS REVIEW • ' : ''}
                {subtitleFor(item).toUpperCase()}
              </Text>
            </View>
            {item.amount == null ? (
              <Text style={styles.rowAddAmount}>Add amount</Text>
            ) : (
              <Text style={styles.rowAmount}>{signedAmount(item)}</Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          isEmpty ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyText}>
                After paying in any UPI or bank app, tap Share on the payment screen and choose Spendd. We’ll read
                the amount, payee, date and time and log it here.
              </Text>
              <OutlineButton label="ADD A SCREENSHOT" onPress={addScreenshot} style={styles.emptyButton} />
            </View>
          ) : transactions !== null ? (
            <Text style={styles.noMatch}>No transactions match your search.</Text>
          ) : undefined
        }
        ListFooterComponent={
          transactions && transactions.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={addScreenshot} hitSlop={8} style={styles.footerAction}>
              <Text style={styles.footerActionText}>+ ADD A SCREENSHOT</Text>
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontFamily: fonts.serifBold, fontSize: 24, color: colors.ink },
  list: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 32 },
  search: {
    height: 54,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#8A8A8A',
    backgroundColor: colors.ink,
    paddingHorizontal: 22,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.background,
  },
  searchFilled: { fontFamily: fonts.sansMedium, fontSize: 15, letterSpacing: 0 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 14 },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.5, color: colors.inkMuted },
  filterLabelActive: { color: colors.background },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: colors.ink,
    marginTop: 32,
    marginBottom: 18,
  },
  row: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  rowPressed: { backgroundColor: '#1B1B1B' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.sansSemiBold, fontSize: 18, color: colors.ink },
  rowText: { flex: 1, marginLeft: 16, marginRight: 8 },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  rowSubtitle: { fontFamily: fonts.sans, fontSize: 12, color: colors.inkMuted, marginTop: 3 },
  rowAmount: { fontFamily: fonts.sansSemiBold, fontSize: 18, color: colors.ink },
  rowAddAmount: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.5, color: colors.glow },
  empty: { paddingTop: 48, alignItems: 'center' },
  emptyTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  emptyButton: { alignSelf: 'stretch', marginTop: 28 },
  noMatch: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkMuted, textAlign: 'center', marginTop: 40 },
  footerAction: { alignSelf: 'center', paddingVertical: 16, marginTop: 8 },
  footerActionText: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 2, color: colors.inkMuted },
});
