export interface FreePeriodTask {
  id: string;
  title: string;
  description: string;
  focusArea: string;
  gradeLevel: string;
  duration: string;
}

export interface FetchFreePeriodTasksOptions {
  gradeLevel?: string;
  interest?: string;
  mood?: string;
  time?: string;
  signal?: AbortSignal;
}

const FALLBACK_TASKS: FreePeriodTask[] = [
  {
    id: 'idea-1',
    title: 'Stretch & Reset',
    description: 'Do a three-minute stretch, then jot one class win in your notes.',
    focusArea: 'concept-reinforcement',
    gradeLevel: 'Grades 9-12',
    duration: '10 min'
  },
  {
    id: 'idea-2',
    title: 'Mini Skill Boost',
    description: 'Pick a tough concept and explain it aloud or record a short voice recap.',
    focusArea: 'skills-practice',
    gradeLevel: 'Grades 9-12',
    duration: '15 min'
  },
  {
    id: 'idea-3',
    title: 'Future Snapshot',
    description: 'Browse one career profile that interests you and save a fun fact.',
    focusArea: 'career-exposure',
    gradeLevel: 'Grades 9-12',
    duration: '10 min'
  }
];

const STUDENT_TASKS_PATH = '/api/tasks/student';

function resolveEndpoint(): string | null {
  const direct = process.env.EXPO_PUBLIC_STUDENT_TASKS_ENDPOINT;
  if (direct && /^https?:\/\//i.test(direct)) {
    return direct;
  }

  const base = process.env.EXPO_PUBLIC_TEACHER_API_BASE_URL;
  if (!base || !/^https?:\/\//i.test(base)) {
    return null;
  }

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${STUDENT_TASKS_PATH}`;
}

function appendSearchParams(url: string, params: FetchFreePeriodTasksOptions): string {
  try {
    const next = new URL(url);

    if (params.gradeLevel) {
      next.searchParams.set('gradeLevel', params.gradeLevel);
    }

    if (params.interest) {
      next.searchParams.set('interest', params.interest);
    }

    if (params.mood) {
      next.searchParams.set('mood', params.mood);
    }

    if (params.time) {
      next.searchParams.set('time', params.time);
    }

    return next.toString();
  } catch (error) {
    console.warn('[free-period-tasks] Failed to build URL with params', error);
    return url;
  }
}

export async function fetchFreePeriodTasks(
  options: FetchFreePeriodTasksOptions = {}
): Promise<{ tasks: FreePeriodTask[]; isFallback: boolean }> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    return { tasks: FALLBACK_TASKS, isFallback: true };
  }

  const withParams = appendSearchParams(endpoint, options);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 8000);

  try {
    const response = await fetch(withParams, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: options.signal ?? controller?.signal
    });

    if (!response.ok) {
      console.warn('[free-period-tasks] Request failed', response.status, response.statusText);
      return { tasks: FALLBACK_TASKS, isFallback: true };
    }

    const payload = (await response.json()) as { tasks?: unknown };

    if (!payload || !Array.isArray(payload.tasks)) {
      return { tasks: FALLBACK_TASKS, isFallback: true };
    }

    const normalized = payload.tasks
      .map((task) => normalizeTask(task))
      .filter((task): task is FreePeriodTask => Boolean(task));

    if (normalized.length === 0) {
      return { tasks: FALLBACK_TASKS, isFallback: true };
    }

    return { tasks: normalized, isFallback: false };
  } catch (error) {
    if ((error as { name?: string })?.name !== 'AbortError') {
      console.warn('[free-period-tasks] Failed to fetch tasks', error);
    }
    return { tasks: FALLBACK_TASKS, isFallback: true };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTask(raw: unknown): FreePeriodTask | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;

  const asString = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

  return {
    id: asString(data.id, `idea-${Math.random().toString(36).slice(2, 8)}`),
    title: asString(data.title, 'Quick task'),
    description: asString(data.description, 'Try a short, focused activity.'),
    focusArea: asString(data.focusArea, 'concept-reinforcement'),
    gradeLevel: asString(data.gradeLevel, 'Grades 9-12'),
    duration: asString(data.duration, '15 min')
  } satisfies FreePeriodTask;
}

export { FALLBACK_TASKS }; // handy for tests/UI defaults
