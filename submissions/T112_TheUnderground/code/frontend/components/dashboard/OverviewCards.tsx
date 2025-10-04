'use client';

import { Activity, CalendarCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { AttendanceSession } from '@/lib/hooks/useTeacherSessions';

interface OverviewCardsProps {
  upcomingCount: number;
  averageAttendanceRate: number;
  activeSession?: AttendanceSession;
}

export function OverviewCards({ upcomingCount, averageAttendanceRate, activeSession }: OverviewCardsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming sessions</span>
          <CalendarCheck className="h-5 w-5 text-primary-600" />
        </div>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{upcomingCount}</p>
        <p className="mt-2 text-sm text-slate-500">Scheduled within the next 24 hours</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Average attendance</span>
          <Activity className="h-5 w-5 text-primary-600" />
        </div>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{averageAttendanceRate}%</p>
        <p className="mt-2 text-sm text-slate-500">Across the last 15 sessions</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {activeSession ? 'Active right now' : 'Next action'}
          </span>
          <Clock className={clsx('h-5 w-5', activeSession ? 'text-emerald-500' : 'text-primary-600')} />
        </div>
        {activeSession ? (
          <div className="mt-4 space-y-1 text-slate-900">
            <p className="text-xl font-semibold">{activeSession.subject}</p>
            <p className="text-sm text-slate-500">{activeSession.className}</p>
            <p className="text-sm text-slate-500">
              Started at {format(new Date(activeSession.scheduledFor), 'h:mm a')} • {activeSession.attendees.length} scanned
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No session is live. Launch a new one to start tracking attendance.</p>
        )}
      </div>
    </div>
  );
}
