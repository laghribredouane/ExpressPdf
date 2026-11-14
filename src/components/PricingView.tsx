import {
  ArrowLeft,
  Check,
  Clock,
  Crown,
  Landmark,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CURRENCIES,
  PREMIUM_PLANS,
  formatCurrencyAmount,
} from '../data/premiumPlans';
import type { EffectivePlanTier } from '../hooks/useSubscriptionAndQuota';
import type {
  BillingCycle,
  CurrencyCode,
  PremiumRequestRecord,
} from '../types/pdf';
import { useState } from 'react';

interface PricingViewProps {
  selectedCurrency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  effectiveTier: EffectivePlanTier;
  countdownLabel: string | null;
  myRequests: PremiumRequestRecord[];
  isSignedIn: boolean;
  onBackHome: () => void;
  onOpenSignup: () => void;
  onRequestPremiumActivation: (planId: 'premium_pro' | 'premium_team', cycle: BillingCycle) => void;
}

export function PricingView({
  selectedCurrency,
  onCurrencyChange,
  effectiveTier,
  countdownLabel,
  myRequests,
  isSignedIn,
  onBackHome,
  onOpenSignup,
  onRequestPremiumActivation,
}: PricingViewProps) {
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const currencyCfg = CURRENCIES[selectedCurrency];

  return (
    <main className="flex-grow w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Barre retour + statut courant */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackHome}
          className="min-h-[44px] inline-flex items-center gap-2 text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux outils PDF</span>
        </button>

        {countdownLabel && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs font-extrabold text-amber-900 dark:text-amber-200">
            <Clock className="w-3.5 h-3.5" />
            <span>{countdownLabel}</span>
          </div>
        )}
      </div>

      {/* En-tête Tarifs */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-extrabold uppercase tracking-wider">
          <Crown className="w-3.5 h-3.5" />
          <span>Tarifs PDFExpress SaaS</span>
        </span>
        <h1 className="font-display text-2xl sm:text-3xl lg:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight [text-wrap:balance]">
          Des formules claires, sans engagement automatique
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
          Profitez de <strong>7 jours d’essai Premium offerts</strong> dès vérification de votre e-mail (1 essai par appareil), puis réglez simplement par virement bancaire en <strong>MAD, EUR ou USD</strong>.
        </p>

        {/* Sélecteurs Devise & Périodicité */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1">
            {(['MAD', 'EUR', 'USD'] as CurrencyCode[]).map((code) => {
              const active = selectedCurrency === code;
              const labels: Record<CurrencyCode, string> = {
                MAD: 'MAD (DH)',
                EUR: 'EURO (€)',
                USD: 'DOLLAR ($)',
              };
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onCurrencyChange(code)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all ${
                    active
                      ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {labels[code]}
                </button>
              );
            })}
          </div>

          <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                cycle === 'monthly'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setCycle('annual')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                cycle === 'annual'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              Annuel (-25 %)
            </button>
          </div>
        </div>
      </section>

      {/* Grille des 3 plans */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Gratuit */}
        <div className="rounded-3xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">
                Plan Gratuit Limité
              </span>
              {(effectiveTier === 'free' || effectiveTier === 'expired' || effectiveTier === 'guest') && (
                <span className="px-2.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                  Actuel
                </span>
              )}
            </div>
            <div>
              <p className="text-3xl font-extrabold text-neutral-900 dark:text-white tabular-nums">
                {formatCurrencyAmount(0, selectedCurrency)}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Pour un usage occasionnel ou découvrir la plateforme.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-neutral-700 dark:text-neutral-200 pt-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Visiteurs : 2 tâches/jour (max 5 Mo, 2 fichiers)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Connectés : 3 tâches / 24h (max 15 Mo, 3 fichiers)</span>
              </li>
              <li className="flex items-start gap-2 text-neutral-500">
                <X className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <span>Outils PRO verrouillés (OCR IA, Comparer, Censurer, PDF/A)</span>
              </li>
              <li className="flex items-start gap-2 text-neutral-500">
                <X className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <span>Mention « Traité avec PDFExpress Gratuit » en pied de page</span>
              </li>
            </ul>
          </div>

          {!isSignedIn ? (
            <button
              type="button"
              onClick={onOpenSignup}
              className="w-full h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-brand-red text-xs font-extrabold text-neutral-800 dark:text-neutral-100 inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Créer un compte (7j Premium offerts)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onBackHome}
              className="w-full h-11 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200"
            >
              Continuer avec les outils gratuits
            </button>
          )}
        </div>

        {/* Plans Premium Pro & Équipe */}
        {PREMIUM_PLANS.map((plan, idx) => {
          const price = plan.prices[selectedCurrency][cycle];
          const isPopular = idx === 0;
          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-7 flex flex-col justify-between space-y-6 border-2 ${
                isPopular
                  ? 'bg-gradient-to-b from-amber-50/70 to-white dark:from-amber-950/20 dark:to-brand-cardDark border-amber-400 shadow-xl'
                  : 'bg-white dark:bg-brand-cardDark border-neutral-200 dark:border-brand-borderDark'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    <span>{plan.name}</span>
                  </span>
                  {isPopular && (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-neutral-900 text-[10px] font-extrabold uppercase">
                      Recommandé
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-3xl font-extrabold text-neutral-900 dark:text-white tabular-nums">
                    {formatCurrencyAmount(price, selectedCurrency)}
                    <span className="text-xs font-semibold text-neutral-500">
                      /{cycle === 'annual' ? 'an' : 'mois'}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    {plan.tagline}
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-neutral-700 dark:text-neutral-200 pt-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Tâches illimitées, fichiers jusqu’à 200 Mo & lots illimités</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Zéro filigrane sur tous les documents générés</span>
                  </li>
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onRequestPremiumActivation(plan.id, cycle)}
                className={`w-full h-11 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isPopular
                    ? 'bg-brand-red hover:bg-red-700 text-white'
                    : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Demander l’activation Premium</span>
              </button>
            </div>
          );
        })}
      </section>

      {/* Rappel RIB CIH Bank & Mes Demandes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <Landmark className="w-5 h-5 text-brand-red" />
            <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
              Coordonnées de virement ({currencyCfg.shortLabel})
            </h2>
          </div>
          <div className="text-xs space-y-1.5 text-neutral-600 dark:text-neutral-300">
            <p>
              <strong>Bénéficiaire :</strong> {currencyCfg.beneficiary}
            </p>
            <p>
              <strong>Banque :</strong> {currencyCfg.bankName}
            </p>
            <p className="font-mono">
              <strong>R.I.B. :</strong> 230 480 2791812211019600 43
            </p>
            <p className="font-mono">
              <strong>I.B.A.N. :</strong> {currencyCfg.iban}
            </p>
            <p className="font-mono">
              <strong>B.I.C / SWIFT :</strong> {currencyCfg.secondaryCode}
            </p>
            <p className="text-[11px] text-neutral-500 pt-1">
              Après votre virement, cliquez sur « Demander l’activation Premium » pour transmettre votre référence à l’administrateur.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-6 space-y-3">
          <h2 className="text-base font-extrabold text-neutral-900 dark:text-white">
            Mes demandes d’activation récentes
          </h2>
          {myRequests.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 py-4">
              {isSignedIn
                ? 'Aucune demande d’activation enregistrée pour ce compte.'
                : 'Connectez-vous pour suivre le statut de vos demandes d’activation Premium.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 dark:text-white truncate">
                      {req.planLabel} · {req.formattedAmount}
                    </p>
                    <p className="text-[11px] font-mono text-neutral-500 truncate">
                      Réf : {req.reference} · {req.transferDate}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 ${
                      req.status === 'approved'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : req.status === 'rejected'
                        ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {req.status === 'approved'
                      ? 'Approuvé'
                      : req.status === 'rejected'
                      ? 'Refusé'
                      : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
