#!/usr/bin/env bun

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { initializeApp, cert, type AppOptions } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type SeedOptions = {
  teacherId: string;
  teacherName: string;
  className: string;
  subject: string;
  skipSession: boolean;
  sessionId?: string;
  location?: string;
};

type ParsedArgs = Partial<SeedOptions> & {
  help?: boolean;
  serviceAccountPath?: string;
};

const DEFAULTS: SeedOptions = {
  teacherId: '',
  teacherName: 'Demo Teacher',
  className: 'Grade 10 — Section A',
  subject: 'Mathematics',
  skipSession: false,
  sessionId: undefined,
  location: '0,0'
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

function generateSecureId(): string {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }

  const segment = () => Math.random().toString(36).slice(2, 10);
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];

    switch (key) {
      case 'teacher':
        parsed.teacherId = next;
        index += 1;
        break;
      case 'name':
        parsed.teacherName = next;
        index += 1;
        break;
      case 'class':
        parsed.className = next;
        index += 1;
        break;
      case 'subject':
        parsed.subject = next;
        index += 1;
        break;
      case 'session-id':
        parsed.sessionId = next;
        index += 1;
        break;
      case 'location':
        parsed.location = next;
        index += 1;
        break;
      case 'service-account':
        parsed.serviceAccountPath = next;
        index += 1;
        break;
      case 'skip-session':
        parsed.skipSession = true;
        break;
      case 'help':
      case 'h':
        parsed.help = true;
        break;
      default:
        console.warn(`Ignoring unknown flag --${key}`);
        break;
    }
  }

  return parsed;
}

function printUsage(): void {
  console.log(`Create the core Firestore structure for smart-attender.

Usage:
  bun scripts/seed-firestore.ts --teacher <firebase-uid> [options]

Options:
  --teacher <id>           Firebase Auth UID for the teacher document (required)
  --name <full name>       Teacher display name (default: "${DEFAULTS.teacherName}")
  --class <label>          Class name for the sample session (default: "${DEFAULTS.className}")
  --subject <label>        Subject for the sample session (default: "${DEFAULTS.subject}")
  --location <lat,lng>     Comma-separated coordinates stored on the sample session (default: ${DEFAULTS.location})
  --session-id <id>        Explicit ID for the sample session document (default: auto-generated)
  --skip-session           Only create the teacher document; do not seed a session
  --service-account <path> Path to service account JSON (defaults to FIREBASE_SERVICE_ACCOUNT_PATH or repo lookup)
  --help                   Show this message
`);
}

function coerceOptions(parsed: ParsedArgs): SeedOptions {
  if (parsed.help) {
    printUsage();
    process.exit(0);
  }

  if (!parsed.teacherId) {
    printUsage();
    throw new Error('Missing required flag: --teacher <firebase-uid>');
  }

  const merged: SeedOptions = {
    ...DEFAULTS,
    ...parsed,
    teacherId: parsed.teacherId
  };

  return merged;
}

function detectServiceAccount(explicitPath?: string): string {
  if (explicitPath) {
    const resolved = resolve(process.cwd(), explicitPath);
    if (!existsSync(resolved)) {
      throw new Error(`Service account file not found at ${resolved}`);
    }
    return resolved;
  }

  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (envPath) {
    const resolved = resolve(process.cwd(), envPath);
    if (!existsSync(resolved)) {
      throw new Error(`Service account file from FIREBASE_SERVICE_ACCOUNT_PATH not found at ${resolved}`);
    }
    return resolved;
  }

  const candidates = readdirSync(repoRoot).filter((file) => file.includes('firebase-adminsdk') && file.endsWith('.json'));
  if (candidates.length === 0) {
    throw new Error('No service account JSON found. Set FIREBASE_SERVICE_ACCOUNT_PATH or pass --service-account <path>.');
  }

  const chosen = resolve(repoRoot, candidates[0]);
  console.log(`Using service account file: ${chosen}`);
  return chosen;
}

