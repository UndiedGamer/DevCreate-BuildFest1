import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { FirebaseError } from 'firebase/app';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { isMockStudent, type MockStudentUser } from '@/services/mock-student';
import { type DeviceApprovalState } from '@/services/student-profile';

type AllowedUser = User | MockStudentUser;

type FirestoreTimestampLike = {
  seconds: number;
  nanoseconds: number;
};

interface DeviceMetadata {
  platform: string;
  brand: string | null;
  modelName: string | null;
  osVersion: string | null;
  isPhysicalDevice: boolean;
  attestationPassed: boolean;
  appVersion: string | null;
  appBuild: string | null;
}

export interface DeviceRegistration {
  deviceKey: string;
  approvalState: DeviceApprovalState;
  approvalReason: string | null;
  isPhysicalDevice: boolean;
  platform: string;
  brand: string | null;
  modelName: string | null;
  osVersion: string | null;
  appVersion: string | null;
  attestationPassed: boolean;
  lastSyncedAt: string;
  registeredAt?: string | null;
}

const DEVICE_KEY_STORAGE_KEY = 'smart-attender.device-key';
const DEVICE_KEY_SECURE_STORE = DEVICE_KEY_STORAGE_KEY;
const DEVICE_KEY_ASYNC_STORAGE = DEVICE_KEY_STORAGE_KEY;
const LEGACY_DEVICE_KEY_ASYNC_STORAGE = 'smart-attender/device-key';
const MOCK_DEVICE_PREFIX = 'smart-attender/mock-device/';
const EMULATOR_BLOCK_REASON = 'Virtual devices are not allowed for attendance.';
const DEVICE_CONFLICT_REASON = 'This device is registered to another student. Use your approved device or request a transfer.';
const DEVICE_VERIFICATION_FAILURE_REASON = 'Unable to verify device ownership. Check your connection or contact an administrator.';

let secureStoreAvailable: boolean | null = null;

export async function getDeviceKey(): Promise<string> {
  return getOrCreateDeviceKey();
}

export async function ensureDeviceRegistration(user: AllowedUser | null | undefined): Promise<DeviceRegistration | null> {
  if (!user) {
    return null;
  }

  const deviceKey = await getOrCreateDeviceKey();
  const metadata = collectDeviceMetadata();
  const nowIso = new Date().toISOString();

  if (isMockStudent(user) || !isFirebaseConfigured) {
    const record = await loadMockDeviceRecord(user, deviceKey, metadata, nowIso);
    await saveMockDeviceRecord(user, record);
    return record;
  }

  const db = getFirestoreDb();
  const directoryRef = doc(db, 'deviceDirectory', deviceKey);
  let deviceClaimedByOther = false;
  let ownershipVerificationFailed = false;

  const directoryPayload = {
    studentId: user.uid,
    lastSeenAt: serverTimestamp(),
    platform: metadata.platform,
    brand: metadata.brand ?? null,
    modelName: metadata.modelName ?? null,
    osVersion: metadata.osVersion ?? null,
    appVersion: metadata.appVersion ?? null,
    isPhysicalDevice: metadata.isPhysicalDevice,
    attestationPassed: metadata.attestationPassed
  } as const;

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(directoryRef);

      if (!snapshot.exists()) {
        transaction.set(directoryRef, {
          ...directoryPayload,
          createdAt: serverTimestamp()
        });
        return;
      }

      const data = snapshot.data() as Record<string, unknown>;
      const ownerId = typeof data.studentId === 'string' ? data.studentId : null;

      if (ownerId && ownerId !== user.uid) {
        deviceClaimedByOther = true;
        return;
      }

      transaction.update(directoryRef, {
        ...directoryPayload
      });
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      deviceClaimedByOther = true;
    } else {
      ownershipVerificationFailed = true;
      console.warn('Unable to sync device ownership directory entry', error);
    }
  }

  const profileRef = doc(db, 'students', user.uid);
  const deviceRef = doc(db, 'students', user.uid, 'devices', deviceKey);

  const [profileSnap, deviceSnap] = await Promise.all([getDoc(profileRef), getDoc(deviceRef)]);
  const profileData = profileSnap.data() ?? {};
  const currentActiveKey = typeof profileData.activeDeviceKey === 'string' ? profileData.activeDeviceKey : null;

  const storedData = deviceSnap.data() ?? {};
  const storedState = toDeviceState(storedData.approvalState);
  const storedReason = typeof storedData.approvalReason === 'string' ? storedData.approvalReason : null;

  let approvalState: DeviceApprovalState;
  let approvalReason: string | null = storedReason;

  if (deviceClaimedByOther) {
    approvalState = 'blocked';
    approvalReason = DEVICE_CONFLICT_REASON;
  } else if (ownershipVerificationFailed) {
    approvalState = 'blocked';
    approvalReason = DEVICE_VERIFICATION_FAILURE_REASON;
  } else if (!metadata.isPhysicalDevice) {
    approvalState = 'blocked';
    approvalReason = EMULATOR_BLOCK_REASON;
  } else if (storedState) {
    approvalState = storedState;
  } else if (!currentActiveKey || currentActiveKey === deviceKey) {
    approvalState = 'approved';
    approvalReason = null;
  } else {
    approvalState = 'pending';
    approvalReason = 'Another device is already approved for this account.';
  }

  const devicePayload: Record<string, unknown> = {
    deviceKey,
    platform: metadata.platform,
    brand: metadata.brand,
    modelName: metadata.modelName,
    osVersion: metadata.osVersion,
    isPhysicalDevice: metadata.isPhysicalDevice,
    attestation: {
      passed: metadata.attestationPassed,
      evaluatedAt: serverTimestamp(),
      reason: metadata.attestationPassed ? null : 'Failed runtime integrity checks.'
    },
    approvalState,
    approvalReason,
    appVersion: metadata.appVersion,
    appBuild: metadata.appBuild,
    lastSeenAt: serverTimestamp()
  };

  if (!deviceSnap.exists()) {
    devicePayload.registeredAt = serverTimestamp();
  }

  await setDoc(deviceRef, devicePayload, { merge: true });

  const profileUpdates: Record<string, unknown> = {};
  const storedProfileState = toDeviceState(profileData.deviceApprovalState);
  const storedProfileReason = typeof profileData.deviceApprovalReason === 'string' ? profileData.deviceApprovalReason : null;
  const shouldUpdateProfile =
    approvalState === 'approved' ||
    currentActiveKey === deviceKey ||
    !currentActiveKey ||
    storedProfileState !== approvalState ||
    storedProfileReason !== approvalReason;

  if (shouldUpdateProfile) {
    profileUpdates.deviceApprovalState = approvalState;
    profileUpdates.deviceApprovalReason = approvalReason;
    profileUpdates.deviceApprovalUpdatedAt = serverTimestamp();
    profileUpdates.activeDeviceKey = approvalState === 'approved' ? deviceKey : null;
  }

  if (Object.keys(profileUpdates).length > 0) {
    await updateDoc(profileRef, profileUpdates);
  }

  return {
    deviceKey,
    approvalState,
    approvalReason,
    isPhysicalDevice: metadata.isPhysicalDevice,
    platform: metadata.platform,
    brand: metadata.brand,
    modelName: metadata.modelName,
    osVersion: metadata.osVersion,
    appVersion: metadata.appVersion,
    attestationPassed: metadata.attestationPassed,
    lastSyncedAt: nowIso,
    registeredAt: timestampToIso(deviceSnap.data()?.registeredAt) ?? nowIso
  } satisfies DeviceRegistration;
}

