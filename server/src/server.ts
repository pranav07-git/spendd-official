import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { MerchantCache, parseCategorizeRequest, type MerchantAnswer, type MerchantQuery } from './categorize.ts';
import { BadRequest, parseRequest, type InsightsRequest, type InsightsResponse } from './contract.ts';
import { createGenerator, MODEL, UpstreamError } from './gemini.ts';

const MAX_BODY = 32 * 1024;
const RATE = { requests: 30, windowMs: 10 * 60_000 };

type Model = {
  insights: (request: InsightsRequest) => Promise<InsightsResponse>;
  categorize: (queries: MerchantQuery[]) => Promise<MerchantAnswer[]>;
};

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) {
      throw new BadRequest('Body too large');
    }
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('Body must be valid JSON');
  }
}

/** Constant-time comparison, so response timing says nothing about how much of a guess was right. */
export function tokenMatches(given: string | string[] | undefined, expected: string): boolean {
  if (typeof given !== 'string') {
    return false;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fixed-window limit per client address; enough to stop a runaway loop or casual abuse. */
function rateLimiter() {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();
  return (key: string): boolean => {
    const now = Date.now();
    // Forget expired windows now and then, so many addresses can't grow the map for ever.
    if (now - lastSweep > RATE.windowMs) {
      lastSweep = now;
      hits.forEach((entry, k) => now >= entry.resetAt && hits.delete(k));
    }
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + RATE.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= RATE.requests;
  };
}

export function createApp({ model, appToken, cache = new MerchantCache(null) }: { model: Model; appToken?: string; cache?: MerchantCache }) {
  const allow = rateLimiter();

  /** Shared answers first; only merchants nobody has asked about reach the model. */
  async function categorize(queries: MerchantQuery[]) {
    const known = queries.map(q => cache.get(q)).filter((a): a is MerchantAnswer => a !== null);
    const unknown = queries.filter(q => !cache.get(q));
    const fresh = unknown.length > 0 ? await model.categorize(unknown) : [];
    const asked = new Map(unknown.map(q => [q.key, q]));
    fresh.forEach(answer => cache.put(asked.get(answer.key)!, answer));
    return {
      results: [...known.map(a => ({ ...a, cached: true })), ...fresh.map(a => ({ ...a, cached: false }))],
      model: MODEL,
    };
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return send(res, 200, { ok: true, model: MODEL });
      }
      const route = req.method === 'POST' ? req.url : null;
      if (route !== '/v1/insights' && route !== '/v1/categorize') {
        return send(res, 404, { error: 'not_found' });
      }
      if (appToken && !tokenMatches(req.headers['x-spendd-token'], appToken)) {
        return send(res, 401, { error: 'unauthorized' });
      }
      if (!allow(req.socket.remoteAddress ?? 'unknown')) {
        return send(res, 429, { error: 'rate_limited' });
      }
      const body = await readJson(req);
      if (route === '/v1/categorize') {
        return send(res, 200, await categorize(parseCategorizeRequest(body)));
      }
      return send(res, 200, await model.insights(parseRequest(body)));
    } catch (e) {
      if (e instanceof BadRequest) {
        return send(res, 400, { error: 'bad_request', message: e.message });
      }
      if (e instanceof UpstreamError) {
        console.error(e.message);
        return send(res, e.status === 429 ? 503 : 502, { error: 'model_unavailable' });
      }
      console.error(e);
      return send(res, 500, { error: 'internal' });
    }
  };
}

if (import.meta.main) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Set GEMINI_API_KEY (see .env.example).');
    process.exit(1);
  }
  const appToken = process.env.SPENDD_APP_TOKEN || undefined;
  // Without a token anyone who can reach the server gets a Gemini proxy on your key.
  if (!appToken && process.env.SPENDD_ALLOW_NO_TOKEN !== '1') {
    console.error('Set SPENDD_APP_TOKEN (see .env.example), or SPENDD_ALLOW_NO_TOKEN=1 for local testing only.');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8787);
  // This Mac only by default (the phone reaches it through adb reverse). Set HOST=0.0.0.0 when
  // deploying behind HTTPS.
  const host = process.env.HOST ?? '127.0.0.1';
  const cache = new MerchantCache(new URL('../data/merchants.json', import.meta.url).pathname);
  createServer(createApp({ model: createGenerator(apiKey), appToken, cache })).listen(port, host, () =>
    console.log(`Spendd insights API on http://${host}:${port} (${MODEL}, ${cache.size} merchants cached)`),
  );
}
