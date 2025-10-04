'use client';

import { useEffect, useMemo, useState } from 'react';
import { Timestamp, doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';

export interface ClassAnalytics {
  classId: string;
  className: string;
  subject: string;
  averageAttendanceRate: number;
  totalStudents: number;
  dropoutRiskCount: number;
  failingStudentsCount: number;
  attendanceTrend: number[];
  updatedAt?: string;
}

export interface RiskStudent {
  studentId: string;
  name: string;
  className: string;
  attendanceRate: number;
  absences: number;
  riskLevel: 'low' | 'medium' | 'high';
  notes?: string | null;
}

export interface FailingStudent {
  studentId: string;
  name: string;
  className: string;
  averageGrade: number;
  missingAssignments: number;
  status: 'warning' | 'critical' | 'recovering';
}

export interface TeacherAnalytics {
  teacherId: string;
  updatedAt?: string;
  reportingPeriod?: string;
  averageAttendanceRate: number;
  dropoutRiskCount: number;
  failingStudentsCount: number;
  classes: ClassAnalytics[];
  dropoutRiskStudents: RiskStudent[];
  failingStudents: FailingStudent[];
}

const mockAnalytics: TeacherAnalytics = {
  teacherId: 'demo-teacher',
  updatedAt: new Date().toISOString(),
  reportingPeriod: new Date().toISOString(),
  averageAttendanceRate: 82,
  dropoutRiskCount: 3,
  failingStudentsCount: 3,
  classes: [
    {
      classId: 'class-1',
      className: 'Grade 10 — Section A',
      subject: 'Mathematics',
      averageAttendanceRate: 84,
      totalStudents: 32,
      dropoutRiskCount: 3,
      failingStudentsCount: 4,
      attendanceTrend: [88, 87, 85, 84, 82, 81, 80],
      updatedAt: new Date().toISOString()
    },
    {
      classId: 'class-2',
      className: 'Grade 12 — Section B',
      subject: 'Physics',
      averageAttendanceRate: 76,
      totalStudents: 28,
      dropoutRiskCount: 2,
      failingStudentsCount: 3,
      attendanceTrend: [82, 79, 78, 77, 76, 75, 73],
      updatedAt: new Date().toISOString()
    },
    {
      classId: 'class-3',
      className: 'Grade 11 — Section C',
      subject: 'Computer Science',
      averageAttendanceRate: 91,
      totalStudents: 30,
      dropoutRiskCount: 1,
      failingStudentsCount: 2,
      attendanceTrend: [93, 92, 92, 91, 91, 90, 90],
      updatedAt: new Date().toISOString()
    }
  ],
  dropoutRiskStudents: [
    {
      studentId: 'stu-1001',
      name: 'Ananya Patel',
      className: 'Grade 10 — Section A',
      attendanceRate: 62,
      absences: 14,
      riskLevel: 'high',
      notes: 'Missed the last three consecutive sessions.'
    },
    {
      studentId: 'stu-1023',
      name: 'Rahul Iyer',
      className: 'Grade 12 — Section B',
      attendanceRate: 68,
      absences: 11,
      riskLevel: 'medium',
      notes: 'Frequently absent on laboratory days.'
    },
    {
      studentId: 'stu-1098',
      name: 'Priya Sharma',
      className: 'Grade 11 — Section C',
      attendanceRate: 71,
      absences: 9,
      riskLevel: 'medium',
      notes: 'Needs follow-up from homeroom teacher.'
    }
  ],
  failingStudents: [
    {
      studentId: 'stu-1015',
      name: 'Karan Desai',
      className: 'Grade 10 — Section A',
      averageGrade: 54,
      missingAssignments: 5,
      status: 'critical'
    },
    {
      studentId: 'stu-1067',
      name: 'Meera Sood',
      className: 'Grade 12 — Section B',
      averageGrade: 58,
      missingAssignments: 3,
      status: 'warning'
    },
    {
      studentId: 'stu-1102',
      name: 'Arjun Malhotra',
      className: 'Grade 11 — Section C',
      averageGrade: 59,
      missingAssignments: 4,
      status: 'warning'
    }
  ]
};

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function toIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : fallback;
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeClassAnalytics(raw: unknown): ClassAnalytics | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  return {
  classId: toString(data.classId, generateId()),
    className: toString(data.className, 'Unknown class'),
    subject: toString(data.subject, 'Subject'),
    averageAttendanceRate: toNumber(data.averageAttendanceRate, 0),
    totalStudents: toNumber(data.totalStudents, 0),
    dropoutRiskCount: toNumber(data.dropoutRiskCount, 0),
    failingStudentsCount: toNumber(data.failingStudentsCount, 0),
    attendanceTrend: Array.isArray(data.attendanceTrend)
      ? (data.attendanceTrend as unknown[]).map((value) => toNumber(value, 0))
      : [],
    updatedAt: toIsoString(data.updatedAt)
  } satisfies ClassAnalytics;
}

