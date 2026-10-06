/**
 * App icons: Lucide (https://lucide.dev, ISC), drawn at a 1.75 px stroke.
 * Every icon takes `size`, `color` (defaults to the theme's ink) and `strokeWidth`.
 */
import type { ComponentType } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Banknote,
  Bell,
  BookOpen,
  Bot,
  ChartColumn,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  CircleX,
  Delete,
  FileCheck,
  FileUp,
  FingerprintPattern,
  Flame,
  House,
  Info,
  Lightbulb,
  ListFilter,
  Lock,
  Receipt,
  Search,
  ShoppingBag,
  Square,
  Trash,
  TriangleAlert,
  User,
  Utensils,
  Wallet,
  X,
  type LucideProps,
} from 'lucide-react-native';
import { useTheme, type Palette } from '../theme';

export type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Wraps a Lucide icon with the app's defaults: theme colour, 1.75 stroke. */
function themed(
  Icon: ComponentType<LucideProps>,
  defaults: { size?: number; strokeWidth?: number; tone?: (c: Palette) => string } = {},
) {
  return function ThemedIcon({ size = defaults.size ?? 24, color, strokeWidth = defaults.strokeWidth ?? 1.75 }: IconProps) {
    const { c } = useTheme();
    return <Icon size={size} color={color ?? defaults.tone?.(c) ?? c.ink} strokeWidth={strokeWidth} />;
  };
}

// Navigation & actions
export const ArrowLeftIcon = themed(ArrowLeft);
export const ArrowRightIcon = themed(ArrowRight);
export const ArrowDownIcon = themed(ArrowDown);
export const ArrowUpIcon = themed(ArrowUp);
export const ChevronLeftIcon = themed(ChevronLeft);
export const ChevronForwardIcon = themed(ChevronRight);
/** "See all"-style action arrow. */
export const ChevronRightIcon = themed(ArrowRight);
export const SearchIcon = themed(Search);
export const FilterIcon = themed(ListFilter);
export const BackspaceIcon = themed(Delete);
export const CrossIcon = themed(X, { size: 16, tone: c => c.inkSubtle });
export const CircleCrossIcon = themed(CircleX, { size: 20, tone: c => c.low });
export const TrashCrossIcon = themed(Trash);

// Tabs
export const WalletIcon = themed(Wallet);
export const ReceiptIcon = themed(Receipt);
export const HomeIcon = themed(House);
export const BarChartIcon = themed(ChartPie);
export const UserIcon = themed(User);

// Status & content
export const AccountIcon = themed(CircleUserRound, { tone: c => c.inkMuted });
export const BellIcon = themed(Bell);
export const LockIcon = themed(Lock);
export const ChartIcon = themed(ChartColumn);
export const BotIcon = themed(Bot);
export const AlertTriangleIcon = themed(TriangleAlert);
export const FlameIcon = themed(Flame);
export const InfoIcon = themed(Info);
export const BulbIcon = themed(Lightbulb);
export const BookIcon = themed(BookOpen);
export const BagIcon = themed(ShoppingBag);
export const ForkKnifeIcon = themed(Utensils);
export const CashIcon = themed(Banknote);
export const FileUploadIcon = themed(FileUp, { size: 28 });
export const FileCheckIcon = themed(FileCheck, { size: 28 });
export const CheckboxEmptyIcon = themed(Square, { size: 20, tone: c => c.inkSubtle });
export const FingerprintIcon = themed(FingerprintPattern, { strokeWidth: 1.5 });

/** Filled check box: reads as "on" at a glance, which an outline check doesn't. */
export function CheckboxCheckedIcon({ size = 20, color }: IconProps) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x={1} y={1} width={18} height={18} rx={5} fill={color ?? c.ink} />
      <Path d="M5.5 10.2l3 3 6-6.4" stroke={color ? '#FFFFFF' : c.onInk} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
