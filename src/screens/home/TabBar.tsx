import { Pressable, Text, View } from 'react-native';
import { BarChartIcon, HomeIcon, ReceiptIcon, UserIcon, WalletIcon } from '../../components/Icons';
import { elevation, makeStyles, radius, space, type, useTheme } from '../../theme';

export type TabKey = 'accounts' | 'transactions' | 'home' | 'insights' | 'profile';

export const TABS: { key: TabKey; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'accounts', label: 'Accounts', Icon: WalletIcon },
  { key: 'transactions', label: 'Transactions', Icon: ReceiptIcon },
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'insights', label: 'My Money', Icon: BarChartIcon },
  { key: 'profile', label: 'Profile', Icon: UserIcon },
];

const BAR_HEIGHT = 68;
const BAR_GAP = space[3];
/** Bottom padding a tab's scrolling content needs so its end isn't hidden behind the floating bar. */
export const TAB_BAR_CLEARANCE = BAR_HEIGHT + BAR_GAP + space[6];

/** Floating charcoal pill tab bar (docs/DESIGN.md level-2 lift). Active tab: white icon and label; the rest grey. */
export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View style={[s.bar, elevation(2)]} accessibilityRole="tablist">
      {TABS.map(({ key, label, Icon }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={s.item}>
            {({ pressed }) => (
              <>
                <View style={[s.pill, pressed && s.pillPressed]}>
                  <Icon size={22} color={selected ? c.ink : c.inkMuted} strokeWidth={selected ? 2 : 1.75} />
                </View>
                <Text style={[s.label, selected && s.labelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  bar: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    bottom: BAR_GAP,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    overflow: 'hidden',
    // One step above the cards (surface-2) so it reads as floating over them.
    backgroundColor: c.surfaceSunken,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' },
  pill: { width: 52, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillPressed: { backgroundColor: c.surfaceSunken },
  label: { ...type.caption, fontSize: 11, lineHeight: 14, letterSpacing: -0.1, color: c.inkMuted },
  labelActive: { color: c.ink },
}));
