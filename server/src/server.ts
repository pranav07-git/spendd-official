import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { AuthError, bearerToken, parseCredentials, parseName, publicUser, signToken, TOKEN_TTL_S, UserStore, verifyToken, type User } from './auth.ts';
import { MerchantCache, parseCategorizeRequest, type MerchantAnswer, type MerchantQuery } from './categorize.ts';
import { BadRequest, parseRequest, type InsightsRequest, type InsightsResponse } from './contract.ts';
import { createGenerator, MODEL, UpstreamError } from './gemini.ts';

const MAX_BODY = 32 * 1024;
const RATE = { requests: 30, windowMs: 10 * 60_000 };
/** Sign-up and sign-in attempts per address per window; slows down password guessing. */
const AUTH_RATE = { requests: 10, windowMs: 10 * 60_000 };

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

/** Fixed-window limit per client address; enough to stop a runaway loop or casual abuse. */
function rateLimiter(rate: { requests: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();
  return (key: string): boolean => {
    const now = Date.now();
    // Forget expired windows now and then, so many addresses can't grow the map for ever.
    if (now - lastSweep > rate.windowMs) {
      lastSweep = now;
      hits.forEach((entry, k) => now >= entry.resetAt && hits.delete(k));
    }
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + rate.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= rate.requests;
  };
}

type Options = {
  model: Model;
  users: UserStore;
  /** Signs and checks session tokens (JWT, HS256). */
  jwtSecret: string;
  cache?: MerchantCache;
  /** Behind a reverse proxy (Caddy, a load balancer): the client's address comes from X-Forwarded-For. */
  trustProxy?: boolean;
  /** A header the host sets to the client's address and callers can't forge (Render: cf-connecting-ip). */
  clientIpHeader?: string;
};

export function createApp({ model, users, jwtSecret, cache = new MerchantCache(null), trustProxy = false, clientIpHeader }: Options) {
  const allow = rateLimiter(RATE);
  const allowAuth = rateLimiter(AUTH_RATE);

  /** The last address in X-Forwarded-For is the one our own proxy saw, so the client can't fake it. */
  function clientAddress(req: IncomingMessage): string {
    const fromHost = clientIpHeader ? req.headers[clientIpHeader.toLowerCase()] : undefined;
    if (typeof fromHost === 'string' && fromHost) {
      return fromHost.trim();
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (trustProxy && typeof forwarded === 'string') {
      return forwarded.split(',').pop()!.trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  /** The signed-in account behind a request's bearer token, or null. */
  function currentUser(req: IncomingMessage): User | null {
    const token = bearerToken(req.headers.authorization);
    const claims = token ? verifyToken(token, jwtSecret) : null;
    return claims ? users.getById(claims.sub) : null;
  }

  const session = (user: User) => {
    const now = Date.now();
    return { token: signToken(publicUser(user), jwtSecret, now), expiresAt: now + TOKEN_TTL_S * 1000, user: publicUser(user) };
  };

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

      if (route === '/v1/auth/signup' || route === '/v1/auth/login') {
        if (!allowAuth(clientAddress(req))) {
          return send(res, 429, { error: 'rate_limited' });
        }
        const body = await readJson(req);
        const { email, password } = parseCredentials(body);
        if (route === '/v1/auth/signup') {
          return send(res, 201, session(await users.create(email, password, parseName(body))));
        }
        return send(res, 200, session(await users.authenticate(email, password)));
      }

      if (route !== '/v1/auth/refresh' && route !== '/v1/insights' && route !== '/v1/categorize') {
        return send(res, 404, { error: 'not_found' });
      }
      const user = currentUser(req);
      if (!user) {
        return send(res, 401, { error: 'unauthorized' });
      }
      if (route === '/v1/auth/refresh') {
        return send(res, 200, session(user));
      }
      if (!allow(user.id)) {
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
      if (e instanceof AuthError) {
        return send(res, e.status, { error: e.code });
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

/** Pings come this often; Render's free plan sleeps after 15 minutes without inbound requests. */
export const KEEP_ALIVE_MS = 10 * 60_000;

/**
 * Requests this server's own /health through its public URL now and then, so the host sees traffic
 * and doesn't put it to sleep. Returns a function that stops it.
 */
export function startKeepAlive(publicUrl: string, everyMs = KEEP_ALIVE_MS): () => void {
  const url = `${publicUrl.replace(/\/+$/, '')}/health`;
  const timer = setInterval(() => {
    fetch(url, { signal: AbortSignal.timeout(30_000) })
      .then(res => res.ok || console.error(`Keep-alive: ${url} returned ${res.status}`))
      .catch(e => console.error(`Keep-alive: ${url} failed:`, (e as Error).message));
  }, everyMs);
  return () => clearInterval(timer);
}

if (import.meta.main) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Set GEMINI_API_KEY (see .env.example).');
    process.exit(1);
  }
  const jwtSecret = process.env.JWT_SECRET ?? '';
  // Anyone who knows the secret can sign in as any account, so it must be long and random.
  if (jwtSecret.length < 32) {
    console.error('Set JWT_SECRET to at least 32 random characters (see .env.example).');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8787);
  // This Mac only by default (the phone reaches it through adb reverse). Set HOST=0.0.0.0 when
  // deploying behind HTTPS.
  const host = process.env.HOST ?? '127.0.0.1';
  const dataDir = process.env.DATA_DIR ?? new URL('../data/', import.meta.url).pathname;
  // Fail at startup, not at the first sign-up, when the data disk isn't writable.
  try {
    await mkdir(dataDir, { recursive: true });
    await access(dataDir, constants.W_OK);
  } catch (e) {
    console.error(`DATA_DIR ${dataDir} is not writable:`, (e as Error).message);
    process.exit(1);
  }
  const cache = new MerchantCache(join(dataDir, 'merchants.json'));
  const users = await UserStore.open(join(dataDir, 'users.json'));
  const app = createApp({
    model: createGenerator(apiKey),
    users,
    jwtSecret,
    cache,
    trustProxy: process.env.TRUST_PROXY === '1',
    clientIpHeader: process.env.CLIENT_IP_HEADER || undefined,
  });
  createServer(app).listen(port, host, () =>
    console.log(`Spendd API on http://${host}:${port} (${MODEL}, ${users.size} accounts, ${cache.size} merchants cached)`),
  );
  // Render sets RENDER_EXTERNAL_URL; KEEP_ALIVE_URL works on other hosts. Unset (local dev): no pings.
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (keepAliveUrl && process.env.KEEP_ALIVE !== '0') {
    startKeepAlive(keepAliveUrl);
    console.log(`Keep-alive: pinging ${keepAliveUrl}/health every ${KEEP_ALIVE_MS / 60_000} min`);
  }
}
