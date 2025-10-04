import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type QuerySnapshot
} from 'firebase/firestore';
import { format } from 'date-fns';
import { useAuth } from '@/providers/AuthProvider';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import type { AttendanceLog } from '@/lib/types/student';
import type { AttendanceStatus } from '@/lib/types/session';

const mockLogs: AttendanceLog[] = [
  {
    id: 'mock-log-1',
    sessionId: 'mock-session-1',
    className: 'Mathematics',
    subject: 'Algebra Basics',
    teacherId: 'demo-teacher',
    status: 'present',
    proximityMeters: 6,
    recordedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    recordedAtLabel: format(Date.now() - 1000 * 60 * 60, 'PPpp'),
    notes: ['Demo data']
  }
];

export function useAttendanceHistory(limitCount = 10) {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!user?.uid) {
      setRecords([]);
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured) {
      setRecords(mockLogs);
      setLoading(false);
      return;
    }

    const db = getFirestoreDb();
    const logsRef = collection(db, 'students', user.uid, 'attendanceLogs');
    const q = query(logsRef, orderBy('recordedAt', 'desc'), limit(limitCount));

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const docs = snapshot.docs.map((docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
          const data = docSnapshot.data() as Record<string, unknown>;
          return {
            id: docSnapshot.id,
            sessionId: String(data.sessionId ?? ''),
            className: String(data.className ?? 'Class'),
            subject: String(data.subject ?? 'Subject'),
            teacherId: String(data.teacherId ?? ''),
            status: (data.status as AttendanceStatus) ?? 'present',
            proximityMeters: typeof data.proximityMeters === 'number' ? data.proximityMeters : undefined,
            recordedAt: typeof data.recordedAt === 'string' ? data.recordedAt : undefined,
            recordedAtLabel: typeof data.recordedAtLabel === 'string' ? data.recordedAtLabel : undefined,
            latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
            longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
            deviceKey: typeof data.deviceKey === 'string' ? data.deviceKey : undefined,
            devicePlatform: typeof data.devicePlatform === 'string' ? data.devicePlatform : undefined,
            deviceModel: typeof data.deviceModel === 'string' ? data.deviceModel : undefined,
            notes: Array.isArray(data.notes) ? (data.notes as string[]) : undefined
          } satisfies AttendanceLog;
        });
        setRecords(docs);
        setLoading(false);
      },
      (firestoreError: FirestoreError) => {
        console.error('Failed to load attendance history', firestoreError);
        setError('Unable to load attendance history.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, limitCount, refreshKey]);

  const refresh = () => {
    setRefreshKey((value) => value + 1);
  };

  return {
    records,
    loading,
    error,
    refresh
  };
}