export async function fetchDeviceRegistration(user: AllowedUser | null | undefined): Promise<DeviceRegistration | null> {
  if (!user) {
    return null;
  }

  const deviceKey = await getOrCreateDeviceKey();
  const metadata = collectDeviceMetadata();
  const nowIso = new Date().toISOString();

  if (isMockStudent(user) || !isFirebaseConfigured) {
    const record = await loadMockDeviceRecord(user, deviceKey, metadata, nowIso, false);
    return record;
  }

  const db = getFirestoreDb();
  const deviceRef = doc(db, 'students', user.uid, 'devices', deviceKey);
  const snapshot = await getDoc(deviceRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() ?? {};
  return {
    deviceKey,
    approvalState: toDeviceState(data.approvalState) ?? 'pending',
    approvalReason: typeof data.approvalReason === 'string' ? data.approvalReason : null,
    isPhysicalDevice: typeof data.isPhysicalDevice === 'boolean' ? data.isPhysicalDevice : metadata.isPhysicalDevice,
    platform: typeof data.platform === 'string' ? data.platform : metadata.platform,
    brand: typeof data.brand === 'string' ? data.brand : metadata.brand,
    modelName: typeof data.modelName === 'string' ? data.modelName : metadata.modelName,
    osVersion: typeof data.osVersion === 'string' ? data.osVersion : metadata.osVersion,
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : metadata.appVersion,
    attestationPassed:
      typeof data.attestation?.passed === 'boolean' ? data.attestation.passed : metadata.attestationPassed,
    lastSyncedAt: timestampToIso(data.lastSeenAt) ?? nowIso,
    registeredAt: timestampToIso(data.registeredAt)
  } satisfies DeviceRegistration;
}

export function isDeviceApproved(registration: DeviceRegistration | null | undefined): boolean {
  return registration?.approvalState === 'approved';
}

async function getOrCreateDeviceKey(): Promise<string> {
  const existing = await readStoredDeviceKey();
  if (existing) {
    return existing;
  }

  const nextKey = generateDeviceKey();
  await storeDeviceKey(nextKey);
  return nextKey;
}

async function readStoredDeviceKey(): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    try {
      const value = await SecureStore.getItemAsync(DEVICE_KEY_SECURE_STORE);
      if (value) {
        return value;
      }
    } catch (error) {
      console.warn('Unable to read device key from secure storage', error);
    }
  }

  try {
    const stored = await AsyncStorage.getItem(DEVICE_KEY_ASYNC_STORAGE);
    if (stored) {
      return stored;
    }

    const legacy = await AsyncStorage.getItem(LEGACY_DEVICE_KEY_ASYNC_STORAGE);
    if (legacy) {
      await AsyncStorage.setItem(DEVICE_KEY_ASYNC_STORAGE, legacy);
      try {
        await AsyncStorage.removeItem(LEGACY_DEVICE_KEY_ASYNC_STORAGE);
      } catch (removeError) {
        console.warn('Unable to remove legacy device key record', removeError);
      }
      return legacy;
    }
  } catch (error) {
    console.warn('Unable to read device key from AsyncStorage', error);
  }

  return null;
}

