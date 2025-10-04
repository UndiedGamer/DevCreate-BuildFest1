declare module '@firebase/auth/dist/rn/index.js' {
  import type { FirebaseApp } from 'firebase/app';
  import type { Auth, Persistence } from 'firebase/auth';

  export function getReactNativePersistence(storage: {
    setItem: (key: string, value: string) => Promise<void> | void;
    getItem: (key: string) => Promise<string | null> | string | null;
    removeItem: (key: string) => Promise<void> | void;
  }): Persistence;

  export function initializeAuth(
    app: FirebaseApp,
    deps?: {
      persistence?: Persistence | Persistence[];
      popupRedirectResolver?: unknown;
    }
  ): Auth;
}
