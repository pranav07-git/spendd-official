import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MerchantCache, vetAnswers } from './categorize.ts';

const queries = [{ key: 'debit:upi:zomato@hdfc', name: 'Zomato', handle: 'zomato@hdfc', amount: 400, hour: 21 }];

test('drops answers for merchants not asked about or with unknown categories', () => {
  const vetted = vetAnswers(
    {
      results: [
        { key: 'debit:upi:zomato@hdfc', category: 'Food', confidence: 'high', isPerson: false },
        { key: 'debit:upi:zomato@hdfc', category: 'Travel', confidence: 'high', isPerson: false },
        { key: 'debit:upi:other@ybl', category: 'Food', confidence: 'high', isPerson: false },
        { key: 'debit:upi:zomato@hdfc', category: 'Snacks', confidence: 'high', isPerson: false },
      ],
    },
    queries,
  );
  assert.deepEqual(vetted, [{ key: 'debit:upi:zomato@hdfc', category: 'Food', confidence: 'high', isPerson: false }]);
  assert.deepEqual(vetAnswers('junk', queries), []);
});

test('cache keeps only confident business answers and persists them', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'spendd-')), 'merchants.json');
  const cache = new MerchantCache(file);
  cache.put({ key: 'debit:upi:zomato@hdfc', category: 'Food', confidence: 'high', isPerson: false });
  cache.put({ key: 'debit:name:ravi', category: 'Personal', confidence: 'high', isPerson: true });
  cache.put({ key: 'debit:name:odd shop', category: 'Shopping', confidence: 'low', isPerson: false });
  assert.equal(cache.size, 1);
  // Shared across directions/users by merchant identity.
  assert.equal(cache.get('credit:upi:zomato@hdfc')?.category, 'Food');
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.ok(readFileSync(file, 'utf8').includes('upi:zomato@hdfc'));
  assert.equal(new MerchantCache(file).get('debit:upi:zomato@hdfc')?.category, 'Food');
});
