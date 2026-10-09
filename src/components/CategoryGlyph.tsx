import {
  ArrowUUpLeft,
  Basket,
  Briefcase,
  Car,
  DotsThree,
  FilmSlate,
  ForkKnife,
  GraduationCap,
  House,
  Money,
  Pill,
  Plant,
  Question,
  Receipt,
  ShoppingBag,
  User,
  Wallet,
  type Icon,
} from 'phosphor-react-native';
import { useTheme } from '../theme';
import { weightFor } from './Icons';

/** One Phosphor icon per category (and a few story card kinds). Unknown categories get "…". */
const ICONS: Record<string, Icon> = {
  Food: ForkKnife,
  Groceries: Basket,
  Medical: Pill,
  Travel: Car,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Rent: House,
  Education: GraduationCap,
  Entertainment: FilmSlate,
  Personal: User,
  Other: DotsThree,
  Salary: Briefcase,
  Refund: ArrowUUpLeft,
  Income: Money,
  Total: Wallet,
  Question: Question,
  Empty: Plant,
};

export function CategoryGlyph({
  category,
  size = 22,
  color,
  strokeWidth = 1.75,
}: {
  category: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { c } = useTheme();
  const Glyph = ICONS[category] ?? DotsThree;
  return <Glyph size={size} color={color ?? c.ink} weight={weightFor(strokeWidth)} />;
}
