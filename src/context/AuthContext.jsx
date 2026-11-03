'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {onIdTokenChanged, signOut as firebaseSignOut} from 'firebase/auth';
import {firebaseConfigured, getClientAuth} from '@/lib/firebaseClient';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) return undefined;
    // Fires on sign-in, sign-out, and whenever Firebase refreshes the ID token.
    return onIdTokenChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
  }, []);

  const value = {
    user,
    loading,
    configured: firebaseConfigured,
    signOut: () => firebaseSignOut(getClientAuth())
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
