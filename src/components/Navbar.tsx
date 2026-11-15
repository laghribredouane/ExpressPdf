import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  Crown,
  Globe,
  Heart,
  History,
  LayoutGrid,
  LogIn,
  LogOut,
  MailCheck,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserPlus,
  X,
  Share2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  STUDIO_COPY,
  getCategoryLabel,
  getLocalizedToolMeta,
  normalizeLang,
} from '../data/studioI18n';
import { CATEGORIES, MENU_CATEGORIES, TOOLS } from '../data/tools';
import { FOOTER_COLUMNS } from '../data/siteLinks';
import type { EffectivePlanTier } from '../hooks/useSubscriptionAndQuota';
import type { CategoryId, RecentProcessedFile, ToolId } from '../types/pdf';
import { PWAInstallButton } from './PWAInstallButton';
import { ToolIcon } from './ToolIcon';

interface AuthUserSummary {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
}

interface NavbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onGoHome: () => void;
  onSelectTool: (id: ToolId) => void;
  onSelectCategory: (cat: CategoryId) => void;
  onNavigateSection: (sectionId: string) => void;
  onOpenInfoPage: (pageId: string) => void;
  onOpenPremium: () => void;
  hasPendingPremium?: boolean;
  recentFiles: RecentProcessedFile[];
  onClearRecentCache: () => void;
  onDeleteHistoryItem?: (id: string) => void;
  authUser: AuthUserSummary | null;
  isAuthBusy?: boolean;
  onOpenAuthModal: (mode: 'signup' | 'login') => void;
  onSignOut: () => void;
  onResendVerification?: () => void;
  onRefreshVerification?: () => void;
  workspaceConnected?: boolean;
  onOpenWorkspaceHub: () => void;
  effectiveTier?: EffectivePlanTier;
  countdownLabel?: string | null;
  remainingToday?: number | null;
  dailyLimit?: number | null;
  isAdmin?: boolean;
  onOpenPricing: () => void;
  onOpenAdmin: () => void;
  onOpenDocs?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const SIX_CORE_CATEGORIES = MENU_CATEGORIES.slice(0, 6);
const EXTRA_CATEGORIES = MENU_CATEGORIES.slice(6);

const LANG_OPTIONS = [
  { code: 'fr', label: 'FR', fullLabel: 'Français' },
  { code: 'en', label: 'EN', fullLabel: 'English' },
  { code: 'ar', label: 'AR', fullLabel: 'العربية' },
] as const;

