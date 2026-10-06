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

const zomato = queries[0];
const q = (key: string, name: string | null, handle: string | null) => ({ key, name, handle, amount: 100, hour: 12 });

test('cache keeps only confident business answers and persists them', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'spendd-')), 'merchants.json');
  const cache = new MerchantCache(file);
  cache.put(zomato, { key: zomato.key, category: 'Food', confidence: 'high', isPerson: false });
  cache.put(q('debit:name:ravi', 'Ravi', null), { key: 'debit:name:ravi', category: 'Personal', confidence: 'high', isPerson: true });
  cache.put(q('debit:name:odd shop', 'Odd Shop', null), { key: 'debit:name:odd shop', category: 'Shopping', confidence: 'low', isPerson: false });
  assert.equal(cache.size, 1);
  // Shared across directions and users by what the model saw, answered under the asker's key.
  assert.deepEqual(cache.get({ ...zomato, key: 'credit:upi:zomato@hdfc' }), {
    key: 'credit:upi:zomato@hdfc',
    category: 'Food',
    confidence: 'high',
    isPerson: false,
  });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.ok(readFileSync(file, 'utf8').includes('zomato@hdfc|zomato'));
  assert.equal(new MerchantCache(file).get(zomato)?.category, 'Food');
});

test('a request cannot poison the cache for another merchant', () => {
  const cache = new MerchantCache(null);
  // Claims Zomato's key, but shows the model a pharmacy name.
  const forged = q('debit:upi:zomato@hdfc', 'Apollo Pharmacy', 'zomato@hdfc');
  cache.put(forged, { key: forged.key, category: 'Medical', confidence: 'high', isPerson: false });
  assert.equal(cache.get(zomato), null);
});

test('cached answers expire after 90 days', () => {
  let now = 0;
  const cache = new MerchantCache(null, () => now);
  cache.put(zomato, { key: zomato.key, category: 'Food', confidence: 'high', isPerson: false });
  now = 89 * 24 * 60 * 60_000;
  assert.equal(cache.get(zomato)?.category, 'Food');
  now = 91 * 24 * 60 * 60_000;
  assert.equal(cache.get(zomato), null);
});
