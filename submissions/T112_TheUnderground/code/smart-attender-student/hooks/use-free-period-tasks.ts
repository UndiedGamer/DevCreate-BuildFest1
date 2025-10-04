import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchFreePeriodTasks,
  type FetchFreePeriodTasksOptions,
  type FreePeriodTask
} from '@/services/free-period-tasks';

interface UseFreePeriodTasksOptions extends Omit<FetchFreePeriodTasksOptions, 'signal'> {
  enabled?: boolean;
}

interface UseFreePeriodTasksValue {
  ideas: FreePeriodTask[];
  loading: boolean;
  error: string | null;
  isFallback: boolean;
  refresh: () => Promise<void>;
}

export function useFreePeriodTasks(options: UseFreePeriodTasksOptions = {}): UseFreePeriodTasksValue {
  const { enabled = true, gradeLevel, interest, mood, time } = options;
  const [ideas, setIdeas] = useState<FreePeriodTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stableParams = useMemo(
    () => ({ gradeLevel, interest, mood, time }),
    [gradeLevel, interest, mood, time]
  );

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }

    abortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const { tasks, isFallback: fallback } = await fetchFreePeriodTasks({
        ...stableParams,
        signal: controller?.signal
      });

      setIdeas(tasks);
      setIsFallback(fallback);
    } catch (err) {
      console.warn('[useFreePeriodTasks] Failed to load tasks', err);
      setError('Unable to load ideas right now. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, [enabled, stableParams]);

  useEffect(() => {
    load();

    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    ideas,
    loading,
    error,
    isFallback,
    refresh
  };
}
