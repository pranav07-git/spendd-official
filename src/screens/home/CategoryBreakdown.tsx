import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card } from '../../components/Layout';
import { formatDayMonth, formatRupees, formatTime, titleFor } from '../../transactions/format';
import { paymentCount, type CategorySpend } from '../../transactions/summary';
import type { Transaction } from '../../transactions/types';
import { jarColorFor, makeStyles, radius, space, type, useTheme } from '../../theme';
import { CategoryGlyph } from '../../components/CategoryGlyph';

function CategoryRow({
  item,
  tint,
  expanded,
  first,
  showDates,
  onToggle,
  onOpen,
}: {
  item: CategorySpend;
  /** Jar colour for the category tile. */
  tint: string;
  expanded: boolean;
  first: boolean;
  showDates: boolean;
  onToggle: () => void;
  onOpen: (transaction: Transaction) => void;
}) {
  const s = useStyles();
  const { c } = useTheme();
  const pct = Math.round(item.share * 100);
  return (
    <View style={!first && s.divider}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.category}, ${formatRupees(item.amount)}, ${paymentCount(item.count)}, ${pct}% of the total`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        android_ripple={{ color: c.surfaceSunken }}
        style={s.categoryRow}>
        <View style={s.categoryTop}>
          <View style={[s.emojiTile, { backgroundColor: tint }]}>
            <CategoryGlyph category={item.category} size={20} />
          </View>
          <View style={s.categoryText}>
            <Text style={s.categoryTitle} numberOfLines={1}>
              {item.category}
            </Text>
            <Text style={s.caption}>
              {paymentCount(item.count)} · {pct}%
            </Text>
          </View>
          <Text style={s.amount}>{formatRupees(item.amount)}</Text>
        </View>
        <View style={s.track}>
          <View style={[s.trackFill, { width: `${Math.max(pct, 2)}%` }]} />
        </View>
      </Pressable>

      {expanded
        ? item.transactions.map((tx, i) => (
            <Pressable
              key={tx.id}
              accessibilityRole="button"
              accessibilityLabel={`${titleFor(tx)}, ${formatRupees(tx.amount!)}`}
              onPress={() => onOpen(tx)}
              style={({ pressed }) => [
                s.txRow,
                i === 0 && s.txFirst,
                i === item.transactions.length - 1 && s.txLast,
                i > 0 && s.txDivider,
                pressed && s.txRowPressed,
              ]}>
              <View style={s.txText}>
                <Text style={s.txTitle} numberOfLines={1}>
                  {titleFor(tx)}
                </Text>
                <Text style={s.caption} numberOfLines={1}>
                  {[tx.source, showDates ? formatDayMonth(tx.occurredAt) : null, tx.hasTime ? formatTime(tx.occurredAt) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={s.amount}>-{formatRupees(tx.amount!)}</Text>
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
  const { c } = useTheme();
  return (
    <Card padded={false}>
      {categories.map((item, i) => (
        <CategoryRow
          key={item.category}
          item={item}
          tint={jarColorFor(item.category, c)}
          first={i === 0}
          showDates={showDates}
          expanded={expanded === item.category}
          onToggle={() => setExpanded(e => (e === item.category ? null : item.category))}
          onOpen={onOpen}
        />
      ))}
    </Card>
  );
}

const useStyles = makeStyles(c => ({
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  categoryRow: { padding: space[4] },
  categoryTop: { flexDirection: 'row', alignItems: 'center' },
  emojiTile: {
    width: 40,
    height: 40,
    borderRadius: radius.s + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { flex: 1, marginLeft: space[3], marginRight: space[2] },
  categoryTitle: { ...type.bodyStrong, color: c.ink },
  caption: { ...type.caption, color: c.inkMuted },
  amount: { ...type.amount, color: c.ink },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSunken,
    marginTop: space[3],
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.inkMuted },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    marginHorizontal: space[4],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: c.surfaceSunken,
  },
  txFirst: { borderTopLeftRadius: radius.m, borderTopRightRadius: radius.m },
  txLast: { borderBottomLeftRadius: radius.m, borderBottomRightRadius: radius.m, marginBottom: space[4] },
  txDivider: { borderTopWidth: 1, borderTopColor: c.line },
  txRowPressed: { backgroundColor: c.line },
  txText: { flex: 1, marginRight: space[2] },
  txTitle: { ...type.label, color: c.ink },
}));
