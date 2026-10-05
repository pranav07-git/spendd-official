import type { Transaction } from './types';

/** Words that mark a business rather than a person: "Apollo Pharmacy", "Sharma Traders". */
const BUSINESS = new RegExp(
  '\\b(pvt|private|ltd|limited|llp|inc|co|company|corp|store|stores|shop|mart|supermarket|kirana|traders?|' +
    'enterprises?|services?|solutions|technologies|tech|retail|foods?|restaurant|cafe|café|hotel|bakery|sweets|' +
    'pharmacy|medicals?|chemists?|clinic|hospital|labs?|diagnostics|petroleum|fuels?|petrol|motors|garage|' +
    'travels?|tours|bank|finance|insurance|recharge|electricity|broadband|telecom|airtel|jio|india|online|' +
    'designs|fashion|apparels|electronics|mobiles|books|academy|school|college|institute|gym|fitness|salon|' +
    'spa|studio|cinemas?|movies|entertainment|pay|payments|coffee|tea|chai|kitchen|biryani|dhaba|juice|bar|pub|' +
    'grill|bistro|canteen|mess|tiffin|dairy|fruits?|vegetables|meat|chicken|wines?|liquor|pizza|burger|momos|' +
    'cakes?|bakers|caterers|laundry|tailors?|opticals?|jewell?ers|hardware|paints|furniture)\\b',
  'i',
);

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A UPI ID that is just a phone number (or mostly digits) belongs to a person. */
const isPhoneHandle = (handle: string) => {
  const local = handle.split('@')[0];
  return /^\+?\d[\d.-]{7,}$/.test(local);
};

/** Masked account numbers ("XXXXXX8133") identify nobody and can't be learned from. */
const isMasked = (handle: string) => /^[x*•]{2,}\s?\d{3,4}$/i.test(handle.trim());

/**
 * Keys a payee is remembered by: its UPI ID when there is a usable one, and its name. Prefixed with
 * the direction so "Rohit" paying you and you paying "Rohit" are learned separately.
 */
export function payeeKeys(tx: Pick<Transaction, 'direction' | 'counterparty' | 'handle'>): string[] {
  const keys: string[] = [];
  if (tx.handle && tx.handle.includes('@') && !isMasked(tx.handle)) {
    keys.push(`${tx.direction}:upi:${tx.handle.trim().toLowerCase()}`);
  }
  if (tx.counterparty) {
    const name = normalise(tx.counterparty);
    if (name.length >= 2) {
      keys.push(`${tx.direction}:name:${name}`);
    }
  }
  return keys;
}

/**
 * Whether the payee looks like a person. People's names never leave the phone, and only the user
 * can say what a payment to a person was for, so these go to the story's question instead.
 */
export function looksLikePerson(tx: Pick<Transaction, 'counterparty' | 'handle'>): boolean {
  if (tx.handle && tx.handle.includes('@') && isPhoneHandle(tx.handle)) {
    return true;
  }
  const name = tx.counterparty?.trim();
  if (!name) {
    return !tx.handle; // nothing to go on
  }
  if (BUSINESS.test(name) || /\d/.test(name)) {
    return false;
  }
  // Two or three plain words ("Harshit Saini", "Aditya Kumar Raj") read as a person's name.
  const words = name.split(/\s+/);
  return words.length >= 2 && words.length <= 3 && words.every(w => /^[a-z.'-]+$/i.test(w));
}

/** What the server is told about a merchant: no amounts to the paisa, no dates, no people. */
export type MerchantQuery = { key: string; name: string | null; handle: string | null; amount: number | null; hour: number | null };

export function merchantQuery(tx: Transaction): MerchantQuery | null {
  if (looksLikePerson(tx)) {
    return null;
  }
  const key = payeeKeys(tx)[0];
  if (!key) {
    return null;
  }
  const handle = tx.handle && tx.handle.includes('@') && !isMasked(tx.handle) ? tx.handle.trim().toLowerCase() : null;
  return {
    key,
    name: tx.counterparty?.trim() || null,
    handle,
    amount: tx.amount != null ? Math.round(tx.amount) : null,
    hour: tx.hasTime ? new Date(tx.occurredAt).getHours() : null,
  };
}