function normalizeRiskStudent(raw: unknown): RiskStudent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const riskLevel = toString(data.riskLevel, 'low');
  const allowed: RiskStudent['riskLevel'][] = ['low', 'medium', 'high'];

  return {
  studentId: toString(data.studentId, generateId()),
    name: toString(data.name, 'Student'),
    className: toString(data.className, 'Class'),
    attendanceRate: toNumber(data.attendanceRate, 0),
    absences: toNumber(data.absences, 0),
    riskLevel: allowed.includes(riskLevel as RiskStudent['riskLevel'])
      ? (riskLevel as RiskStudent['riskLevel'])
      : 'low',
    notes: typeof data.notes === 'string' ? data.notes : null
  } satisfies RiskStudent;
}

function normalizeFailingStudent(raw: unknown): FailingStudent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const status = toString(data.status, 'warning');
  const allowed: FailingStudent['status'][] = ['warning', 'critical', 'recovering'];

  return {
  studentId: toString(data.studentId, generateId()),
    name: toString(data.name, 'Student'),
    className: toString(data.className, 'Class'),
    averageGrade: toNumber(data.averageGrade, 0),
    missingAssignments: toNumber(data.missingAssignments, 0),
    status: allowed.includes(status as FailingStudent['status'])
      ? (status as FailingStudent['status'])
      : 'warning'
  } satisfies FailingStudent;
}

function normalizeAnalytics(snapshotData: DocumentData | undefined, teacherId: string): TeacherAnalytics {
  if (!snapshotData) {
    return {
      ...mockAnalytics,
      teacherId
    } satisfies TeacherAnalytics;
  }

  const classesRaw = Array.isArray(snapshotData.classes) ? snapshotData.classes : [];
  const dropoutRiskRaw = Array.isArray(snapshotData.dropoutRiskStudents) ? snapshotData.dropoutRiskStudents : [];
  const failingStudentsRaw = Array.isArray(snapshotData.failingStudents) ? snapshotData.failingStudents : [];

  const classes = classesRaw
    .map((entry) => normalizeClassAnalytics(entry))
    .filter((entry): entry is ClassAnalytics => Boolean(entry));

  const dropoutRiskStudents = dropoutRiskRaw
    .map((entry) => normalizeRiskStudent(entry))
    .filter((entry): entry is RiskStudent => Boolean(entry));

  const failingStudents = failingStudentsRaw
    .map((entry) => normalizeFailingStudent(entry))
    .filter((entry): entry is FailingStudent => Boolean(entry));

  return {
    teacherId,
    updatedAt: toIsoString(snapshotData.updatedAt) ?? mockAnalytics.updatedAt,
    reportingPeriod: toIsoString(snapshotData.reportingPeriod) ?? mockAnalytics.reportingPeriod,
    averageAttendanceRate: toNumber(snapshotData.averageAttendanceRate, mockAnalytics.averageAttendanceRate),
    dropoutRiskCount: toNumber(snapshotData.dropoutRiskCount, dropoutRiskStudents.length),
    failingStudentsCount: toNumber(snapshotData.failingStudentsCount, failingStudents.length),
    classes: classes.length ? classes : mockAnalytics.classes,
    dropoutRiskStudents: dropoutRiskStudents.length ? dropoutRiskStudents : mockAnalytics.dropoutRiskStudents,
    failingStudents: failingStudents.length ? failingStudents : mockAnalytics.failingStudents
  } satisfies TeacherAnalytics;
}

export function useTeacherAnalytics(teacherId?: string) {
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId) {
      setAnalytics(mockAnalytics);
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured) {
      setAnalytics({ ...mockAnalytics, teacherId });
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(getFirestoreDb(), 'teacherAnalytics', teacherId),
      (snapshot) => {
        setAnalytics(normalizeAnalytics(snapshot.data(), teacherId));
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Failed to load teacher analytics', snapshotError);
        setError(snapshotError.message);
        setAnalytics({ ...mockAnalytics, teacherId });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teacherId]);

  const computedAnalytics = useMemo(() => analytics, [analytics]);

  return {
    analytics: computedAnalytics,
    loading,
    error
  };
}
