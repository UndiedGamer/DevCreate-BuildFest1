'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Brain, Rocket, RefreshCcw } from 'lucide-react';

type FocusArea = 'concept-reinforcement' | 'skills-practice' | 'career-exposure';

export interface TaskRecommendation {
  id: string;
  title: string;
  description: string;
  focusArea: FocusArea;
  gradeLevel: string;
  duration: string;
}

const ICONS: Record<FocusArea, typeof BookOpen> = {
  'concept-reinforcement': BookOpen,
  'skills-practice': Brain,
  'career-exposure': Rocket
};

const FALLBACK_TASKS: TaskRecommendation[] = [
  {
    id: 'fallback-1',
    title: 'Guided recap drill',
    description: 'Short set of targeted questions reviewing today’s core concept.',
    focusArea: 'concept-reinforcement',
    gradeLevel: 'Grade 10',
    duration: '15 min'
  },
  {
    id: 'fallback-2',
    title: 'Peer teach burst',
    description: 'Pairs explain problem solutions and exchange quick feedback.',
    focusArea: 'skills-practice',
    gradeLevel: 'Grade 11',
    duration: '10 min'
  },
  {
    id: 'fallback-3',
    title: 'Career spotlight clip',
    description: 'Watch a real-world application video and log one key insight.',
    focusArea: 'career-exposure',
    gradeLevel: 'Grade 12',
    duration: '10 min'
  }
];

type FetchState = 'idle' | 'loading' | 'error' | 'success';

interface TaskRecommendationsProps {
  teacherId?: string;
}

async function fetchGeminiTasks(teacherId?: string): Promise<TaskRecommendation[]> {
  const params = new URLSearchParams();
  if (teacherId) {
    params.set('teacherId', teacherId);
  }

  const response = await fetch(`/api/tasks${params.toString() ? `?${params.toString()}` : ''}`);

  if (!response.ok) {
    throw new Error('Failed to load tasks');
  }

  const data = (await response.json()) as { tasks?: TaskRecommendation[] };
  if (!data.tasks || !Array.isArray(data.tasks) || data.tasks.length === 0) {
    throw new Error('No tasks returned');
  }

  return data.tasks as TaskRecommendation[];
}

export function TaskRecommendations({ teacherId }: TaskRecommendationsProps) {
  const [tasks, setTasks] = useState<TaskRecommendation[]>(FALLBACK_TASKS);
  const [state, setState] = useState<FetchState>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadTasks = async () => {
    setState('loading');
    setError(null);

    try {
      const result = await fetchGeminiTasks(teacherId);
      setTasks(result);
      setState('success');
    } catch (err) {
      console.warn('Falling back to local tasks', err);
      setTasks(FALLBACK_TASKS);
      setError(err instanceof Error ? err.message : 'Unable to fetch tasks');
      setState('error');
    }
  };

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const headerSubtitle = useMemo(() => {
    if (state === 'loading') {
      return 'Fetching fresh activities…';
    }
    if (state === 'error') {
      return 'Using quick fallback set. Retry for fresh ideas.';
    }
    return 'Suggested activities tailored to current performance signals.';
  }, [state]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Free-period tasks</h3>
          <p className="text-sm text-slate-500">{headerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadTasks()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-primary-300 hover:text-primary-600"
          disabled={state === 'loading'}
        >
          <RefreshCcw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
          {state === 'loading' ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {tasks.map((task) => {
          const Icon = ICONS[task.focusArea];
          return (
            <div key={task.id} className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                <Icon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-slate-900">{task.title}</h4>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary-600">
                    {task.duration}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {task.gradeLevel} • Focus: {task.focusArea.replace('-', ' ')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
