import type { ComponentType } from 'react';
import {
  Banknote,
  Briefcase,
  Car,
  CircleQuestionMark,
  Clapperboard,
  Ellipsis,
  GraduationCap,
  House,
  Pill,
  Receipt,
  ShoppingBag,
  ShoppingBasket,
  Sprout,
  Undo2,
  User,
  Utensils,
  Wallet,
  type LucideProps,
} from 'lucide-react-native';
import { useTheme } from '../theme';

/** One Lucide icon per category (and a few story card kinds). Unknown categories get "…". */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  Food: Utensils,
  Groceries: ShoppingBasket,
  Medical: Pill,
  Travel: Car,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Rent: House,
  Education: GraduationCap,
  Entertainment: Clapperboard,
  Personal: User,
  Other: Ellipsis,
  Salary: Briefcase,
  Refund: Undo2,
  Income: Banknote,
  Total: Wallet,
  Question: CircleQuestionMark,
  Empty: Sprout,
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
  const Icon = ICONS[category] ?? Ellipsis;
  return <Icon size={size} color={color ?? c.ink} strokeWidth={strokeWidth} />;
}
