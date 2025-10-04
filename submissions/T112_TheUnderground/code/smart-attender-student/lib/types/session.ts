export type AttendanceStatus = 'present' | 'flagged' | 'late';

export interface SessionLocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt?: string | null;
}

export interface AttendanceSession {
  id: string;
  className: string;
  subject: string;
  scheduledFor: string;
  durationMinutes: number;
  location: string;
  locationCoordinates?: SessionLocationCoordinates;
  teacherId: string;
  sessionToken?: string;
}

export interface SessionAttendee {
  id: string;
  name: string;
  status: AttendanceStatus;
  scannedAt?: string;
  proximityMeters?: number;
}
