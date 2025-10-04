'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import { ensureTeacherDocument } from '@/lib/utils/ensureTeacherDocument';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return () => undefined;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser: User | null) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        try {
          await ensureTeacherDocument(firebaseUser.uid, firebaseUser.displayName);
        } catch (err) {
          console.error('Failed to ensure teacher document exists', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase is not configured');
      }
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (err) {
      console.error(err);
      setError('Unable to sign in. Check your credentials and try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        return;
      }
      await firebaseSignOut(getFirebaseAuth());
    } catch (err) {
      console.error(err);
      setError('Failed to sign out. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase is not configured');
      }
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (err) {
      console.error(err);
      setError('Unable to send password reset email.');
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      signOut,
      requestPasswordReset
    }),
    [error, loading, requestPasswordReset, signIn, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
