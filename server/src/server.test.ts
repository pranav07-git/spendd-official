import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { signToken, UserStore } from './auth.ts';
import type { InsightsRequest } from './contract.ts';
import { UpstreamError } from './gemini.ts';
import { createApp, startKeepAlive } from './server.ts';

let server: Server;
let base = '';
let mode: 'ok' | 'upstream' = 'ok';
let received: InsightsRequest | null = null;
let modelCalls: string[][] = [];
let token = '';
const JWT_SECRET = 'test-secret-that-is-at-least-32-chars';

before(async () => {
  server = createServer(
    createApp({
      users: await UserStore.open(null),
      jwtSecret: JWT_SECRET,
      clientIpHeader: 'cf-connecting-ip',
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
  token = ((await (await auth('signup', { name: 'Asha  Verma', email: 'Asha@Example.com', password: 'correct horse' })).json()) as { token: string }).token;
});
after(() => server.close());

const auth = (action: 'signup' | 'login', body: unknown) =>
  fetch(`${base}/v1/auth/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const post = (body: unknown, bearer = token, path = '/v1/insights') =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
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
  assert.equal((await fetch(`${base}/v1/insights`, { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await fetch(`${base}/v1/other`, { method: 'POST' })).status, 404);
});

test('sign-in works with the same email in any case, and only with the right password', async () => {
  const ok = await auth('login', { email: ' asha@example.com ', password: 'correct horse' });
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { token: string; user: { email: string; name: string } };
  assert.equal(body.user.email, 'asha@example.com');
  // The name given at sign-up comes back on every sign-in, so a new phone can greet the user.
  assert.equal(body.user.name, 'Asha Verma');
  assert.equal((await post(valid, body.token)).status, 200);
  assert.equal((await auth('login', { email: 'asha@example.com', password: 'wrong horse' })).status, 401);
  assert.equal((await auth('login', { email: 'nobody@example.com', password: 'correct horse' })).status, 401);
});

test('sign-in attempts are limited per client address from the host header', async () => {
  const attempt = (ip: string) =>
    fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong horse' }),
    });
  for (let i = 0; i < 10; i++) {
    assert.equal((await attempt('203.0.113.9')).status, 401);
  }
  assert.equal((await attempt('203.0.113.9')).status, 429);
  assert.equal((await attempt('198.51.100.4')).status, 401);
});

test('sign-up rejects a taken email, a bad email and a short password', async () => {
  assert.equal((await auth('signup', { name: 'Asha', email: 'asha@example.com', password: 'another one' })).status, 409);
  assert.equal((await auth('signup', { name: 'New', email: 'not-an-email', password: 'long enough' })).status, 400);
  assert.equal((await auth('signup', { name: 'New', email: 'new@example.com', password: 'short' })).status, 400);
  assert.equal((await auth('signup', { name: '   ', email: 'new@example.com', password: 'long enough' })).status, 400);
  // The 1.0 app sends no name; it can still sign up, and has none.
  const old = await auth('signup', { email: 'old-app@example.com', password: 'long enough' });
  assert.equal(old.status, 201);
  assert.equal(((await old.json()) as { user: { name: string | null } }).user.name, null);
});

test('tokens: refresh gives a new one; forged, expired and unknown-account tokens are refused', async () => {
  const refreshed = await fetch(`${base}/v1/auth/refresh`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
  assert.equal(refreshed.status, 200);
  const [, payload] = token.split('.');
  const forged = signToken({ id: 'someone', email: 'x@y.z' }, 'a-different-secret-that-is-long-enough');
  const expired = signToken({ id: JSON.parse(Buffer.from(payload, 'base64url').toString()).sub, email: 'asha@example.com' }, JWT_SECRET, Date.now() - 31 * 86_400_000);
  const ghost = signToken({ id: 'deleted-account', email: 'gone@example.com' }, JWT_SECRET);
  for (const bad of [forged, expired, ghost, `${token}x`]) {
    assert.equal((await post(valid, bad)).status, 401);
  }
});

test('keep-alive requests /health on the public URL', async () => {
  let hits = 0;
  const counter = createServer((req, res) => {
    hits += req.url === '/health' ? 1 : 0;
    res.end('{}');
  });
  await new Promise<void>(resolve => counter.listen(0, resolve));
  const stop = startKeepAlive(`http://127.0.0.1:${(counter.address() as AddressInfo).port}/`, 20);
  await new Promise(resolve => setTimeout(resolve, 110));
  stop();
  counter.close();
  assert.ok(hits >= 3, `expected several pings, got ${hits}`);
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
  const first = await (await post({ merchants }, token, '/v1/categorize')).json() as { results: { key: string; cached: boolean }[] };
  assert.deepEqual(first.results.map(r => [r.key, r.cached]), [
    ['debit:upi:blinkit@hdfcbank', false],
    ['debit:name:ravi kumar', false],
  ]);
  // Another user later: Blinkit comes from the shared cache; the person was never cached.
  const second = await (await post({ merchants }, token, '/v1/categorize')).json() as { results: { key: string; cached: boolean }[] };
  assert.deepEqual(second.results.map(r => [r.key, r.cached]), [
    ['debit:upi:blinkit@hdfcbank', true],
    ['debit:name:ravi kumar', false],
  ]);
  assert.deepEqual(modelCalls, [['debit:upi:blinkit@hdfcbank', 'debit:name:ravi kumar'], ['debit:name:ravi kumar']]);
});

test('categorize rejects bad input', async () => {
  assert.equal((await post({ merchants: [] }, token, '/v1/categorize')).status, 400);
  assert.equal((await post({ merchants: [{ key: 'k' }] }, token, '/v1/categorize')).status, 400);
  assert.equal((await post({ merchants: [{ key: 'k', name: 'A' }, { key: 'k', name: 'B' }] }, token, '/v1/categorize')).status, 400);
});
