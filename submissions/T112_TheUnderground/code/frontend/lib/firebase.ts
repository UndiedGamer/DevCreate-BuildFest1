import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const requiredKeys = (Object.entries(firebaseConfig) as [keyof typeof firebaseConfig, string | undefined][]).filter(
  ([key]) => key !== 'measurementId'
);

export const missingFirebaseConfigKeys = requiredKeys
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

let firebaseApp: FirebaseApp | undefined;

function ensureApp() {
  if (!isFirebaseConfigured) {
    throw new Error(
      `Firebase is not configured. Missing keys: ${missingFirebaseConfigKeys.join(
        ', '
      )}. Provide the NEXT_PUBLIC_FIREBASE_* variables in a .env.local file.`
    );
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
  }

  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(ensureApp());
}

export function getFirestoreDb(): Firestore {
  return getFirestore(ensureApp());
}
