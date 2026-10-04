import { Pressable, StyleSheet, View } from 'react-native';
import { BarChartIcon, HomeIcon, ReceiptIcon, UserIcon, WalletIcon } from '../../components/Icons';
import { colors } from '../../theme';

export type TabKey = 'accounts' | 'transactions' | 'home' | 'insights' | 'profile';

export const TABS: { key: TabKey; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'accounts', label: 'Accounts', Icon: WalletIcon },
  { key: 'transactions', label: 'Transactions', Icon: ReceiptIcon },
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'insights', label: 'Insights', Icon: BarChartIcon },
  { key: 'profile', label: 'Profile', Icon: UserIcon },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map(({ key, label, Icon }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={styles.item}>
            {({ pressed }) => (
              <View style={[styles.iconBox, selected && styles.iconBoxActive, pressed && !selected && styles.iconBoxPressed]}>
                <Icon size={22} color={selected ? colors.background : colors.inkMuted} strokeWidth={1.7} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 88,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBox: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  iconBoxActive: { backgroundColor: colors.ink },
  iconBoxPressed: { backgroundColor: colors.card },
});
