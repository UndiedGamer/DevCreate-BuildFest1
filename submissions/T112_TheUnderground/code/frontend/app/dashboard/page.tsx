'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/AuthProvider';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { SessionCreator } from '@/components/dashboard/SessionCreator';
import { AttendanceFeed } from '@/components/dashboard/AttendanceFeed';
import { TaskRecommendations } from '@/components/dashboard/TaskRecommendations';
import {
  useTeacherSessions,
  type AttendanceSession,
  type SessionAttendee
} from '@/lib/hooks/useTeacherSessions';

export default function DashboardPage() {
  const { user } = useAuth();
  const { sessions, loading: sessionsLoading, metrics } = useTeacherSessions(user?.uid);
  const [localSessions, setLocalSessions] = useState<AttendanceSession[]>([]);

  const combinedSessions = useMemo(() => {
    const existingIds = new Set(localSessions.map((session: AttendanceSession) => session.id));
    const merged = [
      ...localSessions,
      ...sessions.filter((session: AttendanceSession) => !existingIds.has(session.id))
    ];
    return merged.sort(
      (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
    );
  }, [localSessions, sessions]);

  const upcomingCount = metrics.upcomingCount + localSessions.length;
  const averageAttendanceRate = metrics.averageAttendanceRate;
  const activeSession =
    metrics.activeSession ?? combinedSessions.find((session: AttendanceSession) => session.status === 'active');

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Smart Attender</p>
            <h1 className="text-2xl font-semibold text-slate-900">Teacher command center</h1>
            <p className="text-xs text-slate-500">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.displayName ?? 'Teacher'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <Link
              href="/dashboard/analytics"
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-primary-300 hover:text-primary-600 md:inline-flex"
            >
              View analytics
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        <OverviewCards
          upcomingCount={upcomingCount}
          averageAttendanceRate={averageAttendanceRate}
          activeSession={activeSession}
        />

        <SessionCreator
          onSessionCreated={(session: AttendanceSession) =>
            setLocalSessions((prev: AttendanceSession[]) => [session, ...prev])
          }
        />

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <AttendanceFeed sessions={combinedSessions} />
          <TaskRecommendations teacherId={user?.uid ?? undefined} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Recent sessions</h3>
          <p className="text-sm text-slate-500">Snapshot of the latest QR-powered attendance sessions.</p>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(sessionsLoading && combinedSessions.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Loading sessions…
                    </td>
                  </tr>
                )}
                {combinedSessions.map((session: AttendanceSession) => {
                  const presentCount = session.attendees.filter(
                    (attendee: SessionAttendee) => attendee.status === 'present'
                  ).length;
                  return (
                    <tr key={session.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{session.className}</td>
                      <td className="px-4 py-3 text-slate-600">{session.subject}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {format(new Date(session.scheduledFor), 'MMM d, h:mm a')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{session.location}</p>
                        {session.locationCoordinates?.accuracy ? (
                          <p className="text-xs text-slate-400">
                            ±{session.locationCoordinates.accuracy.toFixed(0)} m accuracy
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {presentCount}/{session.expectedAttendance}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700"
                        >
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!sessionsLoading && combinedSessions.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No sessions yet. Use the generator above to create your first attendance QR.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
