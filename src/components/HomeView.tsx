import {
  ArrowUpRight,
  Building2,
  Check,
  Crown,
  Image as ImageIcon,
  Laptop,
  Lock,
  Search,
  SearchX,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  CURRENCIES,
  PREMIUM_PLANS,
  formatCurrencyAmount,
} from '../data/premiumPlans';
import { CATEGORIES, TOOLS } from '../data/tools';
import type { CategoryId, CurrencyCode, ToolId } from '../types/pdf';
import { ToolIcon } from './ToolIcon';
import { motion, AnimatePresence } from 'motion/react';

interface HomeViewProps {
  activeCategory: CategoryId;
  onCategoryChange: (cat: CategoryId) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onResetFilters: () => void;
  onSelectTool: (id: ToolId) => void;
  onOpenInfoPage: (pageId: string) => void;
  selectedCurrency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  onOpenPremium: () => void;
  onOpenPricing?: () => void;
  isPremiumOrTrial?: boolean;
}

export function HomeView({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onResetFilters,
  onSelectTool,
  onOpenInfoPage,
  selectedCurrency,
  onCurrencyChange,
  onOpenPremium,
  onOpenPricing,
  isPremiumOrTrial = false,
}: HomeViewProps) {
  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredTools = TOOLS.filter((t) => {
    const matchCat =
      activeCategory === 'all' ||
      (activeCategory === 'convertir'
        ? t.cat === 'convertir_en' || t.cat === 'convertir_depuis'
        : t.cat === activeCategory);
    const matchSearch =
      !normalizedQuery ||
      t.title.toLowerCase().includes(normalizedQuery) ||
      t.desc.toLowerCase().includes(normalizedQuery) ||
      t.catLabel.toLowerCase().includes(normalizedQuery);
    return matchCat && matchSearch;
  });

  return (
    <main className="flex-grow flex flex-col">
      {/* Hero Section */}
      <section
        id="hero-top"
        className="scroll-mt-20 pt-8 sm:pt-10 pb-5 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto text-center"
      >
        <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight leading-[1.15] mb-4 max-w-4xl mx-auto [text-wrap:balance]">
          Tous les outils nécessaires pour travailler sur vos PDF, en un seul endroit
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto leading-relaxed">
          Tous les outils dont vous avez besoin pour utiliser les PDF, à portée de main. Ils sont tous 100 % gratuits et simples d’utilisation : fusionnez, divisez, compressez, convertissez, faites pivoter, déverrouillez, signez et résumez vos PDF en quelques clics.
        </p>

        {/* Recherche mobile & tablette */}
        <div className="mt-5 xl:hidden max-w-md mx-auto relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Rechercher parmi les ${TOOLS.length} outils...`}
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark text-sm outline-none focus:border-brand-red"
          />
        </div>

        {/* Barre de filtres par catégorie (défilement tactile horizontal sur mobile/tablette, centrée multi-lignes sur PC) */}
        <div className="mt-7 flex lg:flex-wrap lg:justify-center items-center overflow-x-auto no-scrollbar whitespace-nowrap gap-2 pb-2">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'bg-white dark:bg-brand-cardDark text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-brand-borderDark hover:border-brand-red'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Grille des outils */}
      <section
        id="tools-catalog"
        className="scroll-mt-20 pb-14 pt-3 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto"
      >
        {filteredTools.length === 0 ? (
          <div className="text-center py-16">
            <SearchX className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
            <p className="text-lg font-bold text-neutral-700 dark:text-neutral-300">
              Aucun outil ne correspond à votre recherche
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 min-h-[44px] px-4 text-sm font-bold text-brand-red hover:underline"
            >
              Afficher tous les outils
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
            <AnimatePresence mode="popLayout">
              {filteredTools.map((t, index) => {
                const isWorkflow = t.id === 'workflow';
                return (
                  <motion.button
                    key={t.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{
                      duration: 0.28,
                      delay: Math.min(index * 0.02, 0.2),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={{
                      scale: 1.03,
                      y: -4,
                      transition: { type: 'spring', stiffness: 450, damping: 18 },
                    }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => onSelectTool(t.id)}
                    className={`tool-card h-full min-h-[168px] text-left rounded-2xl p-4 sm:p-5 border cursor-pointer flex flex-col justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
                      isWorkflow
                        ? 'bg-neutral-100/90 dark:bg-neutral-800/70 border-neutral-200 dark:border-neutral-700 hover:border-brand-red'
                        : 'bg-white dark:bg-brand-cardDark border-neutral-200/80 dark:border-brand-borderDark hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-xl'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div
                          className={`w-11 h-11 rounded-xl ${t.badge} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}
                        >
                          <ToolIcon name={t.icon} className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {t.isPro && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${
                                isPremiumOrTrial
                                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-400/90 text-neutral-900'
                              }`}
                            >
                              <Crown className="w-3 h-3" />
                              <span>PRO</span>
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 truncate">
                            {t.catLabel}
                          </span>
                        </div>
                      </div>
                      <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5 group-hover:text-brand-red transition-colors">
                        {t.title}
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-3">
                        {t.desc}
                      </p>
                    </div>
                    {isWorkflow && (
                      <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center gap-1 text-xs font-bold text-neutral-800 dark:text-neutral-100 group-hover:text-brand-red">
                        <span>Créer un flux de travail</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Section : Travaillez à votre façon */}
      <section
        id="work-your-way"
        className="scroll-mt-20 py-14 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto border-t border-neutral-200/80 dark:border-brand-borderDark"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-neutral-900 dark:text-white mb-10">
          Travaillez à votre façon
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          <button
            type="button"
            onClick={() => onOpenInfoPage('desktop')}
            className="text-left bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 hover:shadow-lg transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-brand-red flex items-center justify-center mb-4">
                <Laptop className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-brand-red transition-colors">
                Travaillez hors ligne avec l’application Bureau
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Éditez et gérez vos documents par lots localement, sans connexion Internet et sans aucune limite.
              </p>
            </div>
            <div className="mt-5 flex justify-end text-neutral-500 group-hover:text-brand-red">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpenInfoPage('mobile')}
            className="text-left bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 hover:shadow-lg transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-brand-red transition-colors">
                Travaillez sur le pouce avec l’appli Mobile
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Vos outils préférés disponibles à tout moment. Continuez à travailler sur vos projets où que vous soyez.
              </p>
            </div>
            <div className="mt-5 flex justify-end text-neutral-500 group-hover:text-brand-red">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpenInfoPage('enterprise')}
            className="text-left bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 hover:shadow-lg transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-brand-red transition-colors">
                Conçu pour les entreprises
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Automatisez la gestion des documents, intégrez vos équipes et adaptez vos flux selon vos besoins.
              </p>
            </div>
            <div className="mt-5 flex justify-end text-neutral-500 group-hover:text-brand-red">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      </section>

      {/* Section : Allez plus loin avec Premium + Édition d'images */}
      <section
        id="premium-section"
        className="scroll-mt-20 py-10 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div className="rounded-3xl bg-amber-50/90 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-900/40 p-7 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                Allez plus loin avec Premium
              </h2>
              <div className="inline-flex rounded-xl bg-white/80 dark:bg-neutral-900/80 border border-amber-200 dark:border-amber-800/50 p-1 gap-1">
                {(['MAD', 'USD', 'EUR'] as CurrencyCode[]).map((code) => {
                  const labels: Record<CurrencyCode, string> = {
                    MAD: 'MAD',
                    USD: 'DOLLAR',
                    EUR: 'EURO',
                  };
                  const active = selectedCurrency === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onCurrencyChange(code)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                        active
                          ? 'bg-amber-400 text-neutral-900 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      {labels[code]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5 rounded-2xl bg-white/75 dark:bg-neutral-900/60 border border-amber-200/70 dark:border-amber-900/40 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                  {PREMIUM_PLANS[0].name} · Virement bancaire
                </span>
                <span className="text-xl font-extrabold text-neutral-900 dark:text-white tabular-nums">
                  {formatCurrencyAmount(
                    PREMIUM_PLANS[0].prices[selectedCurrency].monthly,
                    selectedCurrency
                  )}{' '}
                  <span className="text-xs font-semibold text-neutral-500">
                    / mois
                  </span>
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                ou{' '}
                {formatCurrencyAmount(
                  PREMIUM_PLANS[0].prices[selectedCurrency].annual,
                  selectedCurrency
                )}{' '}
                / an (-25 %)
              </span>
            </div>

            <ul className="space-y-3 text-sm text-neutral-700 dark:text-neutral-200 mb-6">
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Paiement par virement bancaire disponible en{' '}
                  <strong>{CURRENCIES[selectedCurrency].label}</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Modifiez des PDF, utilisez l’OCR avancé par IA et apposez des signatures mémorisées.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  RIB / IBAN / SWIFT et justificatif d’ordre de virement PDF téléchargeables en un clic.
                </span>
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenPremium}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-900 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Crown className="w-4 h-4" />
              <span>Demander l’activation Premium</span>
            </button>
            {onOpenPricing && (
              <button
                type="button"
                onClick={onOpenPricing}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/90 dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 text-neutral-800 dark:text-neutral-100 font-bold text-sm hover:border-brand-red transition-colors"
              >
                Voir tous les tarifs
              </button>
            )}
          </div>
        </div>

        <div
          id="image-editing"
          className="scroll-mt-20 rounded-3xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-7 sm:p-8 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white mb-3">
              L’édition des images en toute simplicité
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
              Convertissez vos photos JPG, PNG et WebP en documents PDF soignés, ou numérisez vos documents papier avec amélioration automatique du contraste.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectTool('jpg2pdf')}
              className="px-5 py-2.5 rounded-xl border border-brand-red text-brand-red hover:bg-brand-red hover:text-white font-bold text-sm transition-colors"
            >
              Ouvrir JPG en PDF
            </button>
            <button
              type="button"
              onClick={() => onSelectTool('scan2pdf')}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-brand-red font-bold text-sm transition-colors"
            >
              Numériser en PDF
            </button>
          </div>
        </div>
      </section>

      {/* Section Confiance & Sécurité */}
      <section
        id="trust-security"
        className="scroll-mt-20 bg-white dark:bg-brand-cardDark border-t border-neutral-200 dark:border-brand-borderDark py-14 px-4 sm:px-6 lg:px-8 mt-6"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-3 [text-wrap:balance]">
            Des millions d’utilisateurs s’appuient sur nos outils PDF
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed mb-8">
            PDFExpress réunit {TOOLS.length} outils pour éditer, convertir, signer et automatiser vos PDF tout en garantissant la sécurité locale de vos données.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-neutral-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => onOpenInfoPage('security')}
              className="inline-flex items-center gap-2 hover:text-brand-red transition-colors"
            >
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>ISO / Archivage PDF/A</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenInfoPage('privacy')}
              className="inline-flex items-center gap-2 hover:text-brand-red transition-colors"
            >
              <Lock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              <span>Traitement local sécurisé</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
