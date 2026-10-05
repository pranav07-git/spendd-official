import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import type { InsightsRequest } from './contract.ts';
import { UpstreamError } from './gemini.ts';
import { createApp } from './server.ts';

let server: Server;
let base = '';
let mode: 'ok' | 'upstream' = 'ok';
let received: InsightsRequest | null = null;
let modelCalls: string[][] = [];

before(async () => {
  server = createServer(
    createApp({
      appToken: 'secret',
      model: {
        insights: async request => {
          received = request;
          if (mode === 'upstream') throw new UpstreamError('quota', 429);
          return { insights: [], stories: [], model: 'fake' };
        },
        categorize: async queries => {
          modelCalls.push(queries.map(q => q.key));
          return queries.map(q =>
            q.name === 'Ravi Kumar'
              ? { key: q.key, category: 'Personal' as const, confidence: 'high' as const, isPerson: true }
              : { key: q.key, category: 'Groceries' as const, confidence: 'high' as const, isPerson: false },
          );
        },
      },
    }),
  );
  await new Promise<void>(resolve => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const post = (body: unknown, token = 'secret', path = '/v1/insights') =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-spendd-token': token },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const valid = { month: 'October 2026', facts: [{ parameter: 'savings_rate', summary: 'You saved ₹11,100.', values: { savings: 11100 } }] };

test('health check', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
});

test('valid request reaches the model', async () => {
  mode = 'ok';
  const res = await post(valid);
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { model: string }).model, 'fake');
  assert.equal(received?.facts[0].parameter, 'savings_rate');
});

test('rejects bad input, a wrong token and unknown routes', async () => {
  assert.equal((await post('{nope')).status, 400);
  assert.equal((await post({ month: 'x', facts: [] })).status, 400);
  assert.equal((await post(valid, 'wrong')).status, 401);
  assert.equal((await fetch(`${base}/v1/other`, { method: 'POST' })).status, 404);
});

test('model quota errors become 503 so the app retries later', async () => {
  mode = 'upstream';
  assert.equal((await post(valid)).status, 503);
});

test('categorize asks the model once per merchant and shares the answer', async () => {
  modelCalls = [];
  const merchants = [
    { key: 'debit:upi:blinkit@hdfcbank', name: 'Blinkit', handle: 'blinkit@hdfcbank', amount: 432, hour: 21 },
    { key: 'debit:name:ravi kumar', name: 'Ravi Kumar', handle: null, amount: 300, hour: 10 },
  ];
  const first = await (await post({ merchants }, 'secret', '/v1/categorize')).json() as { results: { key: string; cached: boolean }[] };
  assert.deepEqual(first.results.map(r => [r.key, r.cached]), [
    ['debit:upi:blinkit@hdfcbank', false],
    ['debit:name:ravi kumar', false],
  ]);
  // Another user later: Blinkit comes from the shared cache; the person was never cached.
  const second = await (await post({ merchants }, 'secret', '/v1/categorize')).json() as { results: { key: string; cached: boolean }[] };
  assert.deepEqual(second.results.map(r => [r.key, r.cached]), [
    ['debit:upi:blinkit@hdfcbank', true],
    ['debit:name:ravi kumar', false],
  ]);
  assert.deepEqual(modelCalls, [['debit:upi:blinkit@hdfcbank', 'debit:name:ravi kumar'], ['debit:name:ravi kumar']]);
});

test('categorize rejects bad input', async () => {
  assert.equal((await post({ merchants: [] }, 'secret', '/v1/categorize')).status, 400);
  assert.equal((await post({ merchants: [{ key: 'k' }] }, 'secret', '/v1/categorize')).status, 400);
  assert.equal((await post({ merchants: [{ key: 'k', name: 'A' }, { key: 'k', name: 'B' }] }, 'secret', '/v1/categorize')).status, 400);
});
