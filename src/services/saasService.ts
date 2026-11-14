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
  type Timestamp,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type {
  BannedDeviceRecord,
  BillingCycle,
  CurrencyCode,
  PremiumRequestRecord,
  SaasUserProfile,
  SubscriptionStatus,
  ToolId,
  UserDeviceRecord,
} from '../types/pdf';
import type { DeviceTelemetry } from '../utils/deviceFingerprint';

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_EMAIL = 'laghribredouane@gmail.com';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || 'unknown';
}

function buildDeviceRecordId(uid: string, fingerprint: string): string {
  const combined = `${sanitizeId(uid)}_${sanitizeId(fingerprint)}`;
  return combined.slice(0, 128);
}

function tsToMs(val: unknown): number | undefined {
  if (!val) return undefined;
  if (typeof val === 'number') return val;
  if (typeof (val as Timestamp)?.toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return undefined;
}

function mapUserProfileDoc(uid: string, data: Record<string, unknown>): SaasUserProfile {
  const email = String(data.email || '');
  const isBootstrappedAdmin =
    email.toLowerCase() === ADMIN_EMAIL && Boolean(data.emailVerified);

  return {
    uid: String(data.uid || uid),
    displayName: String(data.displayName || 'Utilisateur PDFExpress'),
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
    email,
    emailVerified: Boolean(data.emailVerified),
    role: data.role === 'admin' || isBootstrappedAdmin ? 'admin' : 'user',
    subscriptionStatus: (data.subscriptionStatus as SubscriptionStatus) || 'free',
    trialClaimed: Boolean(data.trialClaimed),
    premiumExpiresAt:
      typeof data.premiumExpiresAt === 'number' ? data.premiumExpiresAt : 0,
    lastDeviceFingerprint: data.lastDeviceFingerprint
      ? String(data.lastDeviceFingerprint)
      : undefined,
    adminNote: data.adminNote ? String(data.adminNote) : undefined,
    createdAtMs: tsToMs(data.createdAt),
    updatedAtMs: tsToMs(data.updatedAt),
  };
}

export interface DeviceSyncOutcome {
  isBanned: boolean;
  banReason?: string;
  trialGranted: boolean;
  trialBlockedByDevice: boolean;
  trialExpiresAt?: number;
}

export async function syncDeviceAndMaybeActivateTrial(
  user: User,
  telemetry: DeviceTelemetry
): Promise<DeviceSyncOutcome> {
  const fp = sanitizeId(telemetry.deviceFingerprint);
  const userRef = doc(db, 'users', user.uid);
  const recordId = buildDeviceRecordId(user.uid, fp);
  const deviceRef = doc(db, 'user_devices', recordId);
  const bannedRef = doc(db, 'banned_devices', fp);
  const trialLockRef = doc(db, 'device_trials', fp);

  let isBanned = false;
  let banReason: string | undefined;

  try {
    const bannedSnap = await getDoc(bannedRef);
    if (bannedSnap.exists()) {
      isBanned = true;
      banReason = String(bannedSnap.data()?.reason || 'Appareil bloqué pour abus.');
    }
  } catch {
    // Continue gracefully
  }

  let devSnap;
  try {
    devSnap = await getDoc(deviceRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `user_devices/${recordId}`);
  }

  const safeUserAgent = (telemetry.userAgent || 'unknown').trim().slice(0, 300) || 'unknown';
  const safeOs = (telemetry.os || 'unknown').trim().slice(0, 80) || 'unknown';
  const safeBrowser = (telemetry.browser || 'unknown').trim().slice(0, 80) || 'unknown';
  const safeScreen = (telemetry.screenResolution || '0x0').trim().slice(0, 40) || '0x0';
  const safeIp = (telemetry.lastIp || 'client-local').trim().slice(0, 64) || 'client-local';

  if (!devSnap.exists()) {
    try {
      await setDoc(deviceRef, {
        id: recordId,
        userId: user.uid,
        deviceFingerprint: fp,
        userAgent: safeUserAgent,
        os: safeOs,
        browser: safeBrowser,
        screenResolution: safeScreen,
        lastIp: safeIp,
        firstUsedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `user_devices/${recordId}`);
    }
  } else {
    try {
      await updateDoc(deviceRef, {
        userAgent: safeUserAgent,
        os: safeOs,
        browser: safeBrowser,
        screenResolution: safeScreen,
        lastIp: safeIp,
        lastSeenAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `user_devices/${recordId}`);
    }
  }

  let profileSnap;
  try {
    profileSnap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
  }

  if (!profileSnap.exists()) {
    return {
      isBanned,
      banReason,
      trialGranted: false,
      trialBlockedByDevice: false,
    };
  }

  const profileData = profileSnap.data() || {};
  const currentStatus = (profileData.subscriptionStatus as SubscriptionStatus) || 'free';
  const trialClaimed = Boolean(profileData.trialClaimed);
  const expiresAt =
    typeof profileData.premiumExpiresAt === 'number'
      ? profileData.premiumExpiresAt
      : 0;

  // Vérifier expiration automatique si trial_active ou premium_active dépassé
  if (
    (currentStatus === 'trial_active' || currentStatus === 'premium_active') &&
    expiresAt > 0 &&
    Date.now() > expiresAt
  ) {
    try {
      await updateDoc(userRef, {
        subscriptionStatus: 'expired',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal
    }
  }

  // Mettre à jour lastDeviceFingerprint + emailVerified
  try {
    await updateDoc(userRef, {
      lastDeviceFingerprint: fp,
      emailVerified: Boolean(user.emailVerified),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }

  if (isBanned) {
    return {
      isBanned: true,
      banReason,
      trialGranted: false,
      trialBlockedByDevice: false,
    };
  }

  // Essai automatique de 7 jours UNIQUEMENT si e-mail vérifié, statut 'free', jamais réclamé
  if (user.emailVerified && currentStatus === 'free' && !trialClaimed) {
    let lockSnap;
    try {
      lockSnap = await getDoc(trialLockRef);
    } catch {
      lockSnap = null;
    }

    if (lockSnap && lockSnap.exists()) {
      return {
        isBanned: false,
        trialGranted: false,
        trialBlockedByDevice: true,
      };
    }

    const trialExpiresAt = Date.now() + SEVEN_DAYS_MS;
    try {
      const batch = writeBatch(db);
      batch.set(trialLockRef, {
        deviceFingerprint: fp,
        claimedByUid: user.uid,
        claimedAt: serverTimestamp(),
      });
      batch.update(userRef, {
        subscriptionStatus: 'trial_active',
        trialClaimed: true,
        premiumExpiresAt: trialExpiresAt,
        emailVerified: true,
        lastDeviceFingerprint: fp,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return {
        isBanned: false,
        trialGranted: true,
        trialBlockedByDevice: false,
        trialExpiresAt,
      };
    } catch (err) {
      console.warn('Trial activation blocked by device lock or rule:', err);
      return {
        isBanned: false,
        trialGranted: false,
        trialBlockedByDevice: true,
      };
    }
  }

  return {
    isBanned: false,
    trialGranted: false,
    trialBlockedByDevice: false,
  };
}

export function subscribeSaasUserProfile(
  uid: string,
  onProfile: (profile: SaasUserProfile | null) => void,
  onError?: (err: Error) => void
): () => void {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(
    userRef,
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(mapUserProfileDoc(uid, snap.data()));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export async function fetchLast24hUsageCount(uid: string): Promise<number> {
  const path = 'usage_logs';
  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  try {
    const q = query(
      collection(db, 'usage_logs'),
      where('userId', '==', uid),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.filter((d) => {
      const ms = Number(d.data()?.createdAtMs || 0);
      return ms >= sinceMs;
    }).length;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function recordUsageLogToCloud(
  uid: string,
  deviceFingerprint: string,
  toolId: ToolId,
  fileCount: number,
  totalBytes: number
): Promise<void> {
  const logId = sanitizeId(crypto.randomUUID());
  const path = `usage_logs/${logId}`;
  try {
    await setDoc(doc(db, 'usage_logs', logId), {
      id: logId,
      userId: uid,
      deviceFingerprint: sanitizeId(deviceFingerprint),
      toolId: toolId.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'merge',
      fileCount: Math.max(1, Math.min(500, Math.round(fileCount) || 1)),
      totalBytes: Math.max(0, Math.round(totalBytes) || 0),
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function submitPremiumRequestToCloud(params: {
  userId: string;
  reference: string;
  planId: 'premium_pro' | 'premium_team';
  planLabel: string;
  cycle: BillingCycle;
  currency: CurrencyCode;
  amount: number;
  formattedAmount: string;
  payerName: string;
  payerEmail: string;
  bankOrigin?: string;
  transferDate: string;
  note?: string;
}): Promise<string> {
  const reqId = sanitizeId(crypto.randomUUID());
  const path = `premium_requests/${reqId}`;
  try {
    await setDoc(doc(db, 'premium_requests', reqId), {
      id: reqId,
      userId: params.userId,
      reference: params.reference.trim().slice(0, 80),
      planId: params.planId,
      planLabel: params.planLabel.trim().slice(0, 80),
      cycle: params.cycle,
      currency: params.currency,
      amount: Math.max(0, Number(params.amount) || 0),
      formattedAmount: params.formattedAmount.trim().slice(0, 40),
      payerName: params.payerName.trim().slice(0, 120),
      payerEmail: params.payerEmail.trim().slice(0, 254),
      bankOrigin: (params.bankOrigin || '').trim().slice(0, 120),
      transferDate: params.transferDate.trim().slice(0, 40),
      note: (params.note || '').trim().slice(0, 500),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reqId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeMyPremiumRequests(
  uid: string,
  onRequests: (items: PremiumRequestRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'premium_requests'),
    where('userId', '==', uid),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    const items: PremiumRequestRecord[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        userId: String(data.userId || uid),
        reference: String(data.reference || ''),
        planId: data.planId === 'premium_team' ? 'premium_team' : 'premium_pro',
        planLabel: String(data.planLabel || 'Premium Pro'),
        cycle: data.cycle === 'annual' ? 'annual' : 'monthly',
        currency: (data.currency as CurrencyCode) || 'MAD',
        amount: Number(data.amount) || 0,
        formattedAmount: String(data.formattedAmount || ''),
        payerName: String(data.payerName || ''),
        payerEmail: String(data.payerEmail || ''),
        bankOrigin: data.bankOrigin ? String(data.bankOrigin) : undefined,
        transferDate: String(data.transferDate || ''),
        note: data.note ? String(data.note) : undefined,
        status:
          data.status === 'approved' || data.status === 'rejected'
            ? data.status
            : 'pending',
        reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
        createdAtMs: tsToMs(data.createdAt),
      };
    });
    items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    onRequests(items);
  });
}

// ============================================================================
// ADMIN DASHBOARD SERVICES (strictement protégés par isAdmin() dans Firestore)
// ============================================================================

export interface AdminDashboardSnapshot {
  users: SaasUserProfile[];
  devices: UserDeviceRecord[];
  requests: PremiumRequestRecord[];
  bannedDevices: BannedDeviceRecord[];
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardSnapshot> {
  try {
    const [usersSnap, devicesSnap, reqsSnap, bannedSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), limit(200))),
      getDocs(query(collection(db, 'user_devices'), limit(300))),
      getDocs(query(collection(db, 'premium_requests'), limit(200))),
      getDocs(query(collection(db, 'banned_devices'), limit(200))),
    ]);

    const users = usersSnap.docs
      .map((d) => mapUserProfileDoc(d.id, d.data()))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    const devices: UserDeviceRecord[] = devicesSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || ''),
          deviceFingerprint: String(data.deviceFingerprint || ''),
          userAgent: String(data.userAgent || ''),
          os: String(data.os || ''),
          browser: String(data.browser || ''),
          screenResolution: String(data.screenResolution || ''),
          lastIp: String(data.lastIp || ''),
          firstUsedAtMs: tsToMs(data.firstUsedAt),
          lastSeenAtMs: tsToMs(data.lastSeenAt),
        };
      })
      .sort((a, b) => (b.lastSeenAtMs || 0) - (a.lastSeenAtMs || 0));

    const requests: PremiumRequestRecord[] = reqsSnap.docs
      .map((d): PremiumRequestRecord => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          userId: String(data.userId || ''),
          reference: String(data.reference || ''),
          planId:
            data.planId === 'premium_team' ? 'premium_team' : 'premium_pro',
          planLabel: String(data.planLabel || 'Premium Pro'),
          cycle: data.cycle === 'annual' ? 'annual' : 'monthly',
          currency: (data.currency as CurrencyCode) || 'MAD',
          amount: Number(data.amount) || 0,
          formattedAmount: String(data.formattedAmount || ''),
          payerName: String(data.payerName || ''),
          payerEmail: String(data.payerEmail || ''),
          bankOrigin: data.bankOrigin ? String(data.bankOrigin) : undefined,
          transferDate: String(data.transferDate || ''),
          note: data.note ? String(data.note) : undefined,
          status:
            data.status === 'approved' || data.status === 'rejected'
              ? data.status
              : 'pending',
          reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
          createdAtMs: tsToMs(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    const bannedDevices: BannedDeviceRecord[] = bannedSnap.docs.map((d) => {
      const data = d.data();
      return {
        deviceFingerprint: String(data.deviceFingerprint || d.id),
        reason: String(data.reason || 'Abus détecté'),
        bannedByUid: String(data.bannedByUid || ''),
        createdAtMs: tsToMs(data.createdAt),
      };
    });

    return { users, devices, requests, bannedDevices };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin-dashboard');
  }
}

export async function adminActivateUserPremium(
  targetUserId: string,
  durationDays: number | null, // null = illimité (premiumExpiresAt = 0)
  adminNote?: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  const expiresAt =
    durationDays === null || durationDays <= 0
      ? 0
      : Date.now() + durationDays * 24 * 60 * 60 * 1000;

  try {
    const payload: Record<string, unknown> = {
      subscriptionStatus: 'premium_active',
      premiumExpiresAt: expiresAt,
      updatedAt: serverTimestamp(),
    };
    if (adminNote !== undefined) {
      payload.adminNote = adminNote.slice(0, 300);
    }
    await updateDoc(doc(db, 'users', targetUserId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminSetUserStatus(
  targetUserId: string,
  status: SubscriptionStatus,
  adminNote?: string
): Promise<void> {
  const path = `users/${targetUserId}`;
  try {
    const payload: Record<string, unknown> = {
      subscriptionStatus: status,
      updatedAt: serverTimestamp(),
    };
    if (status === 'free' || status === 'suspended' || status === 'expired') {
      payload.premiumExpiresAt = 0;
    }
    if (adminNote !== undefined) {
      payload.adminNote = adminNote.slice(0, 300);
    }
    await updateDoc(doc(db, 'users', targetUserId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminReviewPremiumRequest(params: {
  requestId: string;
  targetUserId: string;
  decision: 'approved' | 'rejected';
  durationDays: number | null;
  reviewerUid: string;
}): Promise<void> {
  const reqRef = doc(db, 'premium_requests', params.requestId);
  try {
    if (params.decision === 'approved') {
      await adminActivateUserPremium(
        params.targetUserId,
        params.durationDays,
        `Demande ${params.requestId} approuvée`
      );
    }
    await updateDoc(reqRef, {
      status: params.decision,
      reviewedBy: params.reviewerUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `premium_requests/${params.requestId}`
    );
  }
}

export async function adminBanDevice(
  deviceFingerprint: string,
  reason: string,
  adminUid: string
): Promise<void> {
  const fp = sanitizeId(deviceFingerprint);
  const path = `banned_devices/${fp}`;
  try {
    await setDoc(doc(db, 'banned_devices', fp), {
      deviceFingerprint: fp,
      reason: (reason.trim() || 'Multi-comptes / Abus détecté').slice(0, 300),
      bannedByUid: sanitizeId(adminUid),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adminUnbanDevice(deviceFingerprint: string): Promise<void> {
  const fp = sanitizeId(deviceFingerprint);
  const path = `banned_devices/${fp}`;
  try {
    await deleteDoc(doc(db, 'banned_devices', fp));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