function buildSessionDocuments(options: SeedOptions, sessionId: string, sessionToken: string) {
  const [latitudeRaw, longitudeRaw] = (options.location ?? DEFAULTS.location ?? '0,0').split(',');
  const latitude = Number(latitudeRaw ?? '0');
  const longitude = Number(longitudeRaw ?? '0');

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error(`Invalid --location value: ${options.location}. Expected format is "lat,lng"`);
  }

  const now = new Date();
  const scheduledFor = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

  const locationCoordinates = {
    latitude,
    longitude,
    accuracy: null,
    capturedAt: now.toISOString()
  } as const;

  const qrData = JSON.stringify({
    sessionId,
    sessionToken,
    className: options.className,
    subject: options.subject,
    scheduledFor: scheduledFor.toISOString(),
    teacherId: options.teacherId,
    durationMinutes: 45,
    locationCoordinates
  });

  const sessionDoc = {
    sessionId,
    className: options.className,
    subject: options.subject,
    scheduledFor: scheduledFor.toISOString(),
    location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    locationCoordinates,
    durationMinutes: 45,
    status: 'scheduled',
    expectedAttendance: 30,
    attendees: [],
  sessionToken,
  qrCodeData: qrData,
    createdAt: FieldValue.serverTimestamp()
  };

  const publicDoc = {
    sessionId,
    sessionToken,
    sessionPath: `teachers/${options.teacherId}/sessions/${sessionId}`,
    teacherId: options.teacherId,
    className: options.className,
    subject: options.subject,
    scheduledFor: scheduledFor.toISOString(),
    durationMinutes: 45,
    expectedAttendance: 30,
    status: 'scheduled',
    location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    locationCoordinates,
    createdAt: FieldValue.serverTimestamp()
  };

  return {
    sessionDoc,
    publicDoc
  };
}

function buildAnalyticsPayload(options: SeedOptions) {
  const now = new Date();
  const baseClassName = options.className ?? DEFAULTS.className;
  const currentIso = now.toISOString();

  const classes = [
    {
      classId: 'class-1',
      className: baseClassName,
      subject: options.subject ?? DEFAULTS.subject,
      averageAttendanceRate: 84,
      totalStudents: 32,
      dropoutRiskCount: 3,
      failingStudentsCount: 4,
      attendanceTrend: [88, 86, 85, 82, 84, 81, 79],
      updatedAt: currentIso
    },
    {
      classId: 'class-2',
      className: 'Grade 12 — Section B',
      subject: 'Physics',
      averageAttendanceRate: 76,
      totalStudents: 28,
      dropoutRiskCount: 2,
      failingStudentsCount: 3,
      attendanceTrend: [82, 80, 78, 77, 76, 74, 73],
      updatedAt: currentIso
    },
    {
      classId: 'class-3',
      className: 'Grade 11 — Section C',
      subject: 'Computer Science',
      averageAttendanceRate: 91,
      totalStudents: 30,
      dropoutRiskCount: 1,
      failingStudentsCount: 2,
      attendanceTrend: [93, 92, 91, 90, 92, 91, 91],
      updatedAt: currentIso
    }
  ];

  const dropoutRiskStudents = [
    {
      studentId: 'stu-1001',
      name: 'Ananya Patel',
      className: baseClassName,
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
  ];

  const failingStudents = [
    {
      studentId: 'stu-1015',
      name: 'Karan Desai',
      className: baseClassName,
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
  ];

  const averageAttendanceRate = Math.round(
    classes.reduce((sum, entry) => sum + entry.averageAttendanceRate, 0) / classes.length
  );

  return {
    teacherId: options.teacherId,
    updatedAt: FieldValue.serverTimestamp(),
    averageAttendanceRate,
    dropoutRiskCount: dropoutRiskStudents.length,
    failingStudentsCount: failingStudents.length,
    reportingPeriod: currentIso,
    classes,
    dropoutRiskStudents,
    failingStudents
  };
}

async function seed(options: SeedOptions, serviceAccountPath: string): Promise<void> {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

  const appOptions: AppOptions = {
    credential: cert(serviceAccount as Record<string, unknown>),
    projectId: (serviceAccount as { project_id?: string }).project_id
  };

  initializeApp(appOptions);

  const db = getFirestore();
  const teacherRef = db.collection('teachers').doc(options.teacherId);

  console.log(`\nCreating teacher document for ${options.teacherId}...`);
  await teacherRef.set(
    {
      displayName: options.teacherName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  if (!options.skipSession) {
    const sessionId = options.sessionId ?? teacherRef.collection('sessions').doc().id;
    const sessionToken = generateSecureId().replace(/-/g, '');
    const sessionRef = teacherRef.collection('sessions').doc(sessionId);
    const { sessionDoc, publicDoc } = buildSessionDocuments(options, sessionId, sessionToken);

    console.log(`Seeding session document at teachers/${options.teacherId}/sessions/${sessionRef.id}...`);
    await sessionRef.set(sessionDoc, { merge: true });

    console.log(`Publishing public session token at publicSessions/${sessionToken}...`);
    await db.collection('publicSessions').doc(sessionToken).set(publicDoc, { merge: true });
  }

  console.log(`Seeding analytics snapshot for teacher ${options.teacherId}...`);
  const analyticsPayload = buildAnalyticsPayload(options);
  await db.collection('teacherAnalytics').doc(options.teacherId).set(analyticsPayload, { merge: true });

  console.log('\nFirestore seed completed successfully.');
}

async function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    const options = coerceOptions(parsed);
    const serviceAccountPath = detectServiceAccount(parsed.serviceAccountPath);
    await seed(options, serviceAccountPath);
  } catch (error) {
    console.error('\nFailed to seed Firestore:');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

void main();
