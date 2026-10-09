/**
 * App icons: Phosphor (https://phosphoricons.com, MIT).
 * Every icon takes `size`, `color` (defaults to the theme's ink), and either a `weight` or a
 * `strokeWidth`, which is mapped onto Phosphor's weights (light / regular / bold).
 */
import Svg, { Path, Rect } from 'react-native-svg';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Backspace,
  BookOpen,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChartPieSlice,
  CheckCircle,
  FileArrowUp,
  Fingerprint,
  Flame,
  ForkKnife,
  FunnelSimple,
  House,
  Info,
  Lightbulb,
  Lock,
  MagnifyingGlass,
  Money,
  Receipt,
  ShoppingBag,
  Sparkle,
  Square,
  Trash,
  User,
  UserCircle,
  Wallet,
  Warning,
  X,
  XCircle,
  type Icon as PhosphorIcon,
  type IconWeight,
} from 'phosphor-react-native';
import { useTheme, type Palette } from '../theme';

export type IconProps = { size?: number; color?: string; strokeWidth?: number; weight?: IconWeight };

/** Lucide-style stroke widths (callers still pass them) → the nearest Phosphor weight. */
export function weightFor(strokeWidth: number): IconWeight {
  if (strokeWidth <= 1.6) {
    return 'light';
  }
  return strokeWidth <= 2 ? 'regular' : 'bold';
}

/** Wraps a Phosphor icon with the app's defaults: theme colour, regular weight. */
function themed(
  Icon: PhosphorIcon,
  defaults: { size?: number; strokeWidth?: number; tone?: (c: Palette) => string } = {},
) {
  return function ThemedIcon({ size = defaults.size ?? 24, color, strokeWidth = defaults.strokeWidth ?? 1.75, weight }: IconProps) {
    const { c } = useTheme();
    return <Icon size={size} color={color ?? defaults.tone?.(c) ?? c.ink} weight={weight ?? weightFor(strokeWidth)} />;
  };
}

// Navigation & actions
export const ArrowLeftIcon = themed(ArrowLeft);
export const ArrowRightIcon = themed(ArrowRight);
export const ArrowDownIcon = themed(ArrowDown);
export const ArrowUpIcon = themed(ArrowUp);
export const ChevronLeftIcon = themed(CaretLeft);
export const ChevronForwardIcon = themed(CaretRight);
/** "See all"-style action arrow. */
export const ChevronRightIcon = themed(ArrowRight);
export const SearchIcon = themed(MagnifyingGlass);
export const FilterIcon = themed(FunnelSimple);
export const BackspaceIcon = themed(Backspace);
export const CrossIcon = themed(X, { size: 16, tone: c => c.inkSubtle });
export const CircleCrossIcon = themed(XCircle, { size: 20, tone: c => c.low });
export const TrashCrossIcon = themed(Trash);

// Tabs
export const WalletIcon = themed(Wallet);
export const ReceiptIcon = themed(Receipt);
export const HomeIcon = themed(House);
export const BarChartIcon = themed(ChartPieSlice);
export const UserIcon = themed(User);

// Status & content
export const AccountIcon = themed(UserCircle, { tone: c => c.inkMuted });
export const LockIcon = themed(Lock);
export const ChartIcon = themed(ChartBar);
/** Marks what the AI (Gemini) wrote. */
export const BotIcon = themed(Sparkle);
export const AlertTriangleIcon = themed(Warning);
export const FlameIcon = themed(Flame);
export const InfoIcon = themed(Info);
export const BulbIcon = themed(Lightbulb);
export const BookIcon = themed(BookOpen);
export const BagIcon = themed(ShoppingBag);
export const ForkKnifeIcon = themed(ForkKnife);
export const CashIcon = themed(Money);
export const FileUploadIcon = themed(FileArrowUp, { size: 28 });
export const FileCheckIcon = themed(CheckCircle, { size: 28 });
export const CheckboxEmptyIcon = themed(Square, { size: 20, tone: c => c.inkSubtle });
export const FingerprintIcon = themed(Fingerprint, { strokeWidth: 1.5 });

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
