/** Mirrors the JSON written by android/.../receipts/ReceiptWorker.kt */
export type Transaction = {
  id: string;
  /** null when OCR couldn't read it; the entry is then flagged needsReview. */
  amount: number | null;
  currency: 'INR';
  direction: 'debit' | 'credit';
  counterparty: string | null;
  handle: string | null;
  txnRef: string | null;
  bank: string | null;
  source: string | null;
  category: string;
  kind: 'merchant' | 'personal';
  occurredAt: number;
  hasTime: boolean;
  dateFromReceipt: boolean;
  needsReview?: boolean;
  /** Entered by hand on the Add Transaction screen rather than read from a screenshot. */
  manual?: boolean;
  note?: string | null;
  /** Set once the user has answered "what was this payment for?" so the story stops asking. */
  categoryConfirmed?: boolean;
  /** Who set the category: the keyword rules at logging time, the user, the user's past choice, or Spendd AI. */
  categorySource?: 'rules' | 'user' | 'memory' | 'ai';
  /** When Spendd AI was asked about this payee and couldn't place it, so it isn't asked again. */
  categoryCheckedAt?: number;
  createdAt: number;
  rawText: string;
};