export function Navbar({
  isDark,
  onToggleTheme,
  language = 'fr',
  onLanguageChange,
  searchQuery,
  onSearchChange,
  onGoHome,
  onSelectTool,
  onSelectCategory,
  onNavigateSection,
  onOpenInfoPage,
  onOpenPremium,
  hasPendingPremium = false,
  recentFiles,
  onClearRecentCache,
  onDeleteHistoryItem,
  authUser,
  isAuthBusy = false,
  onOpenAuthModal,
  onSignOut,
  onResendVerification,
  onRefreshVerification,
  workspaceConnected = false,
  onOpenWorkspaceHub,
  effectiveTier = 'guest',
  countdownLabel = null,
  remainingToday = null,
  dailyLimit = null,
  isAdmin = false,
  onOpenPricing,
  onOpenAdmin,
  onOpenDocs,
  onNotify,
}: NavbarProps) {
  const [openMenu, setOpenMenu] = useState<'convert' | 'all' | 'tablet-all' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<'nav' | 'grid' | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>('organiser');
  const [drawerSearch, setDrawerSearch] = useState('');

  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const lang = normalizeLang(language);
  const studioT = STUDIO_COPY[lang];
  const toPdf = TOOLS.filter((t) => t.cat === 'convertir_en');
  const fromPdf = TOOLS.filter((t) => t.cat === 'convertir_depuis');

  const drawerFilteredTools = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    if (!q) return [];
    return TOOLS.filter((t) => {
      const meta = getLocalizedToolMeta(t, lang);
      return (
        t.title.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.catLabel.toLowerCase().includes(q) ||
        meta.title.toLowerCase().includes(q) ||
        meta.desc.toLowerCase().includes(q) ||
        meta.catLabel.toLowerCase().includes(q)
      );
    });
  }, [drawerSearch, lang]);

  const handleToolClick = (id: ToolId) => {
    setOpenMenu(null);
    setDrawerOpen(null);
    setDrawerSearch('');
    onSelectTool(id);
  };

  const handleCategoryShortcut = (cat: CategoryId) => {
    setOpenMenu(null);
    setDrawerOpen(null);
    onSelectCategory(cat);
  };

  const handleInfoClick = (pageId: string) => {
    setOpenMenu(null);
    setDrawerOpen(null);
    onOpenInfoPage(pageId);
  };

  const cycleLanguage = () => {
    if (!onLanguageChange) return;
    const order = ['fr', 'en', 'ar'];
    const idx = order.indexOf(language);
    const next = order[(idx + 1) % order.length];
    onLanguageChange(next);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'PDFExpress – 34 Outils PDF Gratuits',
      text: 'Découvrez PDFExpress : la suite complète de 34 outils PDF et IA directement dans votre navigateur.',
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        onNotify?.('Lien copié dans le presse-papier !', 'success');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(window.location.href);
          onNotify?.('Lien copié dans le presse-papier !', 'success');
        } catch {
          onNotify?.('Impossible de partager le lien.', 'error');
        }
      }
    }
  };

  const compactStatusLabel =
    effectiveTier === 'premium_active'
      ? 'Premium'
      : effectiveTier === 'trial_active'
      ? 'Essai 7j'
      : 'Gratuit';

  const renderProBadge = (isPro?: boolean) =>
    isPro ? (
      <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/90 text-neutral-900 text-[9px] font-extrabold uppercase shrink-0">
        <Crown className="w-2.5 h-2.5" />
        <span>PRO</span>
      </span>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-brand-cardDark/95 backdrop-blur-md border-b border-neutral-200 dark:border-brand-borderDark">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 lg:gap-4">
          {/* ZONE 1 : Bouton Hamburger (<1024px) + Brand Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setDrawerOpen(drawerOpen === 'nav' ? null : 'nav')
              }
              aria-label="Ouvrir le menu complet"
              aria-expanded={drawerOpen === 'nav'}
              className="lg:hidden min-w-[44px] min-h-[44px] rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setDrawerOpen(null);
                onGoHome();
              }}
              className="flex items-center gap-1 font-display text-base min-[380px]:text-lg sm:text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-lg px-1 py-1"
            >
              <span>PDF</span>
              <Heart
                className="w-4 h-4 sm:w-5 sm:h-5 fill-brand-red text-brand-red shrink-0"
                aria-hidden="true"
              />
              <span>Express</span>
            </button>
          </div>

          {/* ZONE 2A : Barre Hybride Tablette (768px - 1023px) */}
          <nav
            aria-label="Navigation tablette"
            className="hidden md:flex lg:hidden items-center gap-1.5 min-w-0"
          >
            <button
              type="button"
              onClick={() => handleCategoryShortcut('organiser')}
              className="min-h-[44px] px-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-brand-red whitespace-nowrap shrink-0 transition-colors"
            >
              Organiser
            </button>
            <button
              type="button"
              onClick={() => handleCategoryShortcut('convertir')}
              className="min-h-[44px] px-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-brand-red whitespace-nowrap shrink-0 transition-colors"
            >
              Convertir
            </button>
            <button
              type="button"
              onClick={() => handleCategoryShortcut('modifier')}
              className="min-h-[44px] px-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-brand-red whitespace-nowrap shrink-0 transition-colors"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => handleCategoryShortcut('studio_image')}
              className="min-h-[44px] px-2.5 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 whitespace-nowrap shrink-0 transition-colors"
            >
              {studioT.studioName}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'tablet-all' ? null : 'tablet-all')
                }
                aria-expanded={openMenu === 'tablet-all'}
                className="min-h-[44px] px-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-extrabold text-neutral-900 dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-brand-red" />
                <span>Tous les outils ({TOOLS.length})</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    openMenu === 'tablet-all' ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </nav>

          {/* ZONE 2B : Navigation complète PC (>= 1024px) */}
          <nav
            aria-label="Navigation principale"
            className="hidden lg:flex items-center gap-3 xl:gap-5"
          >
            <button
              type="button"
              onClick={() => handleToolClick('merge')}
              className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red transition-colors whitespace-nowrap shrink-0 py-2"
            >
              Fusionner PDF
            </button>
            <button
              type="button"
              onClick={() => handleToolClick('split')}
              className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red transition-colors whitespace-nowrap shrink-0 py-2"
            >
              Diviser PDF
            </button>
            <button
              type="button"
              onClick={() => handleToolClick('compress')}
              className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red transition-colors whitespace-nowrap shrink-0 py-2"
            >
              Compresser PDF
            </button>
            <button
              type="button"
              onClick={() => handleCategoryShortcut('studio_image')}
              className="text-xs font-extrabold tracking-wide text-teal-700 dark:text-teal-300 hover:text-teal-600 dark:hover:text-teal-200 transition-colors whitespace-nowrap shrink-0 py-2"
            >
              {studioT.studioName}
            </button>

            {/* Dropdown Convertir PDF */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('convert')}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === 'convert' ? null : 'convert')
                }
                aria-expanded={openMenu === 'convert'}
                className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 py-2"
              >
                <span>Convertir PDF</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {openMenu === 'convert' && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 z-50">
                  <div className="w-[540px] max-w-[94vw] bg-white dark:bg-brand-cardDark rounded-2xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark p-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2.5 px-2">
                        Convertir en PDF
                      </p>
                      <div className="space-y-1">
                        {toPdf.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToolClick(t.id)}
                            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                          >
                            <span
                              className={`w-6 h-6 rounded-lg ${t.badge} flex items-center justify-center shrink-0`}
                            >
                              <ToolIcon name={t.icon} className="w-3.5 h-3.5" />
                            </span>
                            <span className="truncate">{t.title}</span>
                            {renderProBadge(t.isPro)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2.5 px-2">
                        Convertir depuis PDF
                      </p>
                      <div className="space-y-1">
                        {fromPdf.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToolClick(t.id)}
                            className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                          >
                            <span
                              className={`w-6 h-6 rounded-lg ${t.badge} flex items-center justify-center shrink-0`}
                            >
                              <ToolIcon name={t.icon} className="w-3.5 h-3.5" />
                            </span>
                            <span className="truncate">{t.title}</span>
                            {renderProBadge(t.isPro)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mega-Menu Desktop 6 colonnes parallèles */}
            <div
              className="static"
              onMouseEnter={() => setOpenMenu('all')}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'all' ? null : 'all')}
                aria-expanded={openMenu === 'all'}
                className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 py-2"
              >
                <span>Tous les outils PDF</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {openMenu === 'all' && (
                <div className="fixed left-1/2 -translate-x-1/2 top-16 pt-1 z-50 w-[1240px] max-w-[96vw]">
                  <div className="bg-white dark:bg-brand-cardDark rounded-2xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark p-5 max-h-[82vh] overflow-y-auto space-y-4">
                    <div className="grid grid-cols-6 gap-4">
                      {SIX_CORE_CATEGORIES.map((cat) => {
                        const catTools = TOOLS.filter((t) => t.cat === cat.id);
                        return (
                          <div key={cat.id} className="min-w-0">
                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 mb-2 px-2 truncate">
                              {cat.label}
                            </p>
                            <div className="space-y-1">
                              {catTools.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleToolClick(t.id)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors"
                                >
                                  <span
                                    className={`w-5 h-5 rounded ${t.badge} flex items-center justify-center shrink-0`}
                                  >
                                    <ToolIcon name={t.icon} className="w-3 h-3" />
                                  </span>
                                  <span className="truncate">{t.title}</span>
                                  {renderProBadge(t.isPro)}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Accès complémentaire Intelligence PDF, Studio Image & OCR, Flux de travail */}
                    <div className="pt-3 border-t border-neutral-100 dark:border-brand-borderDark grid grid-cols-3 gap-4">
                      {EXTRA_CATEGORIES.map((cat) => {
                        const catTools = TOOLS.filter((t) => t.cat === cat.id);
                        return (
                          <div key={cat.id} className="min-w-0">
                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 mb-2 px-2">
                              {getCategoryLabel(cat.id as CategoryId, cat.label, lang)}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {catTools.map((t) => {
                                const tMeta = getLocalizedToolMeta(t, lang);
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleToolClick(t.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                                  >
                                    <span
                                      className={`w-5 h-5 rounded ${t.badge} flex items-center justify-center shrink-0`}
                                    >
                                      <ToolIcon name={t.icon} className="w-3 h-3" />
                                    </span>
                                    <span>{tMeta.title}</span>
                                    {renderProBadge(t.isPro)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenPricing}
              className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red transition-colors whitespace-nowrap shrink-0 py-2"
            >
              Tarifs
            </button>

            {onOpenDocs && (
              <button
                type="button"
                onClick={onOpenDocs}
                className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red transition-colors whitespace-nowrap shrink-0 py-2 hidden sm:block"
              >
                Documentation
              </button>
            )}
          </nav>

          {/* ZONE 3 : Actions, Statut, Recherche, Langue, Compte, Admin, Thème */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Recherche rapide (Desktop) */}
            <div className="relative hidden xl:block w-40 2xl:w-48">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Rechercher..."
                aria-label="Rechercher un outil PDF"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-transparent focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-xs font-medium text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 outline-none transition-colors"
              />
            </div>

            {/* Badge statut rapide (Mobile + Tablette + PC) */}
            {countdownLabel ? (
              <button
                type="button"
                onClick={onOpenPricing}
                title={countdownLabel}
                className={`min-h-[38px] md:min-h-[44px] px-2 sm:px-3 rounded-xl font-extrabold text-[11px] sm:text-xs inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap ${
                  effectiveTier === 'premium_active'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-amber-400 hover:bg-amber-500 text-neutral-900'
                }`}
              >
                {effectiveTier === 'premium_active' ? (
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="lg:hidden">{compactStatusLabel}</span>
                <span className="hidden lg:inline max-w-[180px] truncate">
                  {countdownLabel}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPremium}
                title="Passer à PDFExpress Premium ou voir les tarifs"
                className="min-h-[38px] md:min-h-[44px] px-2 sm:px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-900 font-extrabold text-[11px] sm:text-xs inline-flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span className="lg:hidden">{compactStatusLabel}</span>
                <span className="hidden lg:inline">
                  {dailyLimit !== null && remainingToday !== null
                    ? `Gratuit (${remainingToday}/${dailyLimit})`
                    : 'Premium'}
                </span>
                {hasPendingPremium && (
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-amber-400"
                    aria-label="Virement enregistré"
                  />
                )}
              </button>
            )}

            {/* Bouton Admin (Tablette & PC si admin ; sur mobile dans le tiroir) */}
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                title="Tableau de Bord Administrateur SaaS (/admin)"
                className="hidden md:inline-flex min-h-[44px] px-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-brand-red hover:bg-red-100 font-extrabold text-xs items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="hidden 2xl:inline">Admin</span>
              </button>
            )}

            {/* Bouton Google Docs, Calendar & Gmail (Tablette & PC) */}
            <button
              type="button"
              onClick={onOpenWorkspaceHub}
              title="Ouvrir Google Docs, Calendar & Gmail"
              aria-label="Ouvrir Google Docs, Calendar et Gmail"
              className="hidden lg:inline-flex relative min-h-[44px] px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-bold text-xs items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="hidden 2xl:inline">Docs &amp; Workspace</span>
              {workspaceConnected && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900"
                  aria-label="Google Workspace connecté"
                />
              )}
            </button>

            {/* Bouton Connexion / Compte Cloud (Tablette & PC ; mobile dans le tiroir) */}
            {authUser ? (
              <button
                type="button"
                onClick={() => setRecentOpen((v) => !v)}
                title={`Connecté en tant que ${authUser.displayName || authUser.email || 'Utilisateur'}`}
                className="hidden md:inline-flex min-h-[44px] px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold items-center gap-1.5 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shrink-0 whitespace-nowrap"
              >
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <Cloud className="w-4 h-4 shrink-0" />
                )}
                <span className="hidden xl:inline max-w-[88px] truncate">
                  {authUser.displayName?.split(' ')[0] ||
                    authUser.email?.split('@')[0] ||
                    'Cloud'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isAuthBusy}
                onClick={() => onOpenAuthModal('login')}
                title="Créer un compte ou se connecter (E-mail ou Gmail)"
                className="hidden md:inline-flex min-h-[44px] px-3 rounded-xl bg-neutral-900 dark:bg-white hover:opacity-90 text-white dark:text-neutral-900 text-xs font-bold items-center gap-1.5 transition-opacity disabled:opacity-50 shrink-0 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>{isAuthBusy ? 'Connexion...' : 'Connexion'}</span>
              </button>
            )}

            {/* Historique récent (Tablette & PC) */}
            <div className="relative hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRecentOpen((v) => !v)}
                title={
                  authUser
                    ? 'Historique cloud synchronisé (Firestore)'
                    : 'Fichiers récemment traités (cache local)'
                }
                aria-label={`Historique des fichiers traités (${recentFiles.length})`}
                aria-expanded={recentOpen}
                className="relative min-h-[44px] px-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1.5 transition-colors shrink-0"
              >
                <History className="w-4 h-4" />
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold inline-flex items-center justify-center tabular-nums transition-colors ${
                    recentFiles.length > 0
                      ? authUser
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-red text-white'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {recentFiles.length}
                </span>
              </button>

              {recentFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearRecentCache();
                    setRecentOpen(false);
                  }}
                  title={
                    authUser
                      ? 'Effacer l’historique local et cloud'
                      : 'Effacer le cache local des fichiers récents'
                  }
                  aria-label="Effacer l'historique"
                  className="hidden 2xl:flex w-9 min-h-[44px] rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-brand-red hover:bg-red-50 dark:hover:bg-red-950/40 items-center justify-center transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {recentOpen && (
                <>
                  <div
                    onClick={() => setRecentOpen(false)}
                    className="fixed inset-0 z-40"
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full mt-2 z-50 w-88 max-w-[92vw] bg-white dark:bg-brand-cardDark rounded-2xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark p-4">
                    <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-100 dark:border-brand-borderDark">
                      <div>
                        <p className="text-xs font-extrabold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <span>Historique des traitements</span>
                          {authUser && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              <Cloud className="w-3 h-3" />
                              Cloud
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-neutral-400 tabular-nums">
                          {recentFiles.length} élément(s){' '}
                          {authUser ? 'sauvegardé(s) dans Firestore' : 'en cache local'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecentOpen(false)}
                        aria-label="Fermer"
                        className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {authUser ? (
                      <div className="mb-3 space-y-2">
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {authUser.photoURL ? (
                              <img
                                src={authUser.photoURL}
                                alt={authUser.displayName || 'Avatar'}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {(
                                  authUser.displayName ||
                                  authUser.email ||
                                  'U'
                                )[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                {authUser.displayName ||
                                  authUser.email?.split('@')[0] ||
                                  'Mon compte'}
                              </p>
                              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                {authUser.email}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onSignOut();
                              setRecentOpen(false);
                            }}
                            title="Se déconnecter"
                            className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red inline-flex items-center gap-1 shrink-0"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Sortir</span>
                          </button>
                        </div>

                        {authUser.emailVerified === false && (
                          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                              Adresse e-mail non vérifiée. Consultez votre boîte de réception.
                            </p>
                            <div className="flex items-center gap-1.5">
                              {onResendVerification && (
                                <button
                                  type="button"
                                  disabled={isAuthBusy}
                                  onClick={onResendVerification}
                                  className="flex-1 py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-900 text-[11px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <MailCheck className="w-3 h-3" />
                                  <span>Renvoyer</span>
                                </button>
                              )}
                              {onRefreshVerification && (
                                <button
                                  type="button"
                                  disabled={isAuthBusy}
                                  onClick={onRefreshVerification}
                                  className="flex-1 py-1 px-2 rounded-lg bg-white dark:bg-neutral-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-[11px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>J’ai vérifié</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          Créez un compte par e-mail ou avec Gmail pour synchroniser votre historique PDF dans le cloud.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={isAuthBusy}
                            onClick={() => {
                              setRecentOpen(false);
                              onOpenAuthModal('signup');
                            }}
                            className="py-2 px-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <UserPlus className="w-3.5 h-3.5 shrink-0" />
                            <span>Créer</span>
                          </button>
                          <button
                            type="button"
                            disabled={isAuthBusy}
                            onClick={() => {
                              setRecentOpen(false);
                              onOpenAuthModal('login');
                            }}
                            className="py-2 px-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                          >
                            <LogIn className="w-3.5 h-3.5 shrink-0" />
                            <span>Connexion</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {recentFiles.length === 0 ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 py-4 text-center">
                        Aucun fichier traité récemment.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {recentFiles.map((item) => (
                          <div
                            key={item.id}
                            className="group rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-between gap-2 px-2.5 py-2"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setRecentOpen(false);
                                handleToolClick(item.toolId);
                              }}
                              className="min-w-0 flex-grow text-left"
                            >
                              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{item.fileName}</span>
                                {item.cloudSynced && (
                                  <Cloud className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                              </p>
                              <p className="text-[11px] text-neutral-400 truncate">
                                {item.toolTitle} · {item.sizeFormatted}
                              </p>
                            </button>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-medium text-neutral-400 tabular-nums">
                                {new Date(item.processedAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {onDeleteHistoryItem && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteHistoryItem(item.id)}
                                  aria-label={`Supprimer ${item.fileName} de l'historique`}
                                  className="p-1 rounded-md text-neutral-400 hover:text-brand-red hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-brand-borderDark">
                      <button
                        type="button"
                        disabled={recentFiles.length === 0}
                        onClick={() => {
                          onClearRecentCache();
                          setRecentOpen(false);
                        }}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors bg-red-50 dark:bg-red-950/30 text-brand-red hover:bg-red-100 dark:hover:bg-red-950/60 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {authUser
                            ? 'Effacer l’historique cloud & local'
                            : 'Effacer le cache local'}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bouton Installation PWA (Desktop & Tablette) */}
            <PWAInstallButton variant="header" />

            {/* Bouton Partager (Web Share API) */}
            <button
              type="button"
              onClick={handleShare}
              title="Partager le lien de PDFExpress"
              aria-label="Partager"
              className="min-w-[40px] min-h-[44px] px-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 inline-flex items-center justify-center transition-colors shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Bouton Langue compact (Mobile, Tablette & PC) */}
            <button
              type="button"
              onClick={cycleLanguage}
              title={`Langue : ${language.toUpperCase()} (cliquer pour changer FR / EN / AR)`}
              aria-label={`Changer la langue (${language.toUpperCase()})`}
              className="min-w-[40px] min-h-[44px] px-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 inline-flex items-center justify-center gap-1 text-[11px] font-extrabold uppercase transition-colors shrink-0"
            >
              <Globe className="w-3.5 h-3.5 hidden sm:block" />
              <span>{language.toUpperCase()}</span>
            </button>

            {/* Bouton Grille rapide (PC) */}
            <button
              type="button"
              onClick={() =>
                setDrawerOpen(drawerOpen === 'grid' ? null : 'grid')
              }
              title="Accès rapide à tous les outils"
              aria-label="Accès rapide à tous les outils"
              className="hidden xl:flex min-w-[44px] min-h-[44px] rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 items-center justify-center transition-colors shrink-0"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* Bouton Thème Clair/Sombre */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
              aria-label={
                isDark ? 'Passer au thème clair' : 'Passer au thème sombre'
              }
              className="min-w-[44px] min-h-[44px] rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Bouton Partager (Web Share API) */}
            <button
              type="button"
              onClick={handleShare}
              title="Partager PDFExpress"
              aria-label="Partager PDFExpress"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BARRE DE RACCOURCIS HORIZONTALE MOBILE (< 768px) */}
        <div className="md:hidden border-t border-neutral-100 dark:border-brand-borderDark bg-neutral-50/80 dark:bg-neutral-900/60">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 py-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryShortcut(cat.id)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-[11px] font-bold hover:border-brand-red hover:text-brand-red whitespace-nowrap shrink-0 transition-colors ${
                  cat.id === 'studio_image'
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200'
                    : 'bg-white dark:bg-brand-cardDark border-neutral-200/80 dark:border-brand-borderDark text-neutral-700 dark:text-neutral-200'
                }`}
              >
                {getCategoryLabel(cat.id, cat.label, lang)}
              </button>
            ))}
          </div>
        </div>

        {/* MÉGA-MENU TACTILE TABLETTE (2 ou 3 colonnes) */}
        <AnimatePresence>
          {openMenu === 'tablet-all' && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setOpenMenu(null)}
                className="fixed inset-0 top-16 z-40 bg-black/35 backdrop-blur-[1px] lg:hidden"
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 -translate-x-1/2 top-16 pt-1.5 z-50 w-[94vw] max-w-4xl lg:hidden"
              >
                <div className="bg-white dark:bg-brand-cardDark rounded-2xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark p-5 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100 dark:border-brand-borderDark">
                    <span className="font-display text-sm font-extrabold text-neutral-900 dark:text-white">
                      Tous les outils PDFExpress ({TOOLS.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(null)}
                      aria-label="Fermer le menu"
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {MENU_CATEGORIES.map((cat) => {
                      const catTools = TOOLS.filter((t) => t.cat === cat.id);
                      return (
                        <div key={cat.id} className="min-w-0">
                          <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 mb-2 px-2">
                            {getCategoryLabel(cat.id as CategoryId, cat.label, lang)}
                          </p>
                          <div className="space-y-1">
                            {catTools.map((t) => {
                              const tMeta = getLocalizedToolMeta(t, lang);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleToolClick(t.id)}
                                  className="w-full min-h-[40px] text-left px-2.5 py-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                                >
                                  <span
                                    className={`w-6 h-6 rounded-lg ${t.badge} flex items-center justify-center shrink-0`}
                                  >
                                    <ToolIcon name={t.icon} className="w-3.5 h-3.5" />
                                  </span>
                                  <span className="truncate">{tMeta.title}</span>
                                  {renderProBadge(t.isPro)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* TIROIR LATÉRAL PLEIN ÉCRAN (MOBILE & TABLETTE / GRILLE RAPIDE) */}
      <AnimatePresence mode="sync">
        {drawerOpen && (
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setDrawerOpen(null)}
            className="fixed inset-0 z-[69] bg-black/55 backdrop-blur-xs"
            aria-hidden="true"
          />
        )}
        {drawerOpen && (
          <motion.div
            key={`drawer-panel-${drawerOpen}`}
            initial={{
              x: drawerOpen === 'grid' ? '100%' : '-100%',
              opacity: 0,
            }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: drawerOpen === 'grid' ? '100%' : '-100%',
              opacity: 0,
            }}
            transition={{
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            role="dialog"
            aria-modal="true"
            aria-label={
              drawerOpen === 'grid' ? 'Tous les outils PDF' : 'Menu PDFExpress'
            }
            className={`fixed top-0 bottom-0 z-[70] w-full max-w-md bg-white dark:bg-brand-cardDark h-[100dvh] overflow-y-auto p-4 sm:p-6 pb-24 shadow-2xl border-neutral-200 dark:border-brand-borderDark ${
              drawerOpen === 'grid' ? 'right-0 border-l' : 'left-0 border-r'
            }`}
          >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-200 dark:border-brand-borderDark sticky top-0 bg-white/95 dark:bg-brand-cardDark/95 backdrop-blur-md z-10 pt-1">
                <span className="font-display text-lg font-extrabold text-neutral-900 dark:text-white">
                  {drawerOpen === 'grid'
                    ? `Tous les outils PDF (${TOOLS.length})`
                    : 'Menu PDFExpress'}
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(null)}
                  aria-label="Fermer le menu"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:text-brand-red"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {drawerOpen === 'grid' ? (
                <div className="space-y-6">
                    {MENU_CATEGORIES.map((cat) => {
                      const catTools = TOOLS.filter((t) => t.cat === cat.id);
                      return (
                        <div key={cat.id}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                            {getCategoryLabel(cat.id as CategoryId, cat.label, lang)}
                          </p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {catTools.map((t) => {
                              const tMeta = getLocalizedToolMeta(t, lang);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleToolClick(t.id)}
                                  className="w-full min-h-[44px] text-left px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100 transition-colors"
                                >
                                  <span
                                    className={`w-7 h-7 rounded-lg ${t.badge} flex items-center justify-center shrink-0`}
                                  >
                                    <ToolIcon name={t.icon} className="w-4 h-4" />
                                  </span>
                                  <span className="truncate">{tMeta.title}</span>
                                  {renderProBadge(t.isPro)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* 1. Barre de recherche instantanée dans le tiroir */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={drawerSearch}
                        onChange={(e) => setDrawerSearch(e.target.value)}
                        placeholder={`Rechercher parmi les ${TOOLS.length} outils...`}
                        aria-label="Filtrer les outils dans le menu"
                        className="w-full min-h-[44px] pl-10 pr-9 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-sm outline-none transition-colors"
                      />
                      {drawerSearch && (
                        <button
                          type="button"
                          onClick={() => setDrawerSearch('')}
                          aria-label="Effacer la recherche"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Résultats instantanés si recherche active */}
                    {drawerSearch.trim() ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                          Résultats ({drawerFilteredTools.length})
                        </p>
                        {drawerFilteredTools.length === 0 ? (
                          <p className="text-xs text-neutral-500 py-4 text-center">
                            Aucun outil ne correspond à « {drawerSearch} ».
                          </p>
                        ) : (
                          drawerFilteredTools.map((t) => {
                            const tMeta = getLocalizedToolMeta(t, lang);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => handleToolClick(t.id)}
                                className="w-full min-h-[44px] text-left px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100"
                              >
                                <span
                                  className={`w-7 h-7 rounded-lg ${t.badge} flex items-center justify-center shrink-0`}
                                >
                                  <ToolIcon name={t.icon} className="w-4 h-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate">{tMeta.title}</p>
                                  <p className="text-[10px] text-neutral-400 truncate">
                                    {tMeta.catLabel}
                                  </p>
                                </div>
                                {renderProBadge(t.isPro)}
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      /* 2. Accordéon complet des catégories (6 catégories cœur + Studio + IA/Flux) */
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                          Tous les outils par catégorie
                        </p>
                        <div className="space-y-1.5">
                          {MENU_CATEGORIES.map((cat) => {
                            const catTools = TOOLS.filter((t) => t.cat === cat.id);
                            const isOpen = expandedCat === cat.id;
                            return (
                              <div
                                key={cat.id}
                                className="rounded-xl border border-neutral-200 dark:border-brand-borderDark overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCat(isOpen ? null : cat.id)
                                  }
                                  aria-expanded={isOpen}
                                  className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between text-sm font-bold text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                                >
                                  <span className="flex items-center gap-2">
                                    <span>
                                      {getCategoryLabel(cat.id as CategoryId, cat.label, lang)}
                                    </span>
                                    <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">
                                      ({catTools.length})
                                    </span>
                                  </span>
                                  <ChevronRight
                                    className={`w-4 h-4 transition-transform ${
                                      isOpen ? 'rotate-90' : ''
                                    }`}
                                  />
                                </button>
                                <AnimatePresence initial={false}>
                                  {isOpen && (
                                    <motion.div
                                      key={`cat-body-${cat.id}`}
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{
                                        duration: 0.2,
                                        ease: [0.22, 1, 0.36, 1],
                                      }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-2 pb-2 space-y-1 bg-neutral-50/70 dark:bg-neutral-900/40">
                                        {catTools.map((t) => {
                                          const tMeta = getLocalizedToolMeta(t, lang);
                                          return (
                                            <button
                                              key={t.id}
                                              type="button"
                                              onClick={() => handleToolClick(t.id)}
                                              className="w-full min-h-[44px] text-left px-2.5 py-2 rounded-lg hover:bg-white dark:hover:bg-neutral-800 flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200"
                                            >
                                              <span
                                                className={`w-6 h-6 rounded ${t.badge} flex items-center justify-center shrink-0`}
                                              >
                                                <ToolIcon
                                                  name={t.icon}
                                                  className="w-3.5 h-3.5"
                                                />
                                              </span>
                                              <span className="truncate">
                                                {tMeta.title}
                                              </span>
                                              {renderProBadge(t.isPro)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                    </div>
                  )}

                  {/* 3. Tarifs, Compte / Connexion, Agenda & Gmail, Panneau Admin & Installation PWA */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-brand-borderDark space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      Abonnement, Compte &amp; App Mobile
                    </p>

                    <PWAInstallButton
                      variant="drawer"
                      onAfterTrigger={() => setDrawerOpen(null)}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(null);
                        onOpenPricing();
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-900 text-xs font-extrabold flex items-center justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        <span>
                          {countdownLabel
                            ? `Tarifs · ${countdownLabel}`
                            : 'Tarifs & Passer à Premium'}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(null);
                          onOpenAdmin();
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-brand-red text-xs font-extrabold flex items-center justify-between"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Panneau Administrateur (/admin)</span>
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(null);
                        onOpenWorkspaceHub();
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Google Docs, Calendar &amp; Gmail</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {authUser ? (
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-neutral-900 dark:text-white truncate">
                              {authUser.displayName || authUser.email}
                            </p>
                            <p className="text-[11px] text-neutral-500 truncate">
                              {recentFiles.length} fichier(s) dans l’historique cloud
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDrawerOpen(null);
                              onSignOut();
                            }}
                            className="min-h-[38px] px-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:text-brand-red inline-flex items-center gap-1 shrink-0"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Déconnexion</span>
                          </button>
                        </div>
                        {authUser.emailVerified === false && onRefreshVerification && (
                          <button
                            type="button"
                            disabled={isAuthBusy}
                            onClick={() => {
                              setDrawerOpen(null);
                              onRefreshVerification();
                            }}
                            className="w-full min-h-[40px] px-3 rounded-lg bg-amber-500 text-neutral-900 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Vérifier l’activation de mon e-mail</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(null);
                            onOpenAuthModal('signup');
                          }}
                          className="min-h-[44px] px-3 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                        >
                          <UserPlus className="w-4 h-4 shrink-0" />
                          <span>Créer un compte</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(null);
                            onOpenAuthModal('login');
                          }}
                          className="min-h-[44px] px-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                        >
                          <LogIn className="w-4 h-4 shrink-0" />
                          <span>Connexion</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 4. Sélecteur de langue complet (FR / EN / AR) */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-brand-borderDark space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      Langue de l’interface
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                      {LANG_OPTIONS.map((opt) => {
                        const active = language === opt.code;
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => onLanguageChange?.(opt.code)}
                            className={`min-h-[44px] px-2 rounded-lg text-xs font-extrabold transition-colors ${
                              active
                                ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                                : 'text-neutral-600 dark:text-neutral-300'
                            }`}
                          >
                            {opt.label} · {opt.fullLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 5. Liens Produit, Solutions, Juridique */}
                  <div className="pt-4 border-t border-neutral-200 dark:border-brand-borderDark grid grid-cols-2 gap-5">
                    {FOOTER_COLUMNS.map((col) => (
                      <div key={col.heading}>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                          {col.heading}
                        </p>
                        <ul className="space-y-1.5">
                          {col.links.map((link) => (
                            <li key={link.label}>
                              <button
                                type="button"
                                onClick={() => {
                                  const act = link.action;
                                  if (act.type === 'home') {
                                    setDrawerOpen(null);
                                    onGoHome();
                                  } else if (act.type === 'tool') {
                                    handleToolClick(act.toolId);
                                  } else if (act.type === 'category') {
                                    setDrawerOpen(null);
                                    onSelectCategory(act.categoryId);
                                  } else if (act.type === 'info') {
                                    handleInfoClick(act.pageId);
                                  } else if (act.type === 'scroll') {
                                    setDrawerOpen(null);
                                    onNavigateSection(act.elementId);
                                  } else if (act.type === 'premium') {
                                    setDrawerOpen(null);
                                    onOpenPremium();
                                  }
                                }}
                                className="py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-brand-red text-left"
                              >
                                {link.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {onOpenDocs && (
                      <div className="pt-4 border-t border-neutral-200 dark:border-brand-borderDark mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(null);
                            onOpenDocs();
                          }}
                          className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-black flex items-center justify-between shadow-md hover:bg-brand-red dark:hover:bg-brand-red dark:hover:text-white transition-colors"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <BookOpen className="w-4 h-4 text-brand-red dark:text-brand-red" />
                            <span>📚 Documentation des 34 outils</span>
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
