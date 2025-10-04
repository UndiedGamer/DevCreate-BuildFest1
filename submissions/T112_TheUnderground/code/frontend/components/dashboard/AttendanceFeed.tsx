'use client';

import { Fragment } from 'react';
import { CheckCircle2, CircleAlert, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { AttendanceSession, SessionAttendee } from '@/lib/hooks/useTeacherSessions';

interface AttendanceFeedProps {
  sessions: AttendanceSession[];
}

export function AttendanceFeed({ sessions }: AttendanceFeedProps) {
  const recentEvents = sessions
    .flatMap((session) =>
      session.attendees.map((attendee: SessionAttendee) => ({
        ...attendee,
        sessionSubject: session.subject,
        sessionId: session.id,
        scannedAt: attendee.scannedAt ?? session.scheduledFor
      }))
    )
    .sort((a, b) => new Date(b.scannedAt ?? 0).getTime() - new Date(a.scannedAt ?? 0).getTime())
    .slice(0, 10);

  if (recentEvents.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">No scans yet. Launch a session and the feed will populate instantly.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Live attendance feed</h3>
      <p className="text-sm text-slate-500">Most recent face scans, proximity checks, and flags.</p>

      <div className="mt-4 space-y-3">
        {recentEvents.map((event) => {
          const icon =
            event.status === 'present' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : event.status === 'flagged' ? (
              <CircleAlert className="h-5 w-5 text-amber-500" />
            ) : (
              <Clock className="h-5 w-5 text-slate-400" />
            );

          return (
            <Fragment key={`${event.sessionId}-${event.id}`}>
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 px-4 py-3">
                <div>{icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{event.name}</p>
                  <p className="text-xs text-slate-500">{event.sessionSubject}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>{formatDistanceToNow(new Date(event.scannedAt ?? Date.now()), { addSuffix: true })}</p>
                  {event.proximityMeters != null ? (
                    <p className={clsx('font-medium', event.proximityMeters <= 10 ? 'text-emerald-600' : 'text-amber-600')}>
                      {event.proximityMeters.toFixed(1)} m
                    </p>
                  ) : null}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
