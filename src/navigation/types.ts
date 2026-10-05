import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Transaction } from '../transactions/types';

export type PickedStatement = {
  uri: string;
  name: string;
  size: number | null;
  type: string | null;
};

export type RootStackParamList = {
  Intro: undefined;
  Statement: undefined;
  Consent: { statement: PickedStatement | null };
  CreatePin: undefined;
  ConfirmPin: { pin: string };
  Biometric: undefined;
  Unlock: undefined;
  Home: undefined;
  TransactionDetails: { transaction: Transaction };
  AddTransaction: undefined;
  /** Index into todaysStory(): 0 is the day's total, then one per category. */
  Story: { startIndex: number };
  SetBudget: undefined;
  EditProfile: undefined;
  ChangePin: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
