import { Asset } from 'expo-asset';

import { FACE_DATASET_SEEDS, type SeedEmbeddingFile } from '@/constants/seed-students';
import {
  PROFILE_CLASS_ID,
  analyzeAndStoreFaceSample,
  getStoredSampleCount,
  seedFaceEmbeddings
} from '@/services/face-recognition';
import type { FaceEmbedding } from '@/services/face-recognition';

const SHOULD_SEED = /^(1|true|yes)$/i.test(String(process.env.EXPO_PUBLIC_ENABLE_FACE_SEEDS ?? ''));
let attempted = false;

export async function ensureFaceSeedsLoaded(): Promise<void> {
  if (!SHOULD_SEED || attempted || FACE_DATASET_SEEDS.length === 0) {
    return;
  }

  attempted = true;

  for (const seed of FACE_DATASET_SEEDS) {
    const targetClassId = seed.classId ?? PROFILE_CLASS_ID;
    const embeddingData = safeLoadEmbedding(seed.embeddingModule);
    const desiredSamples = getDesiredSampleCount(seed.sampleAssets, embeddingData);

    let existing = 0;

    try {
      existing = await getStoredSampleCount(seed.studentId, targetClassId);
      if (desiredSamples > 0 && existing >= desiredSamples) {
        continue;
      }
    } catch (error) {
      console.warn(`[face-seed] Unable to check existing samples for ${seed.studentId}`, error);
      continue;
    }

    if (embeddingData) {
      try {
        const embeddings = extractEmbeddings(embeddingData);
        if (embeddings.length) {
          const inserted = await seedFaceEmbeddings({
            studentId: seed.studentId,
            classId: targetClassId,
            embeddings,
            studentProfile: {
              displayName: seed.displayName,
              studentNumber: seed.studentNumber,
              email: seed.email,
              photoURL: null
            }
          });

          if (inserted > 0) {
            continue;
          }
        }
      } catch (error) {
        console.warn(`[face-seed] Failed to seed embeddings for ${seed.studentId}`, error);
      }
    }

    if (!seed.sampleAssets?.length) {
      continue;
    }

    const pendingSamples = seed.sampleAssets.slice(existing);

    for (const assetModule of pendingSamples) {
      try {
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        const localUri = asset.localUri ?? asset.uri;

        if (!localUri) {
          throw new Error('Unable to resolve asset location.');
        }

        await analyzeAndStoreFaceSample({
          imageUri: localUri,
          studentId: seed.studentId,
          classId: targetClassId,
          studentProfile: {
            displayName: seed.displayName,
            studentNumber: seed.studentNumber,
            email: seed.email,
            photoURL: null
          }
        });
      } catch (error) {
        console.warn(`[face-seed] Failed to seed face sample for ${seed.studentId}`, error);
      }
    }
  }
}

function safeLoadEmbedding(loader?: () => SeedEmbeddingFile): SeedEmbeddingFile | null {
  if (!loader) {
    return null;
  }

  try {
    return loader();
  } catch (error) {
    console.warn('[face-seed] Unable to load embedding module', error);
    return null;
  }
}

function extractEmbeddings(data: SeedEmbeddingFile): FaceEmbedding[] {
  if (!Array.isArray(data.embeddings) || data.embeddings.length === 0) {
    return [];
  }

  return data.embeddings
    .filter((row) => Array.isArray(row) && row.length > 0)
    .map((row) => row.map((value) => Number(value)));
}

function getDesiredSampleCount(sampleAssets: number[] | undefined, embeddingData: SeedEmbeddingFile | null): number {
  if (embeddingData && Array.isArray(embeddingData.embeddings)) {
    return embeddingData.embeddings.length;
  }

  return sampleAssets?.length ?? 0;
}
