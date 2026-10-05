import type { Transaction } from './types';

// The first seven match what android/.../receipts/Classify.kt assigns to shared screenshots.
const SPENDING = [
  'Food',
  'Groceries',
  'Medical',
  'Travel',
  'Shopping',
  'Bills',
  'Rent',
  'Education',
  'Entertainment',
  'Personal',
  'Other',
];
const INCOME = ['Salary', 'Refund', 'Personal', 'Other'];

export const categoriesFor = (direction: Transaction['direction']): string[] =>
  direction === 'credit' ? INCOME : SPENDING;

/** "Personal" means money to or from a person; everything else is a merchant. */
export const kindFor = (category: string): Transaction['kind'] => (category === 'Personal' ? 'personal' : 'merchant');

const EMOJI: Record<string, string> = {
  Food: '🍔',
  Groceries: '🛒',
  Medical: '💊',
  Travel: '🚕',
  Shopping: '🛍️',
  Bills: '🧾',
  Rent: '🏠',
  Education: '📚',
  Entertainment: '🎬',
  Personal: '👤',
  Salary: '💼',
  Refund: '↩️',
};

export const emojiFor = (category: string) => EMOJI[category] ?? '💸';

export const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank transfer'];
