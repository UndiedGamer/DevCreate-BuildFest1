const MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export interface TaskRecommendationRaw {
  id?: string;
  title?: string;
  description?: string;
  focusArea?: string;
  gradeLevel?: string;
  duration?: string;
}

export interface TaskRecommendation {
  id: string;
  title: string;
  description: string;
  focusArea: string;
  gradeLevel: string;
  duration: string;
}

const DEFAULT_GENERATION_CONFIG = {
  temperature: 0.4,
  topP: 0.8,
  maxOutputTokens: 256
};

function normalizeTask(task: TaskRecommendationRaw, index: number): TaskRecommendation | null {
  if (!task || typeof task !== 'object') {
    return null;
  }

  const coerce = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

  const focusArea = coerce(task.focusArea, 'concept-reinforcement');
  const allowedFocus = new Set(['concept-reinforcement', 'skills-practice', 'career-exposure']);
  const normalizedFocus = allowedFocus.has(focusArea) ? focusArea : 'concept-reinforcement';

  return {
    id: coerce(task.id, `task-${index + 1}`),
    title: coerce(task.title, 'Quick practice task'),
    description: coerce(task.description, 'Short targeted activity.'),
    focusArea: normalizedFocus,
    gradeLevel: coerce(task.gradeLevel, 'Grade 10'),
    duration: coerce(task.duration, '15 min')
  } satisfies TaskRecommendation;
}

interface GeminiTaskRequestOptions {
  prompt: string;
  apiKey: string;
  maxTasks?: number;
  generationConfig?: Partial<typeof DEFAULT_GENERATION_CONFIG>;
}

export async function requestGeminiTasks({
  prompt,
  apiKey,
  maxTasks = 3,
  generationConfig
}: GeminiTaskRequestOptions): Promise<TaskRecommendation[]> {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: { ...DEFAULT_GENERATION_CONFIG, ...generationConfig }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText} — ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const textOutput = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!textOutput) {
    return [];
  }

  try {
    const parsed = JSON.parse(textOutput) as TaskRecommendationRaw[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .slice(0, Math.max(0, maxTasks))
      .map((task, index) => normalizeTask(task, index))
      .filter((task): task is TaskRecommendation => Boolean(task));
  } catch (error) {
    console.warn('Failed to parse Gemini JSON payload:', error, 'Raw output:', textOutput);
    return [];
  }
}
