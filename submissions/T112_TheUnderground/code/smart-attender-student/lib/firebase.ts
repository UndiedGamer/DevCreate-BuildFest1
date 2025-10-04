import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, type Persistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const requiredKeys = (Object.entries(firebaseConfig) as [keyof typeof firebaseConfig, string | undefined][]).filter(
  ([key]) => key !== 'measurementId'
);

export const missingFirebaseConfigKeys = requiredKeys
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;
let firestoreDb: Firestore | undefined;

type ReactNativeAuthModule = {
  initializeAuth: (app: FirebaseApp, deps?: { persistence?: Persistence | Persistence[] }) => Auth;
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

let reactNativeAuthModule: ReactNativeAuthModule | null = null;

if (Platform.OS !== 'web') {
  try {
    reactNativeAuthModule = require('@firebase/auth/dist/rn/index.js') as ReactNativeAuthModule;
  } catch (error) {
    console.warn('[firebase] Unable to load React Native Auth helpers', error);
  }
}

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      `Firebase is not configured. Missing keys: ${missingFirebaseConfigKeys.join(
        ', '
      )}. Provide the EXPO_PUBLIC_FIREBASE_* variables in an .env file.`
    );
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
  }

  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    const app = ensureApp();
    if (Platform.OS !== 'web' && reactNativeAuthModule) {
      try {
        firebaseAuth = reactNativeAuthModule.initializeAuth(app, {
          persistence: reactNativeAuthModule.getReactNativePersistence(AsyncStorage)
        });
      } catch (error) {
        console.warn('[firebase] Falling back to default Auth persistence', error);
        firebaseAuth = getAuth(app);
      }
    }

    if (!firebaseAuth) {
      firebaseAuth = getAuth(app);
    }
  }

  return firebaseAuth;
}

export function getFirestoreDb(): Firestore {
  if (!firestoreDb) {
    firestoreDb = getFirestore(ensureApp());
  }

  return firestoreDb;
}
