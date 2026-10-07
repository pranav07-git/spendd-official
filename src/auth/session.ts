/**
 * Email + password accounts on the Spendd server, with a JWT session.
 *
 * The token is kept in the Android Keystore-backed keychain and sent as a bearer token on every
 * server call (see apiFetch). It lasts 30 days; one older than a week is swapped for a fresh one
 * at launch, so a phone in regular use stays signed in.
 */

import * as Keychain from 'react-native-keychain';
import { API_URL } from '../config';

const SESSION_SERVICE = 'com.spendd.session';
const TIMEOUT_MS = 20_000;
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** `name` is the one given at sign-up (null for accounts made before names were asked for). */
export type AuthUser = { id: string; email: string; name: string | null };

export type AuthError = {
  /** Human-readable message safe to display in the UI. */
  message: string;
  /** The server's error code, for programmatic checks. */
  code: string;
};

/** expiresAt comes from the server; savedAt is when this phone got the token. */
type Session = { token: string; expiresAt: number; savedAt: number; user: AuthUser };
type SessionResponse = Omit<Session, 'savedAt'>;

/** Type-guard: returns true when a value is an AuthError (not an AuthUser). */
export function isAuthError(value: AuthUser | AuthError): value is AuthError {
  return 'message' in value && 'code' in value;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

let current: Session | null = null;
const listeners = new Set<(user: AuthUser | null) => void>();

function setSession(session: Session | null) {
  current = session;
  listeners.forEach(listener => listener(session?.user ?? null));
}

async function saveSession(response: SessionResponse) {
  const session: Session = { ...response, savedAt: Date.now() };
  await Keychain.setGenericPassword('spendd', JSON.stringify(session), {
    service: SESSION_SERVICE,
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  setSession(session);
}

/**
 * Restores the saved session at launch; null when signed out or the token has expired.
 * Call once before reading getCurrentUser().
 */
export async function loadSession(now: number = Date.now()): Promise<AuthUser | null> {
  const saved = await Keychain.getGenericPassword({ service: SESSION_SERVICE });
  if (!saved) {
    return null;
  }
  let session: Session;
  try {
    session = JSON.parse(saved.password) as Session;
  } catch {
    await signOut();
    return null;
  }
  if (typeof session.token !== 'string' || !(session.expiresAt > now)) {
    await signOut();
    return null;
  }
  current = session;
  if (now - session.savedAt > REFRESH_AFTER_MS) {
    refreshSession().catch(() => {});
  }
  return session.user;
}

/** Swaps the token for a fresh one. Offline is fine; a token the server refuses signs out. */
async function refreshSession(): Promise<void> {
  const res = await apiFetch('/v1/auth/refresh', { method: 'POST' });
  if (res.ok) {
    await saveSession((await res.json()) as SessionResponse);
  }
}

/** Returns the signed-in user, or null. Valid after loadSession(). */
export function getCurrentUser(): AuthUser | null {
  return current?.user ?? null;
}

/**
 * Subscribes to sign-in and sign-out. Returns an unsubscribe function.
 */
export function onAuthStateChanged(listener: (user: AuthUser | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Signs the current user out of this phone. */
export async function signOut(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
  if (current) {
    setSession(null);
  }
}

// ---------------------------------------------------------------------------
// Server calls
// ---------------------------------------------------------------------------

/**
 * fetch() against the Spendd server, with the session's bearer token and a timeout. A 401 means
 * the token is no longer accepted, so the phone signs out.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!API_URL) {
    throw new Error('No Spendd server configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (current) {
    headers.authorization = `Bearer ${current.token}`;
  }
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
    if (res.status === 401 && current) {
      await signOut();
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const MESSAGES: Record<string, string> = {
  email_taken: 'An account with this email already exists.',
  invalid_credentials: 'Incorrect email or password.',
  rate_limited: 'Too many attempts. Try again in a few minutes.',
};

async function authenticate(
  action: 'signup' | 'login',
  credentials: { email: string; password: string; name?: string },
): Promise<AuthUser | AuthError> {
  if (!API_URL) {
    return { code: 'not-configured', message: 'Sign-in isn’t available in this build yet.' };
  }
  let res: Response;
  try {
    res = await apiFetch(`/v1/auth/${action}`, {
      method: 'POST',
      body: JSON.stringify({ ...credentials, email: credentials.email.trim(), name: credentials.name?.trim() }),
    });
  } catch {
    return { code: 'network', message: 'Can’t reach Spendd. Check your connection.' };
  }
  const body = (await res.json().catch(() => ({}))) as Partial<SessionResponse> & { error?: string; message?: string };
  if (res.ok && body.token && body.expiresAt && body.user) {
    await saveSession({ token: body.token, expiresAt: body.expiresAt, user: body.user });
    return body.user;
  }
  const code = body.error ?? `http_${res.status}`;
  if (code === 'bad_request' && body.message?.startsWith('email')) {
    return { code, message: 'Enter a valid email address.' };
  }
  if (code === 'bad_request' && body.message?.startsWith('name')) {
    return { code, message: 'Enter your name.' };
  }
  if (code === 'bad_request' && body.message?.startsWith('password')) {
    return { code, message: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  return { code, message: MESSAGES[code] ?? 'Something went wrong. Try again.' };
}

/** Creates a new account with a name, email and password, and signs in to it. */
export function signUpWithEmail(name: string, email: string, password: string): Promise<AuthUser | AuthError> {
  return authenticate('signup', { name, email, password });
}

/** Signs in an existing account with email + password. */
export function signInWithEmail(email: string, password: string): Promise<AuthUser | AuthError> {
  return authenticate('login', { email, password });
}
