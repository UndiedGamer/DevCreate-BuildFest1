import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type QuerySnapshot
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { MockStudentUser, isMockStudent } from '@/services/mock-student';

export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface StudentTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: TaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

const mockTasks: StudentTask[] = [
  {
    id: 'mock-task-1',
    title: 'Review Algebra Concepts',
    description: 'Revisit quadratic equations ahead of tomorrow\'s class.',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    status: 'pending'
  },
  {
    id: 'mock-task-2',
    title: 'Complete Physics Lab Prep',
    description: 'Watch the lab safety video and summarize the three main rules.',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    status: 'in-progress'
  }
];

export function subscribeToStudentTasks(
  studentId: string | undefined,
  onTasks: (tasks: StudentTask[]) => void,
  onError?: (error: FirestoreError) => void
): () => void {
  if (!studentId) {
    onTasks([]);
    return () => undefined;
  }

  if (!isFirebaseConfigured) {
    onTasks(mockTasks);
    return () => undefined;
  }

  const db = getFirestoreDb();
  const tasksRef = collection(db, 'students', studentId, 'tasks');
  const q = query(tasksRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const tasks = snapshot.docs.map((docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnapshot.data() as Record<string, unknown>;
        return {
          id: docSnapshot.id,
          title: String(data.title ?? 'Task'),
          description: typeof data.description === 'string' ? data.description : undefined,
          dueDate: typeof data.dueDate === 'string' ? data.dueDate : undefined,
          status: (data.status as TaskStatus) ?? 'pending',
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined
        } satisfies StudentTask;
      });

      onTasks(tasks);
    },
  (error: FirestoreError) => {
      console.error('Failed to subscribe to student tasks', error);
      onError?.(error);
    }
  );
}

export async function toggleTaskStatus(
  student: { uid: string } | MockStudentUser,
  task: StudentTask
): Promise<void> {
  if (!isFirebaseConfigured || isMockStudent(student)) {
    return;
  }

  const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
  const db = getFirestoreDb();
  const taskRef = doc(db, 'students', student.uid, 'tasks', task.id);

  await updateDoc(taskRef, {
    status: nextStatus,
    updatedAt: serverTimestamp()
  });
}

export async function seedTaskIfMissing(studentId: string, task: StudentTask): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  const db = getFirestoreDb();
  const taskRef = doc(db, 'students', studentId, 'tasks', task.id);
  await setDoc(
    taskRef,
    {
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      status: task.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
