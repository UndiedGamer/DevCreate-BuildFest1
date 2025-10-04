import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Buffer } from 'buffer';

import { generateFaceEmbeddingFromBase64 } from '@/services/face-model';

export type FaceEmbedding = number[];
const STORAGE_KEY = 'smart-attender-face-model/v2';
const FALLBACK_FEATURE_VECTOR_LENGTH = 128;
const FACE_VERIFICATION_THRESHOLD = Number(process.env.EXPO_PUBLIC_FACE_THRESHOLD ?? 0.12);
const MAX_SAMPLES_PER_STUDENT = 10;
export const PROFILE_BASELINE_SAMPLE_TARGET = Math.max(
  1,
  Number(process.env.EXPO_PUBLIC_FACE_BASELINE_SAMPLES ?? 3)
);
export const PROFILE_CLASS_ID = '__profile__';

export interface StudentProfileInput {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  studentNumber?: string | null;
}

export interface StoredStudentProfile {
  studentId: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  studentNumber?: string | null;
  registeredAt: string;
  updatedAt: string;
  lastClassId?: string;
}

export interface StoredFaceSample {
  studentId: string;
  classId: string;
  embedding: FaceEmbedding;
  capturedAt: string;
  thumbnailBase64?: string;
}

interface FaceModelDataset {
  samples: StoredFaceSample[];
  students: Record<string, StoredStudentProfile>;
}

interface EmbeddingResult {
  embedding: FaceEmbedding;
  previewBase64: string;
}

export interface FaceAnalysisResult {
  verified: boolean;
  distance: number | null;
  samplesForStudent: number;
  enrolled: boolean;
  profileSaved: boolean;
  previewBase64?: string;
}

export async function seedFaceEmbeddings(params: {
  studentId: string;
  classId: string;
  embeddings: FaceEmbedding[];
  studentProfile?: StudentProfileInput;
}): Promise<number> {
  const { studentId, classId, embeddings, studentProfile } = params;

  if (!embeddings.length) {
    return 0;
  }

  const expectedDimension = embeddings[0].length;
  const validEmbeddings = embeddings.filter((embedding) => embedding.length === expectedDimension && embedding.length > 0);

  if (!validEmbeddings.length) {
    return 0;
  }

  const dataset = await loadDataset();

  dataset.samples = dataset.samples.filter(
    (sample) => !(sample.studentId === studentId && sample.classId === classId)
  );

  const nextSamples = truncateSamples(
    validEmbeddings.map((embedding) =>
      createSample({ studentId, classId, embedding })
    )
  );

  dataset.samples.push(...nextSamples);

  if (studentProfile) {
    upsertStudentProfile(dataset, {
      studentId,
      classId,
      details: studentProfile
    });
  }

  await saveDataset(dataset);
  return nextSamples.length;
}

export async function analyzeAndStoreFaceSample(params: {
  imageUri: string;
  studentId: string;
  classId: string;
  studentProfile?: StudentProfileInput;
}): Promise<FaceAnalysisResult> {
  const { imageUri, studentId, classId, studentProfile } = params;

  const { embedding, previewBase64 } = await generateImageEmbedding(imageUri);
  const dataset = await loadDataset();
  const expectedDimension = embedding.length;

  if (!expectedDimension) {
    throw new Error('Received invalid embedding data. Please try capturing again.');
  }

  const invalidSamples = dataset.samples.filter(
    (sample) => sample.studentId === studentId && sample.embedding.length !== expectedDimension
  );

  if (invalidSamples.length) {
    const invalidSet = new Set(invalidSamples);
    dataset.samples = dataset.samples.filter((sample) => !invalidSet.has(sample));
    console.warn(
      `Removed ${invalidSamples.length} mismatched face sample(s) for student ${studentId} due to dimension change.`
    );
  }

  const isProfileCapture = classId === PROFILE_CLASS_ID;
  const existingSamples = dataset.samples.filter(
    (sample) => sample.studentId === studentId && sample.classId === classId
  );

  const fallbackProfileSamples = !isProfileCapture
    ? dataset.samples
        .filter((sample) => sample.studentId === studentId && sample.classId === PROFILE_CLASS_ID)
        .slice(-MAX_SAMPLES_PER_STUDENT)
        .map((sample) => ({ ...sample, classId }))
    : [];

  const seededSamples = existingSamples.length > 0 ? existingSamples : fallbackProfileSamples;

  let verified = true;
  let distance: number | null = null;
  const enrolled = seededSamples.length === 0;

  if (!enrolled) {
    const centroid = computeCentroid(seededSamples.map((sample) => sample.embedding));
    distance = euclideanDistance(embedding, centroid);
    verified = distance <= FACE_VERIFICATION_THRESHOLD;
  }

  const nextSamples = truncateSamples([
    ...seededSamples,
    createSample({ studentId, classId, embedding, previewBase64 })
  ]);

  dataset.samples = dataset.samples.filter(
    (sample) => !(sample.studentId === studentId && sample.classId === classId)
  );
  dataset.samples.push(...nextSamples);

  const profileSaved = upsertStudentProfile(dataset, {
    studentId,
    classId,
    details: studentProfile
  });

  await saveDataset(dataset);

  return {
    verified,
    distance,
    samplesForStudent: nextSamples.length,
    enrolled,
    profileSaved,
    previewBase64
  };
}