async function storeDeviceKey(value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.setItemAsync(DEVICE_KEY_SECURE_STORE, value);
    } catch (error) {
      console.warn('Unable to persist device key in secure storage', error);
    }
  }

  try {
    await AsyncStorage.setItem(DEVICE_KEY_ASYNC_STORAGE, value);
  } catch (error) {
    console.warn('Unable to persist device key in AsyncStorage', error);
  }

  try {
    await AsyncStorage.removeItem(LEGACY_DEVICE_KEY_ASYNC_STORAGE);
  } catch (error) {
    console.warn('Unable to remove legacy device key record', error);
  }
}

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch (error) {
    console.warn('SecureStore availability check failed', error);
    secureStoreAvailable = false;
  }

  return secureStoreAvailable ?? false;
}

function generateDeviceKey(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  const randomSegment = () => Math.random().toString(16).slice(2, 10);
  return `${randomSegment()}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

function collectDeviceMetadata(): DeviceMetadata {
  const platform = typeof Device.osName === 'string' ? Device.osName : Platform.OS;
  const brand = typeof Device.brand === 'string' ? Device.brand : null;
  const modelName = typeof Device.modelName === 'string' ? Device.modelName : Device.modelId ?? null;
  const osVersion = typeof Device.osVersion === 'string' ? Device.osVersion : null;
  const isPhysicalDevice = Boolean(Device.isDevice);
  const attestationPassed = isPhysicalDevice;

  const appVersion =
    Constants.expoConfig?.version ?? Constants.expoConfig?.runtimeVersion ?? Constants.manifest2?.extra?.expoClient?.config?.version ?? null;
  const appBuild =
    Constants.expoConfig?.extra?.eas?.buildId ?? Constants.expoConfig?.extra?.eas?.appVersion ?? Constants.expoConfig?.runtimeVersion ?? null;

  return {
    platform,
    brand,
    modelName,
    osVersion,
    isPhysicalDevice,
    attestationPassed,
    appVersion,
    appBuild
  } satisfies DeviceMetadata;
}

function toDeviceState(value: unknown): DeviceApprovalState | null {
  if (value === 'approved' || value === 'pending' || value === 'blocked') {
    return value;
  }
  return null;
}

function timestampToIso(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && value !== null && 'seconds' in value && 'nanoseconds' in value) {
    const ts = value as FirestoreTimestampLike;
    const millis = ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1_000_000);
    return new Date(millis).toISOString();
  }

  return null;
}

async function loadMockDeviceRecord(
  user: AllowedUser,
  deviceKey: string,
  metadata: DeviceMetadata,
  nowIso: string,
  createIfMissing = true
): Promise<DeviceRegistration> {
  const key = `${MOCK_DEVICE_PREFIX}${user.uid}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceRegistration>;
      return {
        deviceKey: parsed.deviceKey ?? deviceKey,
        approvalState: parsed.approvalState ?? 'approved',
        approvalReason: parsed.approvalReason ?? null,
        isPhysicalDevice: metadata.isPhysicalDevice,
        platform: metadata.platform,
        brand: metadata.brand,
        modelName: metadata.modelName,
        osVersion: metadata.osVersion,
        appVersion: metadata.appVersion,
        attestationPassed: metadata.attestationPassed,
        lastSyncedAt: nowIso,
        registeredAt: parsed.registeredAt ?? nowIso
      } satisfies DeviceRegistration;
    }
  } catch (error) {
    console.warn('Unable to read mock device record', error);
  }

  const fallback: DeviceRegistration = {
    deviceKey,
    approvalState: metadata.isPhysicalDevice ? 'approved' : 'blocked',
    approvalReason: metadata.isPhysicalDevice ? null : EMULATOR_BLOCK_REASON,
    isPhysicalDevice: metadata.isPhysicalDevice,
    platform: metadata.platform,
    brand: metadata.brand,
    modelName: metadata.modelName,
    osVersion: metadata.osVersion,
    appVersion: metadata.appVersion,
    attestationPassed: metadata.attestationPassed,
    lastSyncedAt: nowIso,
    registeredAt: nowIso
  } satisfies DeviceRegistration;

  if (createIfMissing) {
    await saveMockDeviceRecord(user, fallback);
  }

  return fallback;
}

async function saveMockDeviceRecord(user: AllowedUser, record: DeviceRegistration): Promise<void> {
  const key = `${MOCK_DEVICE_PREFIX}${user.uid}`;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(record));
  } catch (error) {
    console.warn('Unable to persist mock device record', error);
  }
}