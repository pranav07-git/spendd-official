/**
 * useAuth — React hook for the current Firebase auth state.
 *
 * Subscribes to auth state changes and returns:
 *   - `user`    : FirebaseAuthTypes.User | null  (null = signed out)
 *   - `loading` : true while the initial auth state is being resolved
 *
 * Usage:
 *   const { user, loading } = useAuth();
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type AuthUser } from './firebase';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(user => {
      setState({ user, loading: false });
    });
    return unsubscribe;
  }, []);

  return state;
}
