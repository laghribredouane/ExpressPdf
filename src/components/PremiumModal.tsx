import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Download,
  FileText,
  Landmark,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CURRENCIES,
  PREMIUM_PLANS,
  formatCurrencyAmount,
} from '../data/premiumPlans';
import { submitPremiumRequestToCloud } from '../services/saasService';
import type {
  BankTransferSubmission,
  BillingCycle,
  CurrencyCode,
} from '../types/pdf';
import {
  createFormattedTextPdf,
  loadPdfJsDocument,
  renderPdfPageToDataURL,
} from '../utils/pdfEngine';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCurrency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  activeTransfer: BankTransferSubmission | null;
  onTransferSubmitted: (submission: BankTransferSubmission) => void;
  onResetTransfer: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
  authUserId?: string | null;
  defaultPayerName?: string | null;
  defaultPayerEmail?: string | null;
  initialPlanId?: 'premium_pro' | 'premium_team';
  initialCycle?: BillingCycle;
  onRequireAuth?: () => void;
}

interface AttachedReceipt {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  sizeLabel: string;
}

const MAX_RECEIPT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_RECEIPT_DATA_URL_LENGTH = 650000;
const ALLOWED_IMAGE_MIME_RE = /^image\/(jpeg|jpg|png|webp|gif)$/i;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Lecture du fichier impossible.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsDataURL(file);
  });
}

