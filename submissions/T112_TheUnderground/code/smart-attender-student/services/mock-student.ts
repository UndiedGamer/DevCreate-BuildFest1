export interface MockStudentUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: 'demo';
  isMockUser: true;
}

export function createMockStudent(email: string): MockStudentUser {
  const normalized = email?.toLowerCase() ?? 'student@smart-attender.dev';
  const uidSeed = normalized.replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'student';
  return {
    uid: `mock-${uidSeed}`,
    email: normalized,
    displayName: normalized ? normalized.split('@')[0] : 'Demo Student',
    photoURL: null,
    providerId: 'demo',
    isMockUser: true
  };
}

export function isMockStudent(user: unknown): user is MockStudentUser {
  return Boolean(user && typeof user === 'object' && 'isMockUser' in user);
}
