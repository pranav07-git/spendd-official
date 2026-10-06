import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TabKey } from '../screens/home/TabBar';
import type { Transaction } from '../transactions/types';

export type RootStackParamList = {
  Intro: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Consent: undefined;
  CreatePin: undefined;
  ConfirmPin: { pin: string };
  Biometric: undefined;
  Unlock: undefined;
  /** Optionally opens a tab, with a search filled in on Transactions. */
  Home: { tab?: TabKey; query?: string } | undefined;
  TransactionDetails: { transaction: Transaction };
  AddTransaction: undefined;
  /** Index into monthlyStory(): the month's categories, then income, then payments to place. */
  Story: { startIndex: number };
  SetBudget: undefined;
  EditProfile: undefined;
  ChangePin: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
