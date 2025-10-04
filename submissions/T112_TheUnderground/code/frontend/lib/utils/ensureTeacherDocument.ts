import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';

export async function ensureTeacherDocument(uid: string, displayName?: string | null) {
  if (!isFirebaseConfigured) {
    return;
  }

  const db = getFirestoreDb();
  const teacherRef = doc(db, 'teachers', uid);

  const snapshot = await getDoc(teacherRef);
  if (snapshot.exists()) {
    return;
  }

  await setDoc(teacherRef, {
    displayName: displayName ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