export async function getStoredSampleCount(studentId: string, classId: string): Promise<number> {
  const dataset = await loadDataset();
  const matches = dataset.samples.filter(
    (sample) => sample.studentId === studentId && (sample.classId === classId || sample.classId === PROFILE_CLASS_ID)
  );

  if (!matches.length) {
    return 0;
  }

  const hasClassSamples = matches.some((sample) => sample.classId === classId);
  if (hasClassSamples) {
    return matches.filter((sample) => sample.classId === classId).length;
  }

  return matches.length;
}

export async function getStoredStudentProfile(studentId: string): Promise<StoredStudentProfile | undefined> {
  const dataset = await loadDataset();
  return dataset.students[studentId];
}

export async function getStoredFaceSamples(studentId: string, classId?: string): Promise<StoredFaceSample[]> {
  const dataset = await loadDataset();
  return dataset.samples.filter((sample) => {
    if (sample.studentId !== studentId) {
      return false;
    }

    if (classId && sample.classId !== classId) {
      return false;
    }

    return true;
  });
}

export async function clearSamplesForStudent(studentId: string): Promise<void> {
  const dataset = await loadDataset();
  dataset.samples = dataset.samples.filter((sample) => sample.studentId !== studentId);
  delete dataset.students[studentId];
  await saveDataset(dataset);
}

async function generateImageEmbedding(imageUri: string): Promise<EmbeddingResult> {
  const manipulated = await manipulateAsync(
    imageUri,
    [{ resize: { width: 192, height: 192 } }],
    {
      compress: 0.5,
      format: SaveFormat.JPEG,
      base64: true
    }
  );

  if (!manipulated.base64) {
    throw new Error('Unable to read captured image. Please try again.');
  }

  const bytes = decodeBase64ToBytes(manipulated.base64);

  if (!bytes.length) {
    throw new Error('Captured image data is empty. Try retaking the photo.');
  }

  let embedding: FaceEmbedding;

  try {
    embedding = await generateFaceEmbeddingFromBase64(manipulated.base64);

    if (!embedding.length) {
      throw new Error('Received empty embedding from model');
    }
  } catch (error) {
    console.warn('Falling back to heuristic face embedding', error);
    embedding = bucketise(bytes, FALLBACK_FEATURE_VECTOR_LENGTH);
  }

  return {
    embedding,
    previewBase64: manipulated.base64
  };
}

function bucketise(bytes: Uint8Array, vectorLength: number): FaceEmbedding {
  if (!bytes.length) {
    throw new Error('No bytes to process.');
  }

  const bucketSize = Math.ceil(bytes.length / vectorLength);
  const embedding: FaceEmbedding = [];

  for (let bucket = 0; bucket < vectorLength; bucket += 1) {
    const start = bucket * bucketSize;
    const end = Math.min(start + bucketSize, bytes.length);

    if (start >= end) {
      break;
    }

    let sum = 0;
    for (let index = start; index < end; index += 1) {
      sum += bytes[index];
    }

    const average = sum / (end - start);
    embedding.push(round(average / 255));
  }

  if (!embedding.length) {
    throw new Error('Failed to derive facial signature. Please retry.');
  }

  return normalizeVector(embedding);
}

