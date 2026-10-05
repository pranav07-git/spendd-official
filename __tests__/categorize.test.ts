import { planCategorization } from '../src/transactions/categorizePlan';
import { looksLikePerson, merchantQuery, payeeKeys } from '../src/transactions/merchants';
import type { Transaction } from '../src/transactions/types';

let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `c${n++}`,
  amount: 250,
  currency: 'INR',
  direction: 'debit',
  counterparty: 'Blinkit',
  handle: 'blinkit@hdfcbank',
  txnRef: null,
  bank: null,
  source: null,
  category: 'Personal',
  kind: 'personal',
  occurredAt: new Date(2026, 9, 5, 21, 30).getTime(),
  hasTime: true,
  dateFromReceipt: true,
  createdAt: 0,
  rawText: '',
  ...o,
});

test('people are recognised and never sent', () => {
  expect(looksLikePerson({ counterparty: 'Harshit Saini', handle: null })).toBe(true);
  expect(looksLikePerson({ counterparty: 'Rohit Joshi', handle: '9837738133@ptyes' })).toBe(true);
  expect(looksLikePerson({ counterparty: 'Blinkit', handle: 'blinkit@hdfcbank' })).toBe(false);
  expect(looksLikePerson({ counterparty: 'Apollo Pharmacy', handle: null })).toBe(false);
  expect(looksLikePerson({ counterparty: 'Sharma Kirana Store', handle: null })).toBe(false);
  expect(looksLikePerson({ counterparty: 'Third Wave Coffee', handle: null })).toBe(false);
  expect(merchantQuery(tx({ counterparty: 'Aditya Raj', handle: 'adityaraj7612@oksbi' }))).toBeNull();
});

test('merchant queries carry no dates or people', () => {
  expect(merchantQuery(tx({}))).toEqual({
    key: 'debit:upi:blinkit@hdfcbank',
    name: 'Blinkit',
    handle: 'blinkit@hdfcbank',
    amount: 250,
    hour: 21,
  });
});

test('payee keys use the UPI ID and the name, per direction', () => {
  expect(payeeKeys({ direction: 'debit', counterparty: 'Apollo  Pharmacy!', handle: 'XXXXXX8133' })).toEqual([
    'debit:name:apollo pharmacy',
  ]);
  expect(payeeKeys({ direction: 'credit', counterparty: 'Mom', handle: 'mom@okicici' })).toEqual([
    'credit:upi:mom@okicici',
    'credit:name:mom',
  ]);
});

test('memory first, then new merchants, never people or settled payments', () => {
  const remembered = tx({ counterparty: 'Chai Point', handle: 'chaipoint@ybl' });
  const repeat = tx({});
  const again = tx({});
  const person = tx({ counterparty: 'Ravi Kumar', handle: '9876543210@ybl' });
  const keyworded = tx({ counterparty: 'Swiggy', handle: 'swiggy@icici', category: 'Food', kind: 'merchant' });
  const confirmed = tx({ counterparty: 'Zara', handle: 'zara@axis', categoryConfirmed: true });
  const recentlyChecked = tx({ counterparty: 'Odd Shop', handle: 'oddshop@ybl', categoryCheckedAt: Date.now() - 1000 });
  const income = tx({ direction: 'credit', counterparty: 'Acme', handle: 'acme@hdfc' });

  const plan = planCategorization(
    [remembered, repeat, again, person, keyworded, confirmed, recentlyChecked, income],
    { 'debit:upi:chaipoint@ybl': { category: 'Food', source: 'user', at: 0 } },
  );
  expect(plan.fromMemory).toEqual([{ tx: remembered, category: 'Food' }]);
  // Blinkit is asked about once, for both payments.
  expect(plan.toAsk.map(a => [a.query.key, a.txs.length])).toEqual([['debit:upi:blinkit@hdfcbank', 2]]);
});

test('a remembered category also overrides the keyword guess', () => {
  const plan = planCategorization([tx({ counterparty: 'Swiggy', handle: 'swiggy@icici', category: 'Food' })], {
    'debit:upi:swiggy@icici': { category: 'Groceries', source: 'user', at: 0 },
  });
  expect(plan.fromMemory.map(m => m.category)).toEqual(['Groceries']);
});
