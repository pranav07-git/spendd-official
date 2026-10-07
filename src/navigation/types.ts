import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LegalDoc } from '../legal/documents';
import type { Insight } from '../insights/types';
import type { Transaction } from '../transactions/types';

export type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  SignUp: undefined;
  Consent: undefined;
  CreatePin: undefined;
  ConfirmPin: { pin: string };
  Biometric: undefined;
  Unlock: undefined;
  Home: undefined;
  /** All transactions on a page of their own, optionally with a search filled in. */
  Transactions: { query?: string } | undefined;
  /** Every insight, opened from Home's "See all". */
  Insights: { items: Insight[]; written: boolean };
  TransactionDetails: { transaction: Transaction };
  AddTransaction: undefined;
  /** Index into monthlyStory(): the month's categories, then income. */
  Story: { startIndex: number };
  SetBudget: undefined;
  EditProfile: undefined;
  ChangePin: undefined;
  /** The Privacy Policy or Terms of Use. */
  Legal: { doc: LegalDoc };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
