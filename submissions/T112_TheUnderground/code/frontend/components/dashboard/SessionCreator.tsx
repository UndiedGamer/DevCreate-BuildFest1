'use client';

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import type {
  AttendanceSession,
  SessionLocationCoordinates
} from '@/lib/hooks/useTeacherSessions';

interface SessionCreatorState {
  className: string;
  subject: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  expectedAttendance: number;
}

const initialState: SessionCreatorState = {
  className: '',
  subject: '',
  date: new Date().toISOString().split('T')[0],
  startTime: format(new Date(), 'HH:mm'),
  durationMinutes: 45,
  expectedAttendance: 30
};

interface SessionCreatorProps {
  onSessionCreated?: (session: AttendanceSession) => void;
}

function generateSecureId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const segment = () => Math.random().toString(36).slice(2, 10);
  return `${segment()}-${segment()}`;
}

export function SessionCreator({ onSessionCreated }: SessionCreatorProps) {
  const { user } = useAuth();
  const [formState, setFormState] = useState<SessionCreatorState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<SessionLocationCoordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev: SessionCreatorState) => ({
      ...prev,
      [name]: name === 'durationMinutes' || name === 'expectedAttendance' ? Number(value) : value
    }));
  };

  const handleCaptureLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const message = 'Geolocation is not supported in this environment.';
      setLocationStatus('error');
      setLocationError(message);
      toast.error(message);
      return;
    }

    setLocationStatus('locating');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const captured: SessionLocationCoordinates = {
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          accuracy: Number(position.coords.accuracy),
          capturedAt: new Date().toISOString()
        };
        setCoordinates(captured);
        setLocationStatus('success');
        toast.success('Location captured');
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Enable it to tag the session.'
            : 'Unable to capture location. Try again.';
        setLocationStatus('error');
        setLocationError(message);
        toast.error(message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000
      }
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!coordinates) {
      toast.error('Capture your current location before launching the session.');
      return;
    }

    setIsSubmitting(true);

    try {
      const scheduledTimestamp = new Date(`${formState.date}T${formState.startTime}:00`);
      const sessionsCollectionPath = user ? `teachers/${user.uid}/sessions` : null;
      const db = user && isFirebaseConfigured ? getFirestoreDb() : null;
      const sessionRef =
        user && isFirebaseConfigured && sessionsCollectionPath && db
          ? doc(collection(db, sessionsCollectionPath))
          : null;

      const sessionId = sessionRef?.id ?? generateSecureId();
      const sessionToken = generateSecureId().replace(/-/g, '');
      const formattedLocation = `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;
      const sessionPayload = {
        sessionId,
        className: formState.className,
        subject: formState.subject,
        scheduledFor: scheduledTimestamp.toISOString(),
        location: formattedLocation,
        locationCoordinates: coordinates,
        durationMinutes: formState.durationMinutes,
        status: 'scheduled',
        expectedAttendance: formState.expectedAttendance,
        attendees: [],
        createdAt: serverTimestamp()
      };

      const qrData = JSON.stringify({
        sessionId,
        sessionToken,
        className: sessionPayload.className,
        subject: sessionPayload.subject,
        scheduledFor: sessionPayload.scheduledFor,
        teacherId: user?.uid ?? 'demo-teacher',
        durationMinutes: sessionPayload.durationMinutes,
        locationCoordinates: coordinates
      });

      const qrSvg = await QRCode.toDataURL(qrData, { width: 320 });
      setQrPreview(qrSvg);

      if (sessionRef && user && isFirebaseConfigured && db) {
        const publicRef = doc(collection(db, 'publicSessions'), sessionToken);

        await Promise.all([
          setDoc(sessionRef, {
            ...sessionPayload,
            sessionToken,
            qrCodeData: qrData
          }),
          setDoc(publicRef, {
            sessionId,
            sessionPath: sessionRef.path,
            sessionToken,
            teacherId: user.uid,
            className: sessionPayload.className,
            subject: sessionPayload.subject,
            scheduledFor: sessionPayload.scheduledFor,
            durationMinutes: sessionPayload.durationMinutes,
            expectedAttendance: sessionPayload.expectedAttendance,
            location: formattedLocation,
            locationCoordinates: coordinates,
            status: sessionPayload.status,
            createdAt: serverTimestamp()
          })
        ]);
      }

      toast.success('Session prepared! Share the QR with your class.');
      onSessionCreated?.({
        id: sessionId,
        className: sessionPayload.className,
        subject: sessionPayload.subject,
        scheduledFor: sessionPayload.scheduledFor,
        location: formattedLocation,
        locationCoordinates: coordinates,
        status: 'scheduled',
        qrCodeData: qrData,
        sessionToken,
        expectedAttendance: sessionPayload.expectedAttendance,
        attendees: [],
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(error);
      toast.error(getSessionErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Launch a new session</h3>
            <p className="text-sm text-slate-500">Generate a QR code tied to this class to start marking attendance.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Class name</span>
            <input
              name="className"
              value={formState.className}
              onChange={handleChange}
              required
              placeholder="Grade 10 — Section A"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Subject</span>
            <input
              name="subject"
              value={formState.subject}
              onChange={handleChange}
              required
              placeholder="Mathematics"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              name="date"
              value={formState.date}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Start time</span>
            <input
              type="time"
              name="startTime"
              value={formState.startTime}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Duration (minutes)</span>
            <input
              type="number"
              min={10}
              max={180}
              step={5}
              name="durationMinutes"
              value={formState.durationMinutes}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Expected students</span>
            <input
              type="number"
              min={1}
              max={120}
              name="expectedAttendance"
              value={formState.expectedAttendance}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <div className="md:col-span-2 space-y-3 rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-slate-700">Location coordinates</span>
                <p className="text-xs text-slate-500">Capture your current GPS location to enforce the proximity barrier.</p>
              </div>
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={locationStatus === 'locating'}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-primary-400"
              >
                {locationStatus === 'locating' ? 'Capturing…' : 'Use current location'}
              </button>
            </div>
            {coordinates ? (
              <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold">
                  {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                </p>
                <p className="text-xs text-slate-500">
                  Accuracy ±{coordinates.accuracy?.toFixed(0) ?? '—'} meters • Captured {new Date(coordinates.capturedAt ?? Date.now()).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No coordinates captured yet.</p>
            )}
            {locationError ? <p className="text-sm text-rose-600">{locationError}</p> : null}
            <p className="text-xs text-slate-400">
              Tip: Allow location permissions in your browser. Coordinates are stored securely and only used for attendance validation.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            You can preview the QR code instantly. If Firebase is configured, the session will be saved to Firestore automatically.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-primary-400"
          >
            {isSubmitting ? 'Generating…' : 'Generate QR'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-dashed border-primary-200 bg-white p-6 text-center shadow-sm">
        <h4 className="text-lg font-semibold text-slate-900">QR preview</h4>
        <p className="mt-2 text-sm text-slate-500">Display this on the classroom screen for students to scan.</p>
        <div className="mt-6 flex items-center justify-center">
          {qrPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrPreview} alt="Generated session QR code" className="h-56 w-56 rounded-xl border border-slate-200 bg-white p-4 shadow" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs uppercase tracking-wide text-slate-400">Waiting for session details</span>
            </div>
          )}
        </div>
        {qrPreview ? (
          <p className="mt-4 text-xs text-slate-500">
            Tip: Save this QR code and project it when class begins. Students will still need to pass the location and device checks.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function getSessionErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'Permission denied when writing to Firestore. Update your security rules to allow teachers to create sessions.';
      case 'unauthenticated':
        return 'Your session expired. Sign in again and try creating the session once more.';
      case 'unavailable':
        return 'Firestore is temporarily unavailable. Please retry in a moment.';
      default:
        return error.message || 'Unable to create session. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message || 'Unable to create session. Please try again.';
  }

  return 'Unable to create session. Please try again.';
}