function normalizeVector(vector: FaceEmbedding): FaceEmbedding {
  const magnitude = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0));
  if (magnitude === 0) {
    return vector.map(() => 0);
  }

  return vector.map((value) => round(value / magnitude));
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  try {
    const normalized = base64.replace(/\s/g, '');
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(normalized);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }
      return buffer;
    }

    return Uint8Array.from(Buffer.from(normalized, 'base64'));
  } catch (error) {
    console.warn('Failed to decode base64 image data', error);
    return new Uint8Array();
  }
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function computeCentroid(vectors: FaceEmbedding[]): FaceEmbedding {
  if (!vectors.length) {
    throw new Error('No vectors to average.');
  }

  const dimension = vectors[0].length;
  const centroid = new Array<number>(dimension).fill(0);

  vectors.forEach((vector) => {
    if (vector.length !== dimension) {
      throw new Error('Mismatched embedding dimensions detected.');
    }

    vector.forEach((value, index) => {
      centroid[index] += value;
    });
  });

  return centroid.map((value) => value / vectors.length);
}

function euclideanDistance(a: FaceEmbedding, b: FaceEmbedding): number {
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }

  const sum = a.reduce((acc, value, index) => {
    const diff = value - b[index];
    return acc + diff * diff;
  }, 0);

  return Math.sqrt(sum);
}

function truncateSamples(samples: StoredFaceSample[]): StoredFaceSample[] {
  if (samples.length <= MAX_SAMPLES_PER_STUDENT) {
    return samples;
  }

  return samples.slice(samples.length - MAX_SAMPLES_PER_STUDENT);
}

function createSample(params: {
  studentId: string;
  classId: string;
  embedding: FaceEmbedding;
  previewBase64?: string;
}): StoredFaceSample {
  return {
    studentId: params.studentId,
    classId: params.classId,
    embedding: params.embedding,
    capturedAt: new Date().toISOString(),
    thumbnailBase64: params.previewBase64
  };
}

function upsertStudentProfile(
  dataset: FaceModelDataset,
  params: { studentId: string; classId: string; details?: StudentProfileInput }
): boolean {
  const existing = dataset.students[params.studentId];
  const registeredAt = existing?.registeredAt ?? new Date().toISOString();
  const nextProfile: StoredStudentProfile = {
    studentId: params.studentId,
    displayName: params.details?.displayName ?? existing?.displayName ?? null,
    email: params.details?.email ?? existing?.email ?? null,
    photoURL: params.details?.photoURL ?? existing?.photoURL ?? null,
    studentNumber: params.details?.studentNumber ?? existing?.studentNumber ?? null,
    registeredAt,
    updatedAt: new Date().toISOString(),
    lastClassId: params.classId
  };

  dataset.students[params.studentId] = nextProfile;
  return true;
}

async function loadDataset(): Promise<FaceModelDataset> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { samples: [], students: {} };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FaceModelDataset> & { samples?: unknown; students?: unknown };

    const samples = Array.isArray(parsed.samples)
      ? parsed.samples.filter((sample): sample is StoredFaceSample => {
          return (
            typeof sample === 'object' &&
            sample !== null &&
            typeof (sample as StoredFaceSample).studentId === 'string' &&
            typeof (sample as StoredFaceSample).classId === 'string' &&
            Array.isArray((sample as StoredFaceSample).embedding)
          );
        })
      : [];

    const studentsSource = parsed.students && typeof parsed.students === 'object' ? (parsed.students as Record<string, unknown>) : {};
    const students: Record<string, StoredStudentProfile> = {};

    Object.entries(studentsSource).forEach(([studentId, value]) => {
      if (!value || typeof value !== 'object') {
        return;
      }

      students[studentId] = sanitizeProfile(studentId, value as Record<string, unknown>);
    });

    return {
      samples,
      students
    };
  } catch (error) {
    console.warn('Failed to parse face dataset. Reinitialising.', error);
    return { samples: [], students: {} };
  }
}

async function saveDataset(dataset: FaceModelDataset): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
}

function sanitizeProfile(studentId: string, raw: Record<string, unknown>): StoredStudentProfile {
  const registeredAt = typeof raw.registeredAt === 'string' ? raw.registeredAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : registeredAt;

  return {
    studentId,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : null,
    email: typeof raw.email === 'string' ? raw.email : null,
    photoURL: typeof raw.photoURL === 'string' ? raw.photoURL : null,
    studentNumber: typeof raw.studentNumber === 'string' ? raw.studentNumber : null,
    registeredAt,
    updatedAt,
    lastClassId: typeof raw.lastClassId === 'string' ? raw.lastClassId : undefined
  };
}
