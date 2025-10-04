import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';
import {
  fetchStudentProfile,
  isProfileComplete,
  updateStudentProfile,
  type StudentProfile
} from '@/services/student-profile';
import {
  ensureDeviceRegistration,
  fetchDeviceRegistration,
  isDeviceApproved,
  type DeviceRegistration
} from '@/services/device-trust';

interface ProfileState {
  loading: boolean;
  profile: StudentProfile | null;
  device: DeviceRegistration | null;
  needsDetails: boolean;
  needsDeviceApproval: boolean;
  refresh: () => void;
  saveDetails: (updates: Partial<StudentProfile>) => Promise<void>;
  syncDevice: () => Promise<void>;
}

export function useStudentProfile(): ProfileState {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [device, setDevice] = useState<DeviceRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!user) {
        if (isMounted) {
          setProfile(null);
          setDevice(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const [nextProfile, nextDevice] = await Promise.all([
          fetchStudentProfile(user),
          ensureDeviceRegistration(user)
        ]);

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
        setDevice(nextDevice);
      } catch (error) {
        console.warn('Failed to load student profile', error);
        if (isMounted) {
          setProfile(null);
          setDevice(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [user, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const syncDevice = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const updated = await fetchDeviceRegistration(user);
      setDevice(updated);
    } catch (error) {
      console.warn('Failed to refresh device registration', error);
    }
  }, [user]);

  const saveDetails = useCallback(
    async (updates: Partial<StudentProfile>) => {
      if (!user) {
        return;
      }

      await updateStudentProfile(user, updates);
      await refresh();
    },
    [refresh, user]
  );

  const needsDetails = !isProfileComplete(profile, false);
  const needsDeviceApproval = !isDeviceApproved(device);

  return {
    loading,
    profile,
    device,
    needsDetails,
    needsDeviceApproval,
    refresh,
    saveDetails,
    syncDevice
  };
}
