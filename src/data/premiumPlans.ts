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
  secondaryLabel: string;
  secondaryCode: string;
  bankAddress: string;
  processingDelay: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  MAD: {
    code: 'MAD',
    label: 'Dirham Marocain (MAD)',
    shortLabel: 'MAD',
    symbol: 'MAD',
    bankName: 'Attijariwafa Bank — Centre d’Affaires',
    beneficiary: 'PDFEXPRESS DIGITAL SARL',
    accountLabel: 'RIB National (24 chiffres)',
    accountNumber: '007 780 0004521000308912 45',
    secondaryLabel: 'Code SWIFT / BIC',
    secondaryCode: 'BCMAMAMC',
    bankAddress: '2 Boulevard Moulay Youssef, Casablanca 20000, Maroc',
    processingDelay: '24 h ouvrées (virement national instantané ou standard)',
  },
  USD: {
    code: 'USD',
    label: 'Dollar Américain (DOLLAR)',
    shortLabel: 'DOLLAR ($)',
    symbol: '$',
    bankName: 'Citibank N.A. — International Wire',
    beneficiary: 'PDFEXPRESS DIGITAL INC.',
    accountLabel: 'Numéro de compte / IBAN USD',
    accountNumber: 'US89 0210 0002 1845 9031 77',
    secondaryLabel: 'SWIFT / BIC & Routing ABA',
    secondaryCode: 'CITIUS33 · ABA 021000089',
    bankAddress: '388 Greenwich Street, New York, NY 10013, USA',
    processingDelay: '1 à 3 jours ouvrés (virement SWIFT / ACH)',
  },
  EUR: {
    code: 'EUR',
    label: 'Euro Zone SEPA (EURO)',
    shortLabel: 'EURO (€)',
    symbol: '€',
    bankName: 'BNP Paribas — Pôle Entreprises Europe',
    beneficiary: 'PDFEXPRESS EUROPE SAS',
    accountLabel: 'IBAN SEPA (EUR)',
    accountNumber: 'FR76 3000 4008 1200 0104 9281 432',
    secondaryLabel: 'Code BIC / SWIFT',
    secondaryCode: 'BNPAFRPPXXX',
    bankAddress: '16 Boulevard des Italiens, 75009 Paris, France',
    processingDelay: 'Instantané (SEPA Instant) ou 24 h ouvrées',
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
      MAD: { monthly: 79, annual: 690 },
      USD: { monthly: 7.9, annual: 69 },
      EUR: { monthly: 6.99, annual: 59 },
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
      MAD: { monthly: 199, annual: 1790 },
      USD: { monthly: 19.9, annual: 179 },
      EUR: { monthly: 17.99, annual: 159 },
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
