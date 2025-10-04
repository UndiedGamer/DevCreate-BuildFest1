import type { AttendanceStatus } from '@/lib/types/session';

export interface AttendanceLog {
  id: string;
  sessionId: string;
  className: string;
  subject: string;
  teacherId: string;
  status: AttendanceStatus;
  proximityMeters?: number;
  recordedAt?: string;
  recordedAtLabel?: string;
  latitude?: number;
  longitude?: number;
  deviceKey?: string;
  devicePlatform?: string | null;
  deviceModel?: string | null;
  notes?: string[];
}
