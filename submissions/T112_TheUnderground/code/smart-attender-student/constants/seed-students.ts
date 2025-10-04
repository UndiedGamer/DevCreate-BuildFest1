import { PROFILE_CLASS_ID } from '@/services/face-recognition';

export interface SeedStudentConfig {
  studentId: string;
  displayName: string;
  studentNumber: string;
  email: string;
  classId?: string;
  embeddingModule?: () => SeedEmbeddingFile;
  sampleAssets?: number[];
}

export interface SeedEmbeddingFile {
  studentId?: string;
  embeddings?: number[][];
  dimension?: number;
  numSamples?: number;
  samples?: string[];
}

export const FACE_DATASET_SEEDS: SeedStudentConfig[] = [
  {
    studentId: 'seed-student-a',
    displayName: 'Student A',
    studentNumber: 'S0000001',
    email: 'student.a@example.edu',
    classId: PROFILE_CLASS_ID,
    embeddingModule: () => require('../assets/seed-faces/embeddings/student-a.json')
  },
  {
    studentId: 'seed-student-b',
    displayName: 'Student B',
    studentNumber: 'S0000002',
    email: 'student.b@example.edu',
    classId: PROFILE_CLASS_ID,
    embeddingModule: () => require('../assets/seed-faces/embeddings/student-b.json')
  },
  {
    studentId: 'seed-student-c',
    displayName: 'Student C',
    studentNumber: 'S0000003',
    email: 'student.c@example.edu',
    classId: PROFILE_CLASS_ID,
    embeddingModule: () => require('../assets/seed-faces/embeddings/student-c.json')
  }
];
