import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';

import { getFirebaseAuth, isFirebaseConfigured, missingFirebaseConfigKeys } from '@/lib/firebase';
import { createMockStudent, type MockStudentUser } from '@/services/mock-student';
import { ensureStudentProfile } from '@/services/student-profile';

export type AuthenticatedStudent = User | MockStudentUser;

interface AuthContextValue {
  user: AuthenticatedStudent | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMock = !isFirebaseConfigured;

  useEffect(() => {
    if (isMock) {
      console.warn(
        'Running Smart Attender in demo mode. Missing Firebase config keys:',
        missingFirebaseConfigKeys
      );
    }
  }, [isMock]);

  useEffect(() => {
    if (isMock) {
      setUser(createMockStudent('student@smart-attender.dev'));
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser ?? null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isMock]);

  useEffect(() => {
    if (!user || isMock) {
      return;
    }

    ensureStudentProfile(user).catch((err) => {
      console.error('Failed to ensure student profile', err);
    });
  }, [user, isMock]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setError(null);

        if (isMock) {
          setUser(createMockStudent(email));
          return;
        }

        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      } catch (err) {
        console.error('Failed to sign in', err);
        setError('Unable to sign in. Check your email and password.');
        throw err;
      }
    },
    [isMock]
  );

  const signOut = useCallback(async () => {
    try {
      setError(null);

      if (isMock) {
        setUser(createMockStudent('student@smart-attender.dev'));
        return;
      }

      await firebaseSignOut(getFirebaseAuth());
    } catch (err) {
      console.error('Failed to sign out', err);
      setError('Unable to sign out right now. Please retry.');
      throw err;
    }
  }, [isMock]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      try {
        setError(null);

        if (isMock) {
          return;
        }

        await sendPasswordResetEmail(getFirebaseAuth(), email);
      } catch (err) {
        console.error('Failed to request password reset', err);
        setError('Unable to send password reset email. Try again later.');
        throw err;
      }
    },
    [isMock]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signIn,
      signOut,
      requestPasswordReset,
      isMock
    }),
    [user, loading, error, signIn, signOut, requestPasswordReset, isMock]
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
