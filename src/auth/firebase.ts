/**
 * Firebase Auth wrapper for Spendd (Modular API).
 *
 * Provides email/password auth, Google Sign-In, session persistence,
 * and typed helpers used across all auth screens.
 */

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Replace with the Web client ID from your Firebase project. */
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID_HERE';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthUser = User;

export type AuthError = {
  /** Human-readable message safe to display in the UI. */
  message: string;
  /** Original Firebase error code, for programmatic checks. */
  code: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Translates Firebase error codes into user-facing copy. */
function toAuthError(e: unknown): AuthError {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code: string }).code;
    switch (code) {
      case 'auth/email-already-in-use':
        return { code, message: 'An account with this email already exists.' };
      case 'auth/invalid-email':
        return { code, message: 'Enter a valid email address.' };
      case 'auth/user-not-found':
        return { code, message: 'No account found for this email.' };
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return { code, message: 'Incorrect email or password.' };
      case 'auth/weak-password':
        return { code, message: 'Password must be at least 6 characters.' };
      case 'auth/too-many-requests':
        return { code, message: 'Too many attempts. Try again later.' };
      case 'auth/network-request-failed':
        return { code, message: 'Network error. Check your connection.' };
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return { code, message: 'Sign-in was cancelled.' };
      default:
        return { code, message: 'Something went wrong. Try again.' };
    }
  }
  return { code: 'unknown', message: 'Something went wrong. Try again.' };
}

// ---------------------------------------------------------------------------
// Auth operations
// ---------------------------------------------------------------------------

/**
 * Creates a new account with email + password.
 * Returns the created user on success, or an AuthError on failure.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthUser | AuthError> {
  try {
    const userCredential = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
    return userCredential.user;
  } catch (e) {
    return toAuthError(e);
  }
}

/**
 * Signs in an existing account with email + password.
 * Returns the signed-in user on success, or an AuthError on failure.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthUser | AuthError> {
  try {
    const userCredential = await signInWithEmailAndPassword(getAuth(), email.trim(), password);
    return userCredential.user;
  } catch (e) {
    return toAuthError(e);
  }
}

/**
 * Initiates Google Sign-In.
 * Returns the signed-in user on success, or an AuthError on failure.
 */
export async function signInWithGoogle(): Promise<AuthUser | AuthError> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { data } = await GoogleSignin.signIn();
    if (!data?.idToken) {
      return { code: 'google/no-id-token', message: 'Google sign-in failed. Try again.' };
    }
    const googleCredential = GoogleAuthProvider.credential(data.idToken);
    const userCredential = await signInWithCredential(getAuth(), googleCredential);
    return userCredential.user;
  } catch (e) {
    return toAuthError(e);
  }
}

/**
 * Sends a password-reset email.
 * Returns null on success, or an AuthError on failure.
 */
export async function sendPasswordReset(email: string): Promise<null | AuthError> {
  try {
    await sendPasswordResetEmail(getAuth(), email.trim());
    return null;
  } catch (e) {
    return toAuthError(e);
  }
}

/** Signs the current user out. */
export async function signOut(): Promise<void> {
  await fbSignOut(getAuth());
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in via Google — ignore.
  }
}

/** Returns the currently signed-in Firebase user, or null. */
export function getCurrentUser(): AuthUser | null {
  return getAuth().currentUser;
}

/**
 * Subscribes to auth state changes.
 * The listener fires immediately with the current user, then again on every change.
 * Returns an unsubscribe function.
 */
export function onAuthStateChanged(
  listener: (user: AuthUser | null) => void,
): () => void {
  return fbOnAuthStateChanged(getAuth(), listener);
}

/** Type-guard: returns true when a value is an AuthError (not an AuthUser). */
export function isAuthError(value: AuthUser | AuthError): value is AuthError {
  return 'message' in value && 'code' in value;
}
