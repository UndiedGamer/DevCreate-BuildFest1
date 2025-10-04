import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { isMockStudent, type MockStudentUser } from '@/services/mock-student';

export type DeviceApprovalState = 'pending' | 'approved' | 'blocked';

type AllowedUser = User | MockStudentUser;

export interface StudentProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  studentNumber: string | null;
  enrolledClasses: string[];
  activeDeviceKey: string | null;
  deviceApprovalState: DeviceApprovalState;
  deviceApprovalReason: string | null;
  deviceApprovalUpdatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profileCompletedAt?: string | null;
}

const MOCK_PROFILE_PREFIX = 'smart-attender/mock-profile/';

export async function ensureStudentProfile(user: AllowedUser | null | undefined): Promise<void> {
  if (!user || isMockStudent(user) || !isFirebaseConfigured) {
    return;
  }

  const db = getFirestoreDb();
  const profileRef = doc(db, 'students', user.uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      studentNumber: null,
      enrolledClasses: [],
      activeDeviceKey: null,
      deviceApprovalState: 'pending',
      deviceApprovalReason: null,
      deviceApprovalUpdatedAt: null,
      profileCompletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }

  const existing = snapshot.data() ?? {};
  const payload: Record<string, unknown> = {
    displayName: user.displayName ?? existing.displayName ?? null,
    photoURL: user.photoURL ?? existing.photoURL ?? null,
    email: user.email ?? existing.email ?? null,
    updatedAt: serverTimestamp()
  };

  if (typeof existing.activeDeviceKey === 'undefined') {
    payload.activeDeviceKey = null;
  }

  if (typeof existing.deviceApprovalState === 'undefined') {
    payload.deviceApprovalState = 'pending';
  }

  if (typeof existing.deviceApprovalReason === 'undefined') {
    payload.deviceApprovalReason = null;
  }

  if (typeof existing.deviceApprovalUpdatedAt === 'undefined') {
    payload.deviceApprovalUpdatedAt = null;
  }

  await updateDoc(profileRef, payload);
}

export async function fetchStudentProfile(user: AllowedUser | null | undefined): Promise<StudentProfile | null> {
  if (!user) {
    return null;
  }

  if (isMockStudent(user) || !isFirebaseConfigured) {
    return loadMockProfile(user);
  }

  const db = getFirestoreDb();
  const profileRef = doc(db, 'students', user.uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    await ensureStudentProfile(user);
    return fetchStudentProfile(user);
  }

  return normalizeProfile(snapshot.data());
}

export async function updateStudentProfile(
  user: AllowedUser | null | undefined,
  updates: Partial<StudentProfile>
): Promise<void> {
  if (!user) {
    return;
  }

  if (isMockStudent(user) || !isFirebaseConfigured) {
    const profile = await loadMockProfile(user);
    const nextProfile: StudentProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await saveMockProfile(user, nextProfile);
    return;
  }

  const db = getFirestoreDb();
  const profileRef = doc(db, 'students', user.uid);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp()
  };

  if (typeof updates.displayName !== 'undefined') {
    payload.displayName = updates.displayName;
  }

  if (typeof updates.studentNumber !== 'undefined') {
    payload.studentNumber = updates.studentNumber;
  }

  if (typeof updates.profileCompletedAt !== 'undefined') {
    payload.profileCompletedAt = updates.profileCompletedAt;
  }

  if (typeof updates.photoURL !== 'undefined') {
    payload.photoURL = updates.photoURL;
  }

  if (typeof updates.enrolledClasses !== 'undefined') {
    payload.enrolledClasses = updates.enrolledClasses;
  }

  if (typeof updates.email !== 'undefined') {
    payload.email = updates.email;
  }

  if (typeof updates.activeDeviceKey !== 'undefined') {
    payload.activeDeviceKey = updates.activeDeviceKey;
  }

  if (typeof updates.deviceApprovalState !== 'undefined') {
    payload.deviceApprovalState = updates.deviceApprovalState;
  }

  if (typeof updates.deviceApprovalReason !== 'undefined') {
    payload.deviceApprovalReason = updates.deviceApprovalReason;
  }

  if (typeof updates.deviceApprovalUpdatedAt !== 'undefined') {
    payload.deviceApprovalUpdatedAt = updates.deviceApprovalUpdatedAt;
  }

  await setDoc(profileRef, payload, { merge: true });
}

