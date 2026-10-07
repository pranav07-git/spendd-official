import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BadRequest } from './contract.ts';

/** Tokens last this long; the app swaps an older one for a fresh one at launch (POST /v1/auth/refresh). */
export const TOKEN_TTL_S = 30 * 24 * 60 * 60;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/** `name` is what the user typed at sign-up; accounts made before names existed have none. */
export type User = { id: string; email: string; name?: string; passwordHash: string; createdAt: number };
export type PublicUser = { id: string; email: string; name: string | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseCredentials(body: unknown): { email: string; password: string } {
  if (!isRecord(body) || typeof body.email !== 'string' || typeof body.password !== 'string') {
    throw new BadRequest('email and password are required');
  }
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) {
    throw new BadRequest('email is not valid');
  }
  if (body.password.length < MIN_PASSWORD || body.password.length > MAX_PASSWORD) {
    throw new BadRequest(`password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters`);
  }
  return { email, password: body.password };
}

const MAX_NAME = 60;

/**
 * The display name sent with a sign-up, one line with spaces tidied. The app asks for it, but the
 * 1.0 build didn't send one, so it may be missing; if it's sent, it must be a real name.
 */
export function parseName(body: unknown): string | undefined {
  if (!isRecord(body) || body.name === undefined) {
    return undefined;
  }
  const raw = typeof body.name === 'string' ? body.name : '';
  const name = raw.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length === 0 || name.length > MAX_NAME) {
    throw new BadRequest(`name must be 1–${MAX_NAME} characters`);
  }
  return name;
}

// ---------------------------------------------------------------------------
// Passwords: scrypt, stored as scrypt$N$r$p$salt$hash (base64url).
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, { N, r, p }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), Number(N), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Checked against when the email is unknown, so a wrong email takes as long as a wrong password. */
const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

// ---------------------------------------------------------------------------
// JWT (HS256 only; any other header is rejected).
// ---------------------------------------------------------------------------

export type Claims = { sub: string; email: string; iat: number; exp: number };

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const sign = (input: string, secret: string) => createHmac('sha256', secret).update(input).digest();

export function signToken(user: Pick<PublicUser, 'id' | 'email'>, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const claims: Claims = { sub: user.id, email: user.email, iat, exp: iat + TOKEN_TTL_S };
  const body = `${HEADER}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  return `${body}.${sign(body, secret).toString('base64url')}`;
}

/** The token's claims when its signature is ours and it hasn't expired; otherwise null. */
export function verifyToken(token: string, secret: string, now = Date.now()): Claims | null {
  const [header, payload, signature, extra] = token.split('.');
  if (header !== HEADER || !payload || !signature || extra !== undefined) {
    return null;
  }
  const given = Buffer.from(signature, 'base64url');
  const expected = sign(`${header}.${payload}`, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claims;
    return typeof claims.sub === 'string' && typeof claims.exp === 'number' && claims.exp * 1000 > now ? claims : null;
  } catch {
    return null;
  }
}

export function bearerToken(header: string | string[] | undefined): string | null {
  const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Accounts, kept in a JSON file (or memory only, when file is null).
// ---------------------------------------------------------------------------

export class UserStore {
  private byEmail = new Map<string, User>();
  private byId = new Map<string, User>();
  private file: string | null;
  private writing: Promise<void> = Promise.resolve();

  private constructor(file: string | null) {
    this.file = file;
  }

  static async open(file: string | null): Promise<UserStore> {
    const store = new UserStore(file);
    if (file) {
      try {
        (JSON.parse(await readFile(file, 'utf8')) as User[]).forEach(u => store.add(u));
      } catch (e) {
        // A missing file is a fresh install; anything else (corrupt file) must not be overwritten.
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw e;
        }
      }
    }
    return store;
  }

  get size() {
    return this.byId.size;
  }

  getById(id: string): User | null {
    return this.byId.get(id) ?? null;
  }

  async create(email: string, password: string, name: string | undefined): Promise<User> {
    if (this.byEmail.has(email)) {
      throw new AuthError(409, 'email_taken');
    }
    const passwordHash = await hashPassword(password);
    // Checked again: another sign-up for this email may have finished while hashing.
    if (this.byEmail.has(email)) {
      throw new AuthError(409, 'email_taken');
    }
    const user: User = { id: randomUUID(), email, name, passwordHash, createdAt: Date.now() };
    this.add(user);
    await this.save();
    return user;
  }

  async authenticate(email: string, password: string): Promise<User> {
    const user = this.byEmail.get(email);
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new AuthError(401, 'invalid_credentials');
    }
    return user;
  }

  private add(user: User) {
    this.byEmail.set(user.email, user);
    this.byId.set(user.id, user);
  }

  /** Writes to a temp file and renames it over the old one, so a crash never leaves half a file. */
  private save(): Promise<void> {
    const file = this.file;
    if (!file) {
      return Promise.resolve();
    }
    // A failed earlier write must not stop later ones (it was already reported to its caller).
    this.writing = this.writing.catch(() => {}).then(async () => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify([...this.byId.values()]), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    });
    return this.writing;
  }
}

export const publicUser = (u: User): PublicUser => ({ id: u.id, email: u.email, name: u.name ?? null });
