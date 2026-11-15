import type { BillingCycle, CurrencyCode } from '../types/pdf';

export interface CurrencyConfig {
  code: CurrencyCode;
  label: string;
  shortLabel: string;
  symbol: string;
  bankName: string;
  beneficiary: string;
  accountLabel: string;
  accountNumber: string;
  iban: string;
  secondaryLabel: string;
  secondaryCode: string;
  bankAgency: string;
  bankAddress: string;
  agencyPhone: string;
  processingDelay: string;
}

const CIH_BANK_COMMON = {
  bankName: 'CIH BANK',
  beneficiary: 'RIDOUAN LAGHRIB',
  rib: '230 480 2791812211019600 43',
  iban: 'MA64 2304 8027 9181 2211 0196 0043',
  bicSwift: 'CIHMMAMC',
  bankAgency: 'MEKNES AL BASSATINE',
  bankAddress: 'LOTISSMT ALEM 5, LOT5 AL BASSATINE MEKNES',
  agencyPhone: '4747',
};

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  MAD: {
    code: 'MAD',
    label: 'Dirham Marocain (MAD)',
    shortLabel: 'MAD',
    symbol: 'MAD',
    bankName: `${CIH_BANK_COMMON.bankName} — ${CIH_BANK_COMMON.bankAgency}`,
    beneficiary: CIH_BANK_COMMON.beneficiary,
    accountLabel: 'R.I.B. National (24 chiffres)',
    accountNumber: CIH_BANK_COMMON.rib,
    iban: CIH_BANK_COMMON.iban,
    secondaryLabel: 'Code B.I.C / SWIFT',
    secondaryCode: CIH_BANK_COMMON.bicSwift,
    bankAgency: CIH_BANK_COMMON.bankAgency,
    bankAddress: CIH_BANK_COMMON.bankAddress,
    agencyPhone: CIH_BANK_COMMON.agencyPhone,
    processingDelay: 'Virement national CIH / Maroc (instantané ou 24 h ouvrées)',
  },
  USD: {
    code: 'USD',
    label: 'Dollar Américain (DOLLAR)',
    shortLabel: 'DOLLAR ($)',
    symbol: '$',
    bankName: `${CIH_BANK_COMMON.bankName} — ${CIH_BANK_COMMON.bankAgency}`,
    beneficiary: CIH_BANK_COMMON.beneficiary,
    accountLabel: 'I.B.A.N. International',
    accountNumber: CIH_BANK_COMMON.iban,
    iban: CIH_BANK_COMMON.iban,
    secondaryLabel: 'Code B.I.C / SWIFT',
    secondaryCode: CIH_BANK_COMMON.bicSwift,
    bankAgency: CIH_BANK_COMMON.bankAgency,
    bankAddress: `${CIH_BANK_COMMON.bankAddress}, Maroc`,
    agencyPhone: CIH_BANK_COMMON.agencyPhone,
    processingDelay: 'Virement international SWIFT en USD (1 à 3 jours ouvrés)',
  },
  EUR: {
    code: 'EUR',
    label: 'Euro (EURO)',
    shortLabel: 'EURO (€)',
    symbol: '€',
    bankName: `${CIH_BANK_COMMON.bankName} — ${CIH_BANK_COMMON.bankAgency}`,
    beneficiary: CIH_BANK_COMMON.beneficiary,
    accountLabel: 'I.B.A.N. International',
    accountNumber: CIH_BANK_COMMON.iban,
    iban: CIH_BANK_COMMON.iban,
    secondaryLabel: 'Code B.I.C / SWIFT',
    secondaryCode: CIH_BANK_COMMON.bicSwift,
    bankAgency: CIH_BANK_COMMON.bankAgency,
    bankAddress: `${CIH_BANK_COMMON.bankAddress}, Maroc`,
    agencyPhone: CIH_BANK_COMMON.agencyPhone,
    processingDelay: 'Virement international SWIFT en EUR (1 à 3 jours ouvrés)',
  },
};

export interface PremiumPlanDefinition {
  id: 'premium_pro' | 'premium_team';
  name: string;
  tagline: string;
  features: string[];
  prices: Record<CurrencyCode, Record<BillingCycle, number>>;
}

export const PREMIUM_PLANS: PremiumPlanDefinition[] = [
  {
    id: 'premium_pro',
    name: 'Premium Pro',
    tagline: 'Pour les professionnels et indépendants exigeants',
    features: [
      'Accès illimité aux 35 outils PDF & flux automatisés',
      'OCR Avancé par IA Gemini sur images et PDF scannés',
      'Signatures mémorisées et formulaires AcroForm avancés',
      'Priorité de traitement et export haute résolution',
    ],
    prices: {
      MAD: { monthly: 39, annual: 345 },
      USD: { monthly: 3.95, annual: 34 },
      EUR: { monthly: 3.49, annual: 29 },
    },
  },
  {
    id: 'premium_team',
    name: 'Premium Équipe',
    tagline: 'Jusqu’à 10 collaborateurs avec facturation centralisée',
    features: [
      'Tout le plan Premium Pro pour jusqu’à 10 utilisateurs',
      'Modèles de flux de travail partagés et archivage PDF/A',
      'Justificatif de virement et facture PDF nominative',
      'Support prioritaire dédié par e-mail',
    ],
    prices: {
      MAD: { monthly: 99, annual: 895 },
      USD: { monthly: 9.95, annual: 89 },
      EUR: { monthly: 8.99, annual: 79 },
    },
  },
];

export function formatCurrencyAmount(amount: number, currency: CurrencyCode): string {
  if (currency === 'MAD') {
    return `${amount.toLocaleString('fr-FR')} MAD`;
  }
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    })} USD`;
  }
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })} € EUR`;
}
