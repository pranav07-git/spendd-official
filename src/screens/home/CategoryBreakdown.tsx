import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { emojiFor } from '../../transactions/categories';
import { formatDayMonth, formatRupees, formatTime, titleFor } from '../../transactions/format';
import { paymentCount, type CategorySpend } from '../../transactions/summary';
import type { Transaction } from '../../transactions/types';
import { colors, fonts } from '../../theme';

function CategoryRow({
  item,
  expanded,
  first,
  showDates,
  onToggle,
  onOpen,
}: {
  item: CategorySpend;
  expanded: boolean;
  first: boolean;
  showDates: boolean;
  onToggle: () => void;
  onOpen: (transaction: Transaction) => void;
}) {
  const pct = Math.round(item.share * 100);
  return (
    <View style={!first && styles.divider}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.category}, ${formatRupees(item.amount)}, ${paymentCount(item.count)}, ${pct}% of the total`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        android_ripple={{ color: '#1A1A1A' }}
        style={styles.categoryRow}>
        <View style={styles.categoryTop}>
          <View style={styles.emojiTile}>
            <Text style={styles.emoji}>{emojiFor(item.category)}</Text>
          </View>
          <View style={styles.categoryText}>
            <Text style={styles.categoryTitle}>{item.category}</Text>
            <Text style={styles.categoryCaption}>
              {paymentCount(item.count).toUpperCase()} • {pct}%
            </Text>
          </View>
          <Text style={styles.categoryAmount}>{formatRupees(item.amount)}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.max(pct, 2)}%` }]} />
        </View>
      </Pressable>

      {expanded
        ? item.transactions.map(tx => (
            <Pressable
              key={tx.id}
              accessibilityRole="button"
              accessibilityLabel={`${titleFor(tx)}, ${formatRupees(tx.amount!)}`}
              onPress={() => onOpen(tx)}
              style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}>
              <View style={styles.txText}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {titleFor(tx)}
                </Text>
                <Text style={styles.txMeta} numberOfLines={1}>
                  {[tx.source, showDates ? formatDayMonth(tx.occurredAt) : null, tx.hasTime ? formatTime(tx.occurredAt) : null]
                    .filter(Boolean)
                    .join(' • ')
                    .toUpperCase()}
                </Text>
              </View>
              <Text style={styles.txAmount}>-{formatRupees(tx.amount!)}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

/** Spend per category with share bars; tap a category to list its payments. */
export function CategoryBreakdown({
  categories,
  showDates = false,
  onOpen,
}: {
  categories: CategorySpend[];
  /** Show each payment's date (for periods longer than a day). */
  showDates?: boolean;
  onOpen: (transaction: Transaction) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <View style={styles.card}>
      {categories.map((item, i) => (
        <CategoryRow
          key={item.category}
          item={item}
          first={i === 0}
          showDates={showDates}
          expanded={expanded === item.category}
          onToggle={() => setExpanded(e => (e === item.category ? null : item.category))}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    overflow: 'hidden',
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 18 },
  categoryTop: { flexDirection: 'row', alignItems: 'center' },
  emojiTile: {
    width: 40,
    height: 40,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  categoryText: { flex: 1, marginLeft: 16, marginRight: 8 },
  categoryTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  categoryCaption: { fontFamily: fonts.sans, fontSize: 11.5, letterSpacing: 0.4, color: colors.inkMuted, marginTop: 2 },
  categoryAmount: { fontFamily: fonts.sansSemiBold, fontSize: 18, color: colors.ink },
  track: { height: 6, backgroundColor: colors.track, marginTop: 14, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.ink },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#151515',
  },
  txRowPressed: { backgroundColor: '#1B1B1B' },
  txText: { flex: 1, marginRight: 8 },
  txTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.ink },
  txMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.inkMuted, marginTop: 2 },
  txAmount: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
});
