import { useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Download,
  Landmark,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CURRENCIES,
  PREMIUM_PLANS,
  formatCurrencyAmount,
} from '../data/premiumPlans';
import type {
  BankTransferSubmission,
  BillingCycle,
  CurrencyCode,
} from '../types/pdf';
import { createFormattedTextPdf } from '../utils/pdfEngine';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCurrency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  activeTransfer: BankTransferSubmission | null;
  onTransferSubmitted: (submission: BankTransferSubmission) => void;
  onResetTransfer: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

function generateReference(): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `PDFEXP-${datePart}-${rand}`;
}

export function PremiumModal({
  isOpen,
  onClose,
  selectedCurrency,
  onCurrencyChange,
  activeTransfer,
  onTransferSubmitted,
  onResetTransfer,
  onNotify,
}: PremiumModalProps) {
  const [planId, setPlanId] = useState<'premium_pro' | 'premium_team'>(
    'premium_pro'
  );
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const [reference, setReference] = useState<string>(() => generateReference());
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [bankOrigin, setBankOrigin] = useState('');
  const [transferDate, setTransferDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan =
    PREMIUM_PLANS.find((p) => p.id === planId) || PREMIUM_PLANS[0];
  const currencyInfo = CURRENCIES[selectedCurrency];
  const amount = selectedPlan.prices[selectedCurrency][cycle];
  const formattedAmount = formatCurrencyAmount(amount, selectedCurrency);

  const handleCopy = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      onNotify(`${label} copié dans le presse-papiers.`, 'success');
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      onNotify('Impossible de copier automatiquement.', 'error');
    }
  };

  const handleCopyAllRib = () => {
    const full = [
      `Bénéficiaire : ${currencyInfo.beneficiary}`,
      `Banque : ${currencyInfo.bankName}`,
      `${currencyInfo.accountLabel} : ${currencyInfo.accountNumber}`,
      `${currencyInfo.secondaryLabel} : ${currencyInfo.secondaryCode}`,
      `Montant exact : ${formattedAmount}`,
      `Référence obligatoire : ${reference}`,
    ].join('\n');
    handleCopy('all', full, 'RIB complet');
  };

  const handleDownloadTransferPdf = async (sub?: BankTransferSubmission) => {
    const targetPlanLabel = sub?.planLabel || selectedPlan.name;
    const targetCurrency = sub?.currency || selectedCurrency;
    const targetCurrencyCfg = CURRENCIES[targetCurrency];
    const targetAmount = sub?.formattedAmount || formattedAmount;
    const targetRef = sub?.reference || reference;
    const targetCycle =
      (sub?.cycle || cycle) === 'annual' ? 'Annuel (-25 %)' : 'Mensuel';
    const targetPayer = sub?.payerName || payerName || 'Client PDFExpress';
    const targetEmail = sub?.payerEmail || payerEmail || 'Non renseigné';
    const targetDate = sub?.transferDate || transferDate;

    const lines = [
      `DOCUMENT : ORDRE DE VIREMENT BANCAIRE / JUSTIFICATIF PREMIUM`,
      `Statut : ${
        sub ? 'En attente de verification bancaire' : 'Devis / Instructions de virement'
      }`,
      ``,
      `1. DETAILS DE L'ABONNEMENT`,
      `Formule choisie : PDFExpress ${targetPlanLabel}`,
      `Facturation : ${targetCycle}`,
      `Devise de reglement : ${targetCurrencyCfg.label}`,
      `Montant total a virer : ${targetAmount}`,
      `Reference unique de virement : ${targetRef}`,
      ``,
      `2. COORDONNEES BANCAIRES DU BENEFICIAIRE (${targetCurrency})`,
      `Beneficiaire : ${targetCurrencyCfg.beneficiary}`,
      `Etablissement bancaire : ${targetCurrencyCfg.bankName}`,
      `${targetCurrencyCfg.accountLabel} : ${targetCurrencyCfg.accountNumber}`,
      `${targetCurrencyCfg.secondaryLabel} : ${targetCurrencyCfg.secondaryCode}`,
      `Adresse banque : ${targetCurrencyCfg.bankAddress}`,
      `Delai habituel : ${targetCurrencyCfg.processingDelay}`,
      ``,
      `3. INFORMATIONS EMETTEUR`,
      `Titulaire / Societe : ${targetPayer}`,
      `E-mail de facturation : ${targetEmail}`,
      `Date d'execution : ${targetDate}`,
      ``,
      `Merci d'indiquer imperativement la reference "${targetRef}" dans le libelle de votre virement.`,
    ].join('\n');

    const pdfDoc = await createFormattedTextPdf(
      lines,
      `PDFExpress Premium - Virement ${targetCurrency}`
    );
    const bytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Virement_${targetRef}_${targetCurrency}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify('Ordre de virement PDF téléchargé.', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName.trim()) {
      onNotify('Veuillez saisir votre nom complet ou raison sociale.', 'error');
      return;
    }
    if (!payerEmail.trim() || !payerEmail.includes('@')) {
      onNotify('Veuillez saisir une adresse e-mail valide.', 'error');
      return;
    }
    if (!reference.trim()) {
      onNotify('Veuillez saisir une référence de virement.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/billing/bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim(),
          planId,
          planLabel: selectedPlan.name,
          cycle,
          currency: selectedCurrency,
          amount,
          formattedAmount,
          payerName: payerName.trim(),
          payerEmail: payerEmail.trim(),
          bankOrigin: bankOrigin.trim(),
          transferDate,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        submission?: BankTransferSubmission;
        error?: string;
      };
      if (!res.ok || !data.submission) {
        throw new Error(
          data.error || 'Impossible d’enregistrer le virement bancaire.'
        );
      }
      onTransferSubmitted(data.submission);
      onNotify(
        `Virement ${data.submission.reference} (${formattedAmount}) enregistré !`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Erreur lors de la validation.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="premium-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-4xl bg-white dark:bg-brand-cardDark rounded-3xl border border-neutral-200 dark:border-brand-borderDark shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
          >
            {/* En-tête */}
            <div className="px-6 py-5 border-b border-neutral-200 dark:border-brand-borderDark flex items-center justify-between gap-4 bg-amber-50/70 dark:bg-amber-950/20">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-amber-400 text-neutral-900 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </span>
                <div>
                  <h2
                    id="premium-modal-title"
                    className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-white"
                  >
                    PDFExpress Premium — Paiement par Virement Bancaire
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Réglez votre abonnement en toute sécurité en MAD, DOLLAR (USD) ou EURO (EUR)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-9 h-9 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-brand-red flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenu défilant */}
            <div className="p-6 overflow-y-auto space-y-6">
              {activeTransfer ? (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Virement déclaré · En attente de vérification
                        </p>
                        <h3 className="text-xl font-extrabold text-neutral-900 dark:text-white mt-0.5">
                          PDFExpress {activeTransfer.planLabel} ({activeTransfer.formattedAmount})
                        </h3>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          Référence : <strong className="font-mono">{activeTransfer.reference}</strong> · Titulaire : {activeTransfer.payerName} ({activeTransfer.payerEmail})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white dark:bg-neutral-900/80 p-4 rounded-xl border border-emerald-100 dark:border-neutral-800">
                    <div>
                      <span className="text-neutral-400 block">Devise & Montant</span>
                      <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                        {activeTransfer.formattedAmount} ({activeTransfer.cycle === 'annual' ? 'Annuel' : 'Mensuel'})
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Date du virement</span>
                      <span className="font-bold text-neutral-900 dark:text-white tabular-nums">
                        {activeTransfer.transferDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">Banque émettrice</span>
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {activeTransfer.bankOrigin || 'Virement standard / SWIFT / SEPA'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadTransferPdf(activeTransfer)}
                      className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-brand-redHover text-white text-xs font-bold inline-flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger le justificatif PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setReference(generateReference());
                        onResetTransfer();
                      }}
                      className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:border-brand-red inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Effectuer un autre virement</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Barre Devise + Cycle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                        1. Choisissez votre devise de virement
                      </p>
                      <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1">
                        {(['MAD', 'USD', 'EUR'] as CurrencyCode[]).map((code) => {
                          const active = selectedCurrency === code;
                          const labelMap: Record<CurrencyCode, string> = {
                            MAD: 'MAD (DH)',
                            USD: 'DOLLAR ($)',
                            EUR: 'EURO (€)',
                          };
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => onCurrencyChange(code)}
                              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all ${
                                active
                                  ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-sm'
                                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                              }`}
                            >
                              {labelMap[code]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                        2. Périodicité
                      </p>
                      <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setCycle('monthly')}
                          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            cycle === 'monthly'
                              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
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
                              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          Annuel (-25 %)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Choix des formules */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PREMIUM_PLANS.map((plan) => {
                      const active = planId === plan.id;
                      const price = plan.prices[selectedCurrency][cycle];
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setPlanId(plan.id)}
                          className={`text-left rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                            active
                              ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 shadow-md'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-base font-extrabold text-neutral-900 dark:text-white">
                                {plan.name}
                              </span>
                              <span className="text-lg font-extrabold text-brand-red tabular-nums">
                                {formatCurrencyAmount(price, selectedCurrency)}
                                <span className="text-xs font-medium text-neutral-500">
                                  /{cycle === 'annual' ? 'an' : 'mois'}
                                </span>
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                              {plan.tagline}
                            </p>
                            <ul className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-200">
                              {plan.features.map((feat, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Coordonnées bancaires + Formulaire de déclaration */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Colonne Gauche : Coordonnées bancaires dynamiques */}
                    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-5 space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-5 h-5 text-brand-red" />
                          <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                            Coordonnées bancaires ({currencyInfo.shortLabel})
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyAllRib}
                          className="text-xs font-bold text-brand-red hover:underline inline-flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Tout copier</span>
                        </button>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        {[
                          {
                            key: 'beneficiary',
                            label: 'Bénéficiaire',
                            value: currencyInfo.beneficiary,
                          },
                          {
                            key: 'bank',
                            label: 'Banque',
                            value: currencyInfo.bankName,
                          },
                          {
                            key: 'account',
                            label: currencyInfo.accountLabel,
                            value: currencyInfo.accountNumber,
                            mono: true,
                          },
                          {
                            key: 'swift',
                            label: currencyInfo.secondaryLabel,
                            value: currencyInfo.secondaryCode,
                            mono: true,
                          },
                          {
                            key: 'amount',
                            label: 'Montant exact à virer',
                            value: formattedAmount,
                            highlight: true,
                          },
                          {
                            key: 'ref',
                            label: 'Motif / Référence obligatoire',
                            value: reference,
                            mono: true,
                            highlight: true,
                          },
                        ].map((row) => (
                          <div
                            key={row.key}
                            className="flex items-center justify-between gap-2 bg-white dark:bg-brand-cardDark px-3 py-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800"
                          >
                            <div className="min-w-0">
                              <span className="block text-[10px] uppercase font-bold text-neutral-400">
                                {row.label}
                              </span>
                              <span
                                className={`block truncate ${
                                  row.mono ? 'font-mono' : ''
                                } ${
                                  row.highlight
                                    ? 'font-extrabold text-brand-red'
                                    : 'font-semibold text-neutral-800 dark:text-neutral-100'
                                }`}
                              >
                                {row.value}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(row.key, row.value, row.label)
                              }
                              aria-label={`Copier ${row.label}`}
                              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-brand-red shrink-0"
                            >
                              {copiedKey === row.key ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{currencyInfo.processingDelay}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadTransferPdf()}
                          className="font-bold text-neutral-700 dark:text-neutral-200 hover:text-brand-red inline-flex items-center gap-1 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>RIB PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Colonne Droite : Confirmation du virement */}
                    <form
                      onSubmit={handleSubmit}
                      className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-brand-cardDark p-5 space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-emerald-600" />
                          <span>Confirmer mon virement bancaire</span>
                        </h3>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                            Nom complet ou Raison sociale *
                          </label>
                          <input
                            type="text"
                            required
                            value={payerName}
                            onChange={(e) => setPayerName(e.target.value)}
                            placeholder="ex: Nadia El Amrani / Atlas Conseil"
                            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs sm:text-sm outline-none focus:border-brand-red"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                            E-mail pour recevoir la licence *
                          </label>
                          <input
                            type="email"
                            required
                            value={payerEmail}
                            onChange={(e) => setPayerEmail(e.target.value)}
                            placeholder="ex: contact@entreprise.com"
                            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs sm:text-sm outline-none focus:border-brand-red"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                              Banque émettrice
                            </label>
                            <input
                              type="text"
                              value={bankOrigin}
                              onChange={(e) => setBankOrigin(e.target.value)}
                              placeholder="ex: CIH, BNP, Wise..."
                              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs sm:text-sm outline-none focus:border-brand-red"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                              Date du virement
                            </label>
                            <input
                              type="date"
                              value={transferDate}
                              onChange={(e) => setTransferDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs sm:text-sm outline-none focus:border-brand-red"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                            Référence de l’ordre de virement *
                          </label>
                          <input
                            type="text"
                            required
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs sm:text-sm font-mono outline-none focus:border-brand-red"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 px-5 rounded-xl bg-brand-red hover:bg-brand-redHover text-white font-bold text-sm transition-colors disabled:opacity-50"
                      >
                        {isSubmitting
                          ? 'Enregistrement en cours...'
                          : `Valider le virement (${formattedAmount})`}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
