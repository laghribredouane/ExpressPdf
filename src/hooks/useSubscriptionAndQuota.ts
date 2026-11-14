import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  fetchLast24hUsageCount,
  recordUsageLogToCloud,
  subscribeMyPremiumRequests,
  subscribeSaasUserProfile,
  syncDeviceAndMaybeActivateTrial,
} from '../services/saasService';
import type {
  PremiumRequestRecord,
  QuotaCheckResult,
  SaasUserProfile,
  ToolDefinition,
  ToolId,
} from '../types/pdf';
import {
  collectDeviceTelemetry,
  getGuestDailyUsageCount,
  incrementGuestDailyUsage,
  type DeviceTelemetry,
} from '../utils/deviceFingerprint';

const GUEST_DAILY_LIMIT = 2;
const GUEST_MAX_FILE_MB = 5;
const GUEST_MAX_BATCH = 2;

const FREE_DAILY_LIMIT = 3;
const FREE_MAX_FILE_MB = 15;
const FREE_MAX_BATCH = 3;

const PREMIUM_MAX_FILE_MB = 200;
const PREMIUM_MAX_BATCH = 999;

export type EffectivePlanTier =
  | 'guest'
  | 'unverified'
  | 'free'
  | 'trial_active'
  | 'premium_active'
  | 'expired'
  | 'suspended';

