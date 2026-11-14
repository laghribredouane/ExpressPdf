import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type { RecentProcessedFile, ToolId } from '../types/pdf';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return VALID_ID_REGEX.test(cleaned) ? cleaned : crypto.randomUUID();
}

function sanitizeToolId(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  return cleaned || 'merge';
}

export async function ensureUserProfileDocs(
  user: User,
  overrideDisplayName?: string
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;
  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');

  const safeDisplayName = (
    overrideDisplayName ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'Utilisateur PDFExpress'
  )
    .trim()
    .slice(0, 120);
  const safePhotoUrl = user.photoURL ? user.photoURL.trim().slice(0, 512) : '';
  const safeEmail = (user.email || 'utilisateur@pdfexpress.app')
    .trim()
    .slice(0, 254);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const profilePayload: Record<string, unknown> = {
        uid: user.uid,
        displayName: safeDisplayName,
        email: safeEmail,
        emailVerified: Boolean(user.emailVerified),
        role: 'user',
        subscriptionStatus: 'free',
        trialClaimed: false,
        premiumExpiresAt: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (safePhotoUrl) {
        profilePayload.photoURL = safePhotoUrl;
      }
      await setDoc(userRef, profilePayload);
    } else {
      const existingData = snap.data() || {};
      const isLegacy = !('subscriptionStatus' in existingData);
      const updatePayload: Record<string, unknown> = {
        displayName: safeDisplayName,
        email: safeEmail,
        emailVerified: Boolean(user.emailVerified),
        updatedAt: serverTimestamp(),
      };
      if (safePhotoUrl) {
        updatePayload.photoURL = safePhotoUrl;
      }
      if (isLegacy) {
        updatePayload.role = 'user';
        updatePayload.subscriptionStatus = 'free';
        updatePayload.trialClaimed = false;
        updatePayload.premiumExpiresAt = 0;
      }
      await updateDoc(userRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const privSnap = await getDoc(privateRef);
    if (!privSnap.exists()) {
      await setDoc(privateRef, {
        uid: user.uid,
        email: safeEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email: safeEmail,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function saveHistoryEntryToCloud(
  userId: string,
  entry: RecentProcessedFile
): Promise<void> {
  const entryId = sanitizeId(entry.id);
  const path = `users/${userId}/history/${entryId}`;
  try {
    await setDoc(doc(db, 'users', userId, 'history', entryId), {
      id: entryId,
      userId,
      fileName: (entry.fileName || 'document.pdf').slice(0, 255),
      toolId: sanitizeToolId(entry.toolId),
      toolTitle: (entry.toolTitle || 'Outil PDF').slice(0, 120),
      sizeFormatted: (entry.sizeFormatted || '0 Octet').slice(0, 40),
      processedAt:
        typeof entry.processedAt === 'number' && entry.processedAt > 0
          ? entry.processedAt
          : Date.now(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncLocalHistoryBatchToCloud(
  userId: string,
  localEntries: RecentProcessedFile[]
): Promise<number> {
  if (localEntries.length === 0) return 0;
  const colPath = `users/${userId}/history`;
  try {
    const existingQ = query(
      collection(db, 'users', userId, 'history'),
      where('userId', '==', userId),
      limit(50)
    );
    const existingSnap = await getDocs(existingQ);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const pending = localEntries
      .map((item) => ({ ...item, id: sanitizeId(item.id) }))
      .filter((item) => !existingIds.has(item.id))
      .slice(0, 20);

    if (pending.length === 0) return 0;

    const batch = writeBatch(db);
    for (const item of pending) {
      const ref = doc(db, 'users', userId, 'history', item.id);
      batch.set(ref, {
        id: item.id,
        userId,
        fileName: (item.fileName || 'document.pdf').slice(0, 255),
        toolId: sanitizeToolId(item.toolId),
        toolTitle: (item.toolTitle || 'Outil PDF').slice(0, 120),
        sizeFormatted: (item.sizeFormatted || '0 Octet').slice(0, 40),
        processedAt:
          typeof item.processedAt === 'number' && item.processedAt > 0
            ? item.processedAt
            : Date.now(),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return pending.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
}

export function subscribeCloudHistory(
  userId: string,
  onEntries: (entries: RecentProcessedFile[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `users/${userId}/history`;
  const q = query(
    collection(db, 'users', userId, 'history'),
    where('userId', '==', userId),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: RecentProcessedFile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          fileName: String(d.fileName || 'document.pdf'),
          toolId: String(d.toolId || 'merge') as ToolId,
          toolTitle: String(d.toolTitle || 'Outil PDF'),
          sizeFormatted: String(d.sizeFormatted || '0 Octet'),
          processedAt:
            typeof d.processedAt === 'number' ? d.processedAt : Date.now(),
          cloudSynced: true,
        };
      });
      items.sort((a, b) => b.processedAt - a.processedAt);
      onEntries(items.slice(0, 30));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export async function deleteCloudHistoryEntry(
  userId: string,
  entryId: string
): Promise<void> {
  const safeId = sanitizeId(entryId);
  const path = `users/${userId}/history/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'history', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearCloudHistory(userId: string): Promise<void> {
  const colPath = `users/${userId}/history`;
  try {
    const q = query(
      collection(db, 'users', userId, 'history'),
      where('userId', '==', userId),
      limit(100)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, colPath);
  }
}