function normalizeImageDataUrl(rawUrl: string): Promise<{
  dataUrl: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1400;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || 800) * scale));
      canvas.height = Math.max(1, Math.round((img.height || 600) * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas indisponible.'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL('image/jpeg', 0.82);
      if (out.length > MAX_RECEIPT_DATA_URL_LENGTH) {
        out = canvas.toDataURL('image/jpeg', 0.6);
      }
      resolve({ dataUrl: out, mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Image bancaire illisible.'));
    img.src = rawUrl;
  });
}

function formatReceiptSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
  authUserId,
  defaultPayerName,
  defaultPayerEmail,
  initialPlanId = 'premium_pro',
  initialCycle = 'annual',
  onRequireAuth,
}: PremiumModalProps) {
  const [planId, setPlanId] = useState<'premium_pro' | 'premium_team'>(
    initialPlanId
  );
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [reference, setReference] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<AttachedReceipt | null>(null);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const [payerName, setPayerName] = useState(defaultPayerName || '');
  const [payerEmail, setPayerEmail] = useState(defaultPayerEmail || '');
  const [bankOrigin, setBankOrigin] = useState('');
  const [transferDate, setTransferDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPlanId(initialPlanId);
    setCycle(initialCycle);
    if (defaultPayerName && !payerName) setPayerName(defaultPayerName);
    if (defaultPayerEmail && !payerEmail) setPayerEmail(defaultPayerEmail);
  }, [isOpen, initialPlanId, initialCycle, defaultPayerName, defaultPayerEmail, payerName, payerEmail]);

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
    const lines = [
      `Intitulé du compte / Bénéficiaire : ${currencyInfo.beneficiary}`,
      `Banque : ${currencyInfo.bankName}`,
      `${currencyInfo.accountLabel} : ${currencyInfo.accountNumber}`,
    ];
    if (currencyInfo.iban && currencyInfo.iban !== currencyInfo.accountNumber) {
      lines.push(`I.B.A.N. : ${currencyInfo.iban}`);
    }
    lines.push(
      `${currencyInfo.secondaryLabel} : ${currencyInfo.secondaryCode}`,
      `Adresse agence : ${currencyInfo.bankAddress} (Tél. : ${currencyInfo.agencyPhone})`,
      `Montant exact : ${formattedAmount}`
    );
    if (!receiptFile && reference.trim()) {
      lines.push(`Référence du virement : ${reference.trim()}`);
    }
    handleCopy('all', lines.join('\n'), 'RIB complet');
  };

  const handleDownloadTransferPdf = async (sub?: BankTransferSubmission) => {
    const targetPlanLabel = sub?.planLabel || selectedPlan.name;
    const targetCurrency = sub?.currency || selectedCurrency;
    const targetCurrencyCfg = CURRENCIES[targetCurrency];
    const targetAmount = sub?.formattedAmount || formattedAmount;
    const targetRef = (sub ? sub.reference : receiptFile ? '' : reference).trim();
    const targetReceiptName = sub?.receiptFileName || receiptFile?.fileName || '';
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
      `Reference de virement : ${
        targetRef ||
        (targetReceiptName
          ? `Non requise (justificatif joint : ${targetReceiptName})`
          : 'A renseigner par le client')
      }`,
      ``,
      `2. COORDONNEES BANCAIRES DU BENEFICIAIRE (${targetCurrency})`,
      `Intitule du compte : ${targetCurrencyCfg.beneficiary}`,
      `Etablissement bancaire : ${targetCurrencyCfg.bankName}`,
      `${targetCurrencyCfg.accountLabel} : ${targetCurrencyCfg.accountNumber}`,
      ...(targetCurrencyCfg.iban !== targetCurrencyCfg.accountNumber
        ? [`I.B.A.N. : ${targetCurrencyCfg.iban}`]
        : []),
      `${targetCurrencyCfg.secondaryLabel} : ${targetCurrencyCfg.secondaryCode}`,
      `Agence : ${targetCurrencyCfg.bankAgency} - Tel. : ${targetCurrencyCfg.agencyPhone}`,
      `Adresse agence : ${targetCurrencyCfg.bankAddress}`,
      `Delai habituel : ${targetCurrencyCfg.processingDelay}`,
      ``,
      `3. INFORMATIONS EMETTEUR`,
      `Titulaire / Societe : ${targetPayer}`,
      `E-mail de facturation : ${targetEmail}`,
      `Date d'execution : ${targetDate}`,
      ``,
      targetRef
        ? `Reference declaree par le client : "${targetRef}".`
        : targetReceiptName
        ? `Piece justificative bancaire jointe : "${targetReceiptName}".`
        : `Veuillez renseigner la reference de votre virement ou joindre un justificatif bancaire lors de la confirmation.`,
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
    a.download = targetRef
      ? `Virement_${targetRef}_${targetCurrency}.pdf`
      : `Virement_PDFExpress_${targetCurrency}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify('Ordre de virement PDF téléchargé.', 'success');
  };

  const handleReceiptSelect = async (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > MAX_RECEIPT_FILE_BYTES) {
      onNotify('Le justificatif ne doit pas dépasser 10 Mo.', 'error');
      return;
    }
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      onNotify(
        'Format non pris en charge. Joignez une image (JPG, PNG, WebP) ou un fichier PDF bancaire.',
        'error'
      );
      return;
    }

    setIsProcessingReceipt(true);
    try {
      if (isImage) {
        const rawUrl = await readFileAsDataUrl(file);
        if (
          ALLOWED_IMAGE_MIME_RE.test(file.type) &&
          rawUrl.length <= MAX_RECEIPT_DATA_URL_LENGTH
        ) {
          setReceiptFile({
            fileName: file.name,
            mimeType: file.type,
            dataUrl: rawUrl,
            sizeLabel: formatReceiptSize(file.size),
          });
        } else {
          const normalized = await normalizeImageDataUrl(rawUrl);
          if (normalized.dataUrl.length > 695000) {
            throw new Error(
              'Image trop volumineuse même après compression. Essayez une capture plus légère.'
            );
          }
          setReceiptFile({
            fileName: file.name,
            mimeType: normalized.mimeType,
            dataUrl: normalized.dataUrl,
            sizeLabel: formatReceiptSize(file.size),
          });
        }
        onNotify('Justificatif image ajouté.', 'success');
      } else {
        const rawPdfUrl = await readFileAsDataUrl(file);
        if (rawPdfUrl.length <= MAX_RECEIPT_DATA_URL_LENGTH) {
          setReceiptFile({
            fileName: file.name,
            mimeType: 'application/pdf',
            dataUrl: rawPdfUrl,
            sizeLabel: formatReceiptSize(file.size),
          });
          onNotify('Justificatif PDF bancaire ajouté.', 'success');
        } else {
          const buf = await file.arrayBuffer();
          const pdfDoc = await loadPdfJsDocument(buf);
          let renderedUrl = await renderPdfPageToDataURL(
            pdfDoc,
            1,
            1.4,
            'image/jpeg',
            0.82
          );
          if (renderedUrl.length > MAX_RECEIPT_DATA_URL_LENGTH) {
            renderedUrl = await renderPdfPageToDataURL(
              pdfDoc,
              1,
              1.0,
              'image/jpeg',
              0.68
            );
          }
          if (renderedUrl.length > 695000) {
            throw new Error(
              'PDF bancaire trop volumineux. Importez un reçu plus léger ou une capture image.'
            );
          }
          setReceiptFile({
            fileName: `${file.name.replace(/\.pdf$/i, '')}_page1.jpg`,
            mimeType: 'image/jpeg',
            dataUrl: renderedUrl,
            sizeLabel: formatReceiptSize(file.size),
          });
          onNotify(
            'Reçu PDF volumineux converti en aperçu haute netteté pour l’envoi.',
            'info'
          );
        }
      }
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Impossible de lire ce justificatif bancaire.',
        'error'
      );
    } finally {
      setIsProcessingReceipt(false);
      if (receiptInputRef.current) {
        receiptInputRef.current.value = '';
      }
    }
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
    const submittedReference = receiptFile ? '' : reference.trim();
    if (!submittedReference && !receiptFile) {
      onNotify(
        'Veuillez saisir une référence de paiement ou joindre un justificatif bancaire (image ou PDF).',
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/billing/bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: submittedReference,
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
          ...(receiptFile
            ? {
                receiptFileName: receiptFile.fileName,
                receiptMimeType: receiptFile.mimeType,
                receiptDataUrl: receiptFile.dataUrl,
              }
            : {}),
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

      if (authUserId) {
        await submitPremiumRequestToCloud({
          userId: authUserId,
          reference: submittedReference,
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
          ...(receiptFile
            ? {
                receiptFileName: receiptFile.fileName,
                receiptMimeType: receiptFile.mimeType,
                receiptDataUrl: receiptFile.dataUrl,
              }
            : {}),
        });
      } else if (onRequireAuth) {
        onNotify(
          'Virement noté localement. Connectez-vous pour l’associer à votre compte dans le tableau Admin.',
          'info'
        );
      }

      onTransferSubmitted(data.submission);
      const proofMsg = data.submission.reference
        ? data.submission.reference
        : `justificatif « ${data.submission.receiptFileName || 'pièce jointe'} »`;
      onNotify(
        `Demande d'activation (${proofMsg} · ${formattedAmount}) transmise !`,
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
          className="fixed inset-0 z-[85] flex items-center justify-center p-2 sm:p-5 overflow-y-auto"
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
            className="relative z-10 w-[95vw] sm:w-full max-w-4xl bg-white dark:bg-brand-cardDark rounded-3xl border border-neutral-200 dark:border-brand-borderDark shadow-2xl overflow-hidden my-auto max-h-[90dvh] flex flex-col"
          >
            {/* En-tête */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-200 dark:border-brand-borderDark flex items-center justify-between gap-3 bg-amber-50/70 dark:bg-amber-950/20">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-amber-400 text-neutral-900 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="premium-modal-title"
                    className="text-base sm:text-xl font-extrabold text-neutral-900 dark:text-white leading-tight"
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
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
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
                          {activeTransfer.reference ? (
                            <>
                              Référence :{' '}
                              <strong className="font-mono">
                                {activeTransfer.reference}
                              </strong>
                            </>
                          ) : (
                            <>
                              Justificatif joint :{' '}
                              <strong>
                                {activeTransfer.receiptFileName || 'Pièce bancaire'}
                              </strong>
                            </>
                          )}{' '}
                          · Titulaire : {activeTransfer.payerName} (
                          {activeTransfer.payerEmail})
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadTransferPdf(activeTransfer)}
                        className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-brand-redHover text-white text-xs font-bold inline-flex items-center gap-2 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Télécharger le justificatif PDF</span>
                      </button>

                      {activeTransfer.receiptDataUrl && (
                        <a
                          href={activeTransfer.receiptDataUrl}
                          download={
                            activeTransfer.receiptFileName ||
                            'justificatif-bancaire'
                          }
                          className="px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-neutral-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:border-emerald-500 inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Pièce jointe</span>
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReference('');
                        setReceiptFile(null);
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
                            label: 'Intitulé du compte / Bénéficiaire',
                            value: currencyInfo.beneficiary,
                          },
                          {
                            key: 'bank',
                            label: 'Banque & Agence',
                            value: currencyInfo.bankName,
                          },
                          {
                            key: 'account',
                            label: currencyInfo.accountLabel,
                            value: currencyInfo.accountNumber,
                            mono: true,
                          },
                          ...(currencyInfo.iban &&
                          currencyInfo.iban !== currencyInfo.accountNumber
                            ? [
                                {
                                  key: 'iban',
                                  label: 'I.B.A.N.',
                                  value: currencyInfo.iban,
                                  mono: true,
                                },
                              ]
                            : []),
                          {
                            key: 'swift',
                            label: currencyInfo.secondaryLabel,
                            value: currencyInfo.secondaryCode,
                            mono: true,
                          },
                          {
                            key: 'agencyAddress',
                            label: `Adresse agence (Tél. ${currencyInfo.agencyPhone})`,
                            value: currencyInfo.bankAddress,
                          },
                          {
                            key: 'amount',
                            label: 'Montant exact à virer',
                            value: formattedAmount,
                            highlight: true,
                          },
                          ...(!receiptFile && reference.trim()
                            ? [
                                {
                                  key: 'ref',
                                  label: 'Référence de paiement saisie',
                                  value: reference.trim(),
                                  mono: true,
                                  highlight: true,
                                },
                              ]
                            : []),
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

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{currencyInfo.processingDelay}</span>
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <a
                            href="/assets/aistudio/Cih_67882995.pdf"
                            download="RIB_CIH_BANK_RIDOUAN_LAGHRIB.pdf"
                            className="font-bold text-neutral-700 dark:text-neutral-200 hover:text-brand-red inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>RIB CIH</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDownloadTransferPdf()}
                            className="font-bold text-neutral-700 dark:text-neutral-200 hover:text-brand-red inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Ordre PDF</span>
                          </button>
                        </div>
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

                        <div className="pt-1 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                            Preuve de paiement (au choix : référence OU fichier) *
                          </p>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="block text-[11px] font-bold uppercase text-neutral-500">
                                Pièce justificative (Image ou PDF bancaire)
                              </label>
                              {reference.trim() && !receiptFile && (
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  Facultatif (référence saisie)
                                </span>
                              )}
                            </div>

                            <input
                              ref={receiptInputRef}
                              type="file"
                              accept="image/*,.pdf,application/pdf"
                              onChange={(e) =>
                                void handleReceiptSelect(e.target.files?.[0])
                              }
                              className="hidden"
                            />

                            {receiptFile ? (
                              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {receiptFile.mimeType.startsWith('image/') ? (
                                    <img
                                      src={receiptFile.dataUrl}
                                      alt={receiptFile.fileName}
                                      className="w-10 h-10 rounded-lg object-cover border border-emerald-200 dark:border-emerald-800 shrink-0"
                                    />
                                  ) : (
                                    <span className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/60 text-brand-red flex items-center justify-center shrink-0">
                                      <FileText className="w-5 h-5" />
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                      {receiptFile.fileName}
                                    </p>
                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                      Justificatif prêt · {receiptFile.sizeLabel}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setReceiptFile(null)}
                                  aria-label="Retirer le justificatif"
                                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red inline-flex items-center gap-1 shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Retirer</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isProcessingReceipt}
                                onClick={() => receiptInputRef.current?.click()}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  void handleReceiptSelect(
                                    e.dataTransfer.files?.[0]
                                  );
                                }}
                                className="w-full px-3 py-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-brand-red bg-neutral-50/70 dark:bg-neutral-900/40 text-xs text-neutral-600 dark:text-neutral-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                              >
                                <Upload className="w-4 h-4 text-brand-red shrink-0" />
                                <span>
                                  {isProcessingReceipt
                                    ? 'Préparation du justificatif...'
                                    : 'Joindre un reçu bancaire (capture JPG/PNG ou PDF)'}
                                </span>
                              </button>
                            )}
                          </div>

                          {!receiptFile && (
                            <div>
                              <label className="block text-[11px] font-bold uppercase text-neutral-500 mb-1">
                                Ou référence de paiement / virement *
                              </label>
                              <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Saisissez la référence figurant sur votre virement"
                                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs sm:text-sm font-mono outline-none focus:border-brand-red"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting || isProcessingReceipt}
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
