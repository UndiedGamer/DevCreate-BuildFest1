import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { subscribeToStudentTasks, type StudentTask, toggleTaskStatus } from '@/services/student-tasks';

export function useStudentTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToStudentTasks(
      user?.uid,
      (nextTasks) => {
        setTasks(nextTasks);
        setLoading(false);
      },
      () => {
        setError('Unable to load tasks. Pull to refresh.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, refreshKey]);

  const toggleTask = async (task: StudentTask) => {
    if (!user) {
      return;
    }

    try {
      await toggleTaskStatus(user, task);
    } catch (err) {
      console.error('Failed to toggle task status', err);
      setError('Unable to update the task status.');
    }
  };

  const refresh = () => {
    setRefreshKey((value) => value + 1);
  };

  return {
    tasks,
    loading,
    error,
    toggleTask,
    refresh
  };
}