export function isProfileComplete(profile: StudentProfile | null | undefined, requireDevice = true): boolean {
  if (!profile) {
    return false;
  }

  const basicComplete = Boolean(profile.displayName && profile.studentNumber);
  if (!requireDevice) {
    return basicComplete;
  }

  return basicComplete && profile.deviceApprovalState === 'approved' && Boolean(profile.activeDeviceKey);
}

async function loadMockProfile(user: AllowedUser): Promise<StudentProfile> {
  const key = `${MOCK_PROFILE_PREFIX}${user.uid}`;
  const raw = await AsyncStorage.getItem(key);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StudentProfile>;
      return {
        displayName: parsed.displayName ?? user.displayName ?? 'Demo Student',
        email: parsed.email ?? user.email ?? null,
        photoURL: parsed.photoURL ?? null,
        studentNumber: parsed.studentNumber ?? null,
        enrolledClasses: parsed.enrolledClasses ?? [],
        activeDeviceKey: parsed.activeDeviceKey ?? null,
        deviceApprovalState: parsed.deviceApprovalState ?? 'approved',
        deviceApprovalReason: parsed.deviceApprovalReason ?? null,
        deviceApprovalUpdatedAt: parsed.deviceApprovalUpdatedAt ?? new Date().toISOString(),
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
        profileCompletedAt: parsed.profileCompletedAt ?? null
      } satisfies StudentProfile;
    } catch (error) {
      console.warn('Failed to parse mock profile', error);
    }
  }

  const fallback: StudentProfile = {
    displayName: user.displayName ?? 'Demo Student',
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    studentNumber: null,
    enrolledClasses: [],
    activeDeviceKey: null,
    deviceApprovalState: 'approved',
    deviceApprovalReason: null,
    deviceApprovalUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileCompletedAt: null
  };

  await saveMockProfile(user, fallback);
  return fallback;
}

async function saveMockProfile(user: AllowedUser, profile: StudentProfile): Promise<void> {
  const key = `${MOCK_PROFILE_PREFIX}${user.uid}`;
  await AsyncStorage.setItem(key, JSON.stringify(profile));
}

function normalizeProfile(raw: Record<string, unknown> | undefined): StudentProfile {
  const toStringOrNull = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
  const toState = (value: unknown): DeviceApprovalState => {
    if (value === 'approved' || value === 'pending' || value === 'blocked') {
      return value;
    }
    return 'pending';
  };

  return {
    displayName: toStringOrNull(raw?.displayName) ?? null,
    email: toStringOrNull(raw?.email) ?? null,
    photoURL: toStringOrNull(raw?.photoURL) ?? null,
    studentNumber: toStringOrNull(raw?.studentNumber) ?? null,
    enrolledClasses: Array.isArray(raw?.enrolledClasses) ? (raw?.enrolledClasses as string[]) : [],
    activeDeviceKey: toStringOrNull(raw?.activeDeviceKey),
    deviceApprovalState: toState(raw?.deviceApprovalState),
    deviceApprovalReason: toStringOrNull(raw?.deviceApprovalReason),
    deviceApprovalUpdatedAt: toStringOrNull(raw?.deviceApprovalUpdatedAt),
    createdAt: toStringOrNull(raw?.createdAt) ?? undefined,
    updatedAt: toStringOrNull(raw?.updatedAt) ?? undefined,
    profileCompletedAt: toStringOrNull(raw?.profileCompletedAt) ?? null
  } satisfies StudentProfile;
}
