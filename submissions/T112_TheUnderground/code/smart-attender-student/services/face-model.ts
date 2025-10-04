import '@/lib/tf-polyfill';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import {
  SupportedModels,
  createDetector,
  type FaceLandmarksDetector,
  type Keypoint
} from '@tensorflow-models/face-landmarks-detection';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';

let modelPromise: Promise<FaceLandmarksDetector> | null = null;

async function loadModel(): Promise<FaceLandmarksDetector> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await tf.ready();

      const desiredBackend = Platform.OS === 'web' ? 'webgl' : 'rn-webgl';
      if (tf.getBackend() !== desiredBackend && tf.findBackend(desiredBackend)) {
        try {
          await tf.setBackend(desiredBackend);
        } catch (error) {
          console.warn(`Unable to set ${desiredBackend} backend, continuing with`, tf.getBackend(), error);
        }
      }

      return createDetector(SupportedModels.MediaPipeFaceMesh, {
        runtime: 'tfjs',
        refineLandmarks: true,
        maxFaces: 1
      });
    })();
  }

  return modelPromise;
}

export async function generateFaceEmbeddingFromBase64(base64: string): Promise<number[]> {
  if (!base64) {
    throw new Error('Image data missing.');
  }

  const model = await loadModel();
  const bytes = decodeBase64(base64);
  const imageTensor = decodeJpeg(bytes, 3);
  const targetSizes: Array<[number, number]> = [
    [192, 192],
    [224, 224],
    [256, 256]
  ];
  const normalizationScalar = tf.scalar(255);

  try {
    for (const size of targetSizes) {
      const resized = tf.image.resizeBilinear(imageTensor, size) as tf.Tensor3D;
      const floatTensor = resized.toFloat();
      const normalized = floatTensor.div(normalizationScalar) as tf.Tensor3D;

      try {
        const faces = await model.estimateFaces(normalized, { flipHorizontal: true });

        if (faces.length && faces[0].keypoints.length) {
          const embedding = buildEmbedding(faces[0].keypoints);
          return embedding.map((value) => round(value));
        }
      } finally {
        tf.dispose([resized, floatTensor, normalized]);
      }
    }

    throw new Error('No face detected in frame.');
  } finally {
    tf.dispose([imageTensor, normalizationScalar]);
  }
}

function buildEmbedding(keypoints: Keypoint[]): number[] {
  const points = keypoints.map((point) => [point.x, point.y, point.z ?? 0]);
  const centroid = [0, 1, 2].map((index) => average(points.map((coords) => coords[index])));
  const ranges = [0, 1, 2].map((index) => {
    const values = points.map((coords) => coords[index]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return range === 0 ? 1 : range;
  });

  const normalized = points.flatMap((coords) =>
    coords.map((value, index) => (value - centroid[index]) / ranges[index])
  );

  return normalizeVector(normalized);
}

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => value / magnitude);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function decodeBase64(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(normalized, 'base64'));
}
