'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, AlertTriangle, TrendingDown, Users } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { SignOutButton } from '@/components/auth/SignOutButton';
import {
  useTeacherAnalytics,
  type ClassAnalytics,
  type FailingStudent,
  type RiskStudent
} from '@/lib/hooks/useTeacherAnalytics';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { analytics, loading, error } = useTeacherAnalytics(user?.uid);

  const lastUpdatedLabel = analytics?.updatedAt
    ? format(new Date(analytics.updatedAt), 'MMM d, yyyy · h:mm a')
    : 'Not available';

  const metricCards = [
    {
      label: 'Average class attendance',
      value: analytics ? `${analytics.averageAttendanceRate}%` : '—',
      description: 'Weighted average across all active classes.',
      icon: Users,
      accent: 'bg-emerald-100 text-emerald-700'
    },
    {
      label: 'Drop-out risk candidates',
      value: analytics ? analytics.dropoutRiskCount.toString() : '—',
      description: 'Students with attendance below 75% in the last 30 days.',
      icon: AlertTriangle,
      accent: 'bg-amber-100 text-amber-700'
    },
    {
      label: 'Failing students',
      value: analytics ? analytics.failingStudentsCount.toString() : '—',
      description: 'Average grade currently below the passing threshold.',
      icon: TrendingDown,
      accent: 'bg-rose-100 text-rose-700'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-primary-300 hover:text-primary-600"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sessions
              </Link>
              <span className="text-xs text-slate-400">Analytics overview</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Student success analytics</h1>
            <p className="text-xs text-slate-500">Last updated {lastUpdatedLabel}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.displayName ?? 'Teacher'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
        {error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</h3>
                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${card.accent}`}>
                  <card.icon className="mr-1 h-3.5 w-3.5" />
                  Insight
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
              <p className="mt-2 text-xs text-slate-500">{card.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Class health snapshot</h2>
              <p className="text-sm text-slate-500">Attendance and academic risk distribution across your classes.</p>
            </div>
            <p className="text-xs text-slate-400">Showing {analytics?.classes.length ?? 0} classes</p>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Avg attendance</th>
                  <th className="px-4 py-3">Drop-out risks</th>
                  <th className="px-4 py-3">Failing</th>
                  <th className="px-4 py-3">Last 7 sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && !analytics ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Loading analytics…
                    </td>
                  </tr>
                ) : null}
                {(analytics?.classes ?? []).map((classInfo: ClassAnalytics) => (
                  <tr key={classInfo.classId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{classInfo.className}</td>
                    <td className="px-4 py-3 text-slate-600">{classInfo.subject}</td>
                    <td className="px-4 py-3 text-slate-600">{classInfo.averageAttendanceRate}%</td>
                    <td className="px-4 py-3 text-slate-600">{classInfo.dropoutRiskCount}</td>
                    <td className="px-4 py-3 text-slate-600">{classInfo.failingStudentsCount}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        {(classInfo.attendanceTrend ?? []).map((value, index) => (
                          <span
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] ${
                              value >= classInfo.averageAttendanceRate ? 'border-emerald-200 text-emerald-600' : 'border-rose-200 text-rose-600'
                            }`}
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && (analytics?.classes?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No class analytics available yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Drop-out risk students</h2>
                <p className="text-sm text-slate-500">Prioritise interventions for students with low attendance.</p>
              </div>
              <p className="text-xs text-slate-400">{analytics?.dropoutRiskStudents.length ?? 0} flagged</p>
            </div>

            <div className="mt-4 space-y-3">
              {(analytics?.dropoutRiskStudents ?? []).map((student: RiskStudent) => (
                <article key={student.studentId} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{student.name}</h3>
                      <p className="text-xs text-slate-500">{student.className}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        student.riskLevel === 'high'
                          ? 'bg-rose-100 text-rose-700'
                          : student.riskLevel === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {student.riskLevel} risk
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-600">
                    <div>
                      <dt className="font-semibold text-slate-500">Attendance</dt>
                      <dd>{student.attendanceRate}%</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Absences</dt>
                      <dd>{student.absences}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Notes</dt>
                      <dd className="text-[11px] text-slate-500">{student.notes ?? 'No notes recorded.'}</dd>
                    </div>
                  </dl>
                </article>
              ))}

              {!loading && (analytics?.dropoutRiskStudents?.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No students are currently flagged for drop-out risk. Great job!
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Failing students</h2>
                <p className="text-sm text-slate-500">Track students below the passing threshold and follow up.</p>
              </div>
              <p className="text-xs text-slate-400">{analytics?.failingStudents.length ?? 0} flagged</p>
            </div>

            <div className="mt-4 space-y-3">
              {(analytics?.failingStudents ?? []).map((student: FailingStudent) => (
                <article key={student.studentId} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{student.name}</h3>
                      <p className="text-xs text-slate-500">{student.className}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        student.status === 'critical'
                          ? 'bg-rose-200 text-rose-900'
                          : student.status === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {student.status}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <dt className="font-semibold text-slate-500">Average grade</dt>
                      <dd>{student.averageGrade}%</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-500">Missing assignments</dt>
                      <dd>{student.missingAssignments}</dd>
                    </div>
                  </dl>
                </article>
              ))}

              {!loading && (analytics?.failingStudents?.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No failing students detected right now. Keep supporting your learners!
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