export function formatRemainingCountdown(expiresAtMs: number, nowMs: number): string {
  if (!expiresAtMs || expiresAtMs <= 0) return 'Illimité';
  const diff = Math.max(0, expiresAtMs - nowMs);
  const totalMinutes = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    return `${days}j ${hours}h restants`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes}min restantes`;
  }
  return `${Math.max(1, minutes)}min restantes`;
}

interface UseSubscriptionAndQuotaParams {
  authUser: User | null;
  authEmailVerified?: boolean;
  isUserDocReady?: boolean;
  onTrialActivated?: (expiresAtMs: number) => void;
  onDeviceTrialBlocked?: () => void;
}

export function useSubscriptionAndQuota({
  authUser,
  authEmailVerified,
  isUserDocReady = true,
  onTrialActivated,
  onDeviceTrialBlocked,
}: UseSubscriptionAndQuotaParams) {
  const [telemetry, setTelemetry] = useState<DeviceTelemetry | null>(null);
  const [profile, setProfile] = useState<SaasUserProfile | null>(null);
  const [myRequests, setMyRequests] = useState<PremiumRequestRecord[]>([]);
  const [guestUsed, setGuestUsed] = useState(0);
  const [user24hUsed, setUser24hUsed] = useState(0);
  const [isDeviceBanned, setIsDeviceBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | undefined>(undefined);
  const [trialBlockedOnDevice, setTrialBlockedOnDevice] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick every 60 seconds for exact trial countdown
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  // Initialize hardware device fingerprint + guest usage counter
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const info = await collectDeviceTelemetry();
      if (cancelled) return;
      setTelemetry(info);
      const count = await getGuestDailyUsageCount(info.deviceFingerprint);
      if (!cancelled) setGuestUsed(count);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to Firestore user profile & requests when authenticated
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setMyRequests([]);
      setUser24hUsed(0);
      setTrialBlockedOnDevice(false);
      return;
    }

    const unsubProfile = subscribeSaasUserProfile(authUser.uid, (nextProfile) => {
      setProfile(nextProfile);
    });
    const unsubRequests = subscribeMyPremiumRequests(authUser.uid, (reqs) => {
      setMyRequests(reqs);
    });

    void fetchLast24hUsageCount(authUser.uid)
      .then((count) => setUser24hUsed(count))
      .catch(() => {
        // Non-fatal
      });

    return () => {
      unsubProfile();
      unsubRequests();
    };
  }, [authUser]);

  // Sync device record & run 7-day trial activation / anti-abuse check
  const runDeviceSync = useCallback(async () => {
    if (!authUser || !telemetry || !isUserDocReady) return;
    try {
      const outcome = await syncDeviceAndMaybeActivateTrial(authUser, telemetry);
      setIsDeviceBanned(outcome.isBanned);
      setBanReason(outcome.banReason);

      if (outcome.trialGranted && outcome.trialExpiresAt) {
        setTrialBlockedOnDevice(false);
        onTrialActivated?.(outcome.trialExpiresAt);
      } else if (outcome.trialBlockedByDevice) {
        setTrialBlockedOnDevice(true);
        onDeviceTrialBlocked?.();
      }
    } catch (err) {
      console.warn('Device sync error:', err);
    }
  }, [
    authUser,
    telemetry,
    isUserDocReady,
    onTrialActivated,
    onDeviceTrialBlocked,
  ]);

  useEffect(() => {
    void runDeviceSync();
  }, [runDeviceSync, authEmailVerified]);

  const effectiveTier: EffectivePlanTier = useMemo(() => {
    if (!authUser) return 'guest';
    if (profile?.subscriptionStatus === 'suspended') return 'suspended';

    const status = profile?.subscriptionStatus;
    const exp = profile?.premiumExpiresAt || 0;

    if (status === 'premium_active') {
      if (exp > 0 && nowMs > exp) return 'expired';
      return 'premium_active';
    }
    if (status === 'trial_active') {
      if (exp > 0 && nowMs > exp) return 'expired';
      return 'trial_active';
    }

    const isVerified = authEmailVerified ?? authUser.emailVerified;
    if (!isVerified) return 'unverified';
    if (status === 'expired') return 'expired';
    return 'free';
  }, [authUser, authEmailVerified, profile, nowMs]);

  const isAdmin = useMemo(() => {
    if (!authUser) return false;
    const verified = authEmailVerified ?? authUser.emailVerified;
    if (profile?.role === 'admin') return true;
    return (
      (authUser.email || '').toLowerCase() === ADMIN_EMAIL && Boolean(verified)
    );
  }, [authUser, authEmailVerified, profile]);

  const isPremiumOrTrial =
    effectiveTier === 'trial_active' || effectiveTier === 'premium_active';

  const countdownLabel = useMemo(() => {
    if (!profile) return null;
    if (effectiveTier === 'trial_active') {
      return `Essai Premium : ${formatRemainingCountdown(
        profile.premiumExpiresAt,
        nowMs
      )}`;
    }
    if (effectiveTier === 'premium_active') {
      if (!profile.premiumExpiresAt || profile.premiumExpiresAt === 0) {
        return 'Premium Illimité';
      }
      return `Premium : ${formatRemainingCountdown(
        profile.premiumExpiresAt,
        nowMs
      )}`;
    }
    return null;
  }, [effectiveTier, profile, nowMs]);

  const checkUserQuota = useCallback(
    (params: {
      tool?: Pick<ToolDefinition, 'id' | 'title' | 'isPro'>;
      files?: File[];
      compressLevel?: string;
    }): QuotaCheckResult => {
      const files = params.files || [];
      const tool = params.tool;

      if (isDeviceBanned) {
        return {
          allowed: false,
          blockReasonCode: 'banned_device',
          reason:
            banReason ||
            "Cet appareil a été suspendu par l'administrateur pour utilisation abusive.",
          maxFileMb: 0,
          maxBatchFiles: 0,
          dailyLimit: 0,
          remainingTasks: 0,
          isWatermarked: true,
        };
      }

      if (effectiveTier === 'suspended') {
        return {
          allowed: false,
          blockReasonCode: 'suspended_account',
          reason:
            "Votre compte a été suspendu par l'administrateur. Contactez le support pour réactiver l'accès.",
          maxFileMb: 0,
          maxBatchFiles: 0,
          dailyLimit: 0,
          remainingTasks: 0,
          isWatermarked: true,
        };
      }

      if (isPremiumOrTrial) {
        const oversized = files.find(
          (f) => f.size > PREMIUM_MAX_FILE_MB * 1024 * 1024
        );
        if (oversized) {
          return {
            allowed: false,
            blockReasonCode: 'file_size_limit',
            reason: `Le fichier "${oversized.name}" dépasse la limite de ${PREMIUM_MAX_FILE_MB} Mo par fichier.`,
            maxFileMb: PREMIUM_MAX_FILE_MB,
            maxBatchFiles: PREMIUM_MAX_BATCH,
            dailyLimit: null,
            remainingTasks: null,
            isWatermarked: false,
          };
        }

        return {
          allowed: true,
          maxFileMb: PREMIUM_MAX_FILE_MB,
          maxBatchFiles: PREMIUM_MAX_BATCH,
          dailyLimit: null,
          remainingTasks: null,
          isWatermarked: false,
        };
      }

      // Tiers restreints : Guest vs Free/Unverified/Expired
      const isGuest = effectiveTier === 'guest';
      const maxFileMb = isGuest ? GUEST_MAX_FILE_MB : FREE_MAX_FILE_MB;
      const maxBatchFiles = isGuest ? GUEST_MAX_BATCH : FREE_MAX_BATCH;
      const dailyLimit = isGuest ? GUEST_DAILY_LIMIT : FREE_DAILY_LIMIT;
      const usedCount = isGuest ? guestUsed : user24hUsed;
      const remainingTasks = Math.max(0, dailyLimit - usedCount);

      const isExtremeCompression =
        tool?.id === 'compress' && params.compressLevel === 'extreme';
      if (tool?.isPro || isExtremeCompression) {
        return {
          allowed: false,
          blockReasonCode: 'pro_tool_locked',
          requiresAuth: isGuest,
          requiresUpgrade: true,
          reason: isExtremeCompression
            ? 'La compression extrême est réservée aux comptes Essai 7j et Premium.'
            : `L’outil "${tool?.title}" est réservé aux membres Premium (ou Essai gratuit 7 jours).`,
          maxFileMb,
          maxBatchFiles,
          dailyLimit,
          remainingTasks,
          isWatermarked: true,
        };
      }

      if (files.length > maxBatchFiles) {
        return {
          allowed: false,
          blockReasonCode: 'batch_limit',
          requiresAuth: isGuest,
          requiresUpgrade: true,
          reason: isGuest
            ? `Les visiteurs peuvent traiter au maximum ${maxBatchFiles} fichiers simultanément. Créez un compte gratuit pour débloquer 7 jours illimités !`
            : `Le plan Gratuit est limité à ${maxBatchFiles} fichiers par traitement. Passez à Premium pour traiter des lots illimités.`,
          maxFileMb,
          maxBatchFiles,
          dailyLimit,
          remainingTasks,
          isWatermarked: true,
        };
      }

      const oversized = files.find((f) => f.size > maxFileMb * 1024 * 1024);
      if (oversized) {
        return {
          allowed: false,
          blockReasonCode: 'file_size_limit',
          requiresAuth: isGuest,
          requiresUpgrade: true,
          reason: isGuest
            ? `"${oversized.name}" dépasse ${maxFileMb} Mo (limite visiteur). Créez un compte gratuit pour obtenir 7 jours Premium jusqu'à 200 Mo !`
            : `"${oversized.name}" dépasse ${maxFileMb} Mo (limite du plan Gratuit). Passez à Premium pour traiter jusqu'à 200 Mo.`,
          maxFileMb,
          maxBatchFiles,
          dailyLimit,
          remainingTasks,
          isWatermarked: true,
        };
      }

      if (usedCount >= dailyLimit) {
        return {
          allowed: false,
          blockReasonCode: 'daily_limit',
          requiresAuth: isGuest,
          requiresUpgrade: true,
          reason: isGuest
            ? `Vous avez atteint la limite de ${dailyLimit} tâches gratuites par jour pour les visiteurs. Créez un compte gratuit pour débloquer 7 jours d'essai Premium illimité !`
            : `Vous avez utilisé vos ${dailyLimit} tâches PDF gratuites des dernières 24 heures. Passez à Premium pour un accès illimité.`,
          maxFileMb,
          maxBatchFiles,
          dailyLimit,
          remainingTasks: 0,
          isWatermarked: true,
        };
      }

      return {
        allowed: true,
        maxFileMb,
        maxBatchFiles,
        dailyLimit,
        remainingTasks,
        isWatermarked: true,
      };
    },
    [
      isDeviceBanned,
      banReason,
      effectiveTier,
      isPremiumOrTrial,
      guestUsed,
      user24hUsed,
    ]
  );

  const consumeQuota = useCallback(
    async (toolId: ToolId, files: File[]) => {
      const fp = telemetry?.deviceFingerprint || 'fp_unknown';
      if (!authUser) {
        const nextCount = await incrementGuestDailyUsage(fp);
        setGuestUsed(nextCount);
        return;
      }

      if (!isPremiumOrTrial) {
        setUser24hUsed((c) => c + 1);
      }

      const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
      try {
        await recordUsageLogToCloud(
          authUser.uid,
          fp,
          toolId,
          Math.max(1, files.length),
          totalBytes
        );
      } catch (err) {
        console.warn('Could not persist usage log:', err);
      }
    },
    [authUser, telemetry, isPremiumOrTrial]
  );

  const currentLimits = useMemo(() => {
    if (isPremiumOrTrial) {
      return {
        maxFileMb: PREMIUM_MAX_FILE_MB,
        maxBatchFiles: PREMIUM_MAX_BATCH,
        dailyLimit: null as number | null,
        usedToday: user24hUsed,
        remainingToday: null as number | null,
        isWatermarked: false,
      };
    }
    if (effectiveTier === 'guest') {
      return {
        maxFileMb: GUEST_MAX_FILE_MB,
        maxBatchFiles: GUEST_MAX_BATCH,
        dailyLimit: GUEST_DAILY_LIMIT,
        usedToday: guestUsed,
        remainingToday: Math.max(0, GUEST_DAILY_LIMIT - guestUsed),
        isWatermarked: true,
      };
    }
    return {
      maxFileMb: FREE_MAX_FILE_MB,
      maxBatchFiles: FREE_MAX_BATCH,
      dailyLimit: FREE_DAILY_LIMIT,
      usedToday: user24hUsed,
      remainingToday: Math.max(0, FREE_DAILY_LIMIT - user24hUsed),
      isWatermarked: true,
    };
  }, [isPremiumOrTrial, effectiveTier, guestUsed, user24hUsed]);

  return {
    telemetry,
    deviceFingerprint: telemetry?.deviceFingerprint || null,
    profile,
    myRequests,
    effectiveTier,
    isAdmin,
    isPremiumOrTrial,
    isDeviceBanned,
    banReason,
    trialBlockedOnDevice,
    dismissTrialBlockedBanner: () => setTrialBlockedOnDevice(false),
    countdownLabel,
    currentLimits,
    checkUserQuota,
    consumeQuota,
    refreshDeviceSync: runDeviceSync,
  };
}
