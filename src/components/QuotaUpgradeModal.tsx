import {
  AlertTriangle,
  Check,
  Crown,
  Lock,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import type { QuotaCheckResult } from '../types/pdf';

interface QuotaUpgradeModalProps {
  isOpen: boolean;
  quotaResult: QuotaCheckResult | null;
  isGuest: boolean;
  onClose: () => void;
  onOpenSignup: () => void;
  onOpenPricing: () => void;
}

export function QuotaUpgradeModal({
  isOpen,
  quotaResult,
  isGuest,
  onClose,
  onOpenSignup,
  onOpenPricing,
}: QuotaUpgradeModalProps) {
  if (!isOpen || !quotaResult) return null;

  const isBanOrSuspend =
    quotaResult.blockReasonCode === 'banned_device' ||
    quotaResult.blockReasonCode === 'suspended_account';

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        aria-hidden="true"
      />

      <div className="relative z-10 w-[95vw] sm:w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white dark:bg-brand-cardDark rounded-3xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark">
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-950/30 dark:to-red-950/30 border-b border-neutral-200 dark:border-brand-borderDark flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-neutral-900 flex items-center justify-center shrink-0">
              {isBanOrSuspend ? (
                <AlertTriangle className="w-5 h-5" />
              ) : quotaResult.blockReasonCode === 'pro_tool_locked' ? (
                <Crown className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-red">
                {isBanOrSuspend
                  ? 'Accès restreint'
                  : quotaResult.blockReasonCode === 'pro_tool_locked'
                  ? 'Fonctionnalité PRO'
                  : 'Limite du plan atteinte'}
              </span>
              <h2
                id="quota-modal-title"
                className="font-display text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white mt-0.5"
              >
                {isBanOrSuspend
                  ? 'Action bloquée par la sécurité'
                  : isGuest
                  ? 'Débloquez 7 jours Premium offerts !'
                  : 'Passez à PDFExpress Premium'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-xl bg-white/80 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-brand-red shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-800 dark:text-red-200 leading-relaxed">
            {quotaResult.reason}
          </div>

          {!isBanOrSuspend && (
            <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Inclus avec l’Essai 7 jours &amp; Premium</span>
              </p>
              <ul className="space-y-2 text-xs text-neutral-700 dark:text-neutral-200">
                {[
                  'Tâches PDF illimitées 24h/24',
                  'Fichiers jusqu’à 200 Mo & traitement par lot illimité',
                  'Accès complet aux outils PRO (OCR IA, Comparer, Censurer, PDF/A, Compression extrême)',
                  'Documents générés propres sans mention PDFExpress Gratuit',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            {!isBanOrSuspend && isGuest && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSignup();
                }}
                className="flex-1 h-11 px-4 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Créer un compte (7j offerts)</span>
              </button>
            )}

            {!isBanOrSuspend && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPricing();
                }}
                className={`flex-1 h-11 px-4 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isGuest
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90'
                    : 'bg-amber-400 hover:bg-amber-500 text-neutral-900'
                }`}
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span>Voir les tarifs &amp; Activer</span>
              </button>
            )}

            {isBanOrSuspend && (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
