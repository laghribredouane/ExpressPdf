import { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Cloud,
  Crown,
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
  Sun,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { MENU_CATEGORIES, TOOLS } from '../data/tools';
import { FOOTER_COLUMNS } from '../data/siteLinks';
import type { CategoryId, RecentProcessedFile, ToolId } from '../types/pdf';
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
}

export function Navbar({
  isDark,
  onToggleTheme,
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
}: NavbarProps) {
  const [openMenu, setOpenMenu] = useState<'convert' | 'all' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<'nav' | 'grid' | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>('organiser');

  const toPdf = TOOLS.filter((t) => t.cat === 'convertir_en');
  const fromPdf = TOOLS.filter((t) => t.cat === 'convertir_depuis');

  const handleToolClick = (id: ToolId) => {
    setOpenMenu(null);
    setDrawerOpen(null);
    onSelectTool(id);
  };

  const handleInfoClick = (pageId: string) => {
    setOpenMenu(null);
    setDrawerOpen(null);
    onOpenInfoPage(pageId);
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-brand-cardDark/95 backdrop-blur-md border-b border-neutral-200 dark:border-brand-borderDark">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 xl:gap-8">
          {/* Zone 1: Menu mobile + Brand wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                setDrawerOpen(drawerOpen === 'nav' ? null : 'nav')
              }
              aria-label="Ouvrir le menu de navigation"
              className="xl:hidden w-10 h-10 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setDrawerOpen(null);
                onGoHome();
              }}
              className="flex items-center gap-1.5 font-display text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red rounded-lg px-1 py-0.5"
            >
              <span>PDF</span>
              <Heart
                className="w-5 h-5 fill-brand-red text-brand-red shrink-0"
                aria-hidden="true"
              />
              <span>Express</span>
            </button>
          </div>

          {/* Zone 2: Desktop concise single-line navigation */}
          <nav className="hidden xl:flex items-center gap-5">
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
                className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 py-2"
              >
                <span>Convertir PDF</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {openMenu === 'convert' && (
                <div className="absolute left-0 top-full pt-1 z-50">
                  <div className="w-[540px] bg-white dark:bg-brand-cardDark rounded-2xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark p-5 grid grid-cols-2 gap-4">
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
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mega-Menu Tous les outils */}
            <div
              className="relative"
              onMouseEnter={() => setOpenMenu('all')}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'all' ? null : 'all')}
                className="text-xs font-bold tracking-wide text-neutral-700 dark:text-neutral-200 hover:text-brand-red dark:hover:text-brand-red flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 py-2"
              >
                <span>Tous les outils</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {openMenu === 'all' && (
                <div className="absolute left-0 top-full -translate-x-1/4 pt-1 z-50">
                  <div className="w-[920px] bg-white dark:bg-brand-cardDark rounded-2xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark p-6 grid grid-cols-4 gap-5 max-h-[80vh] overflow-y-auto">
                    {MENU_CATEGORIES.map((cat) => {
                      const catTools = TOOLS.filter((t) => t.cat === cat.id);
                      return (
                        <div key={cat.id}>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2 px-2">
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
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Zone 3: Search, Recent Cache Badge, Quick Grid & Theme */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative hidden sm:block w-44 md:w-52">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Rechercher un outil..."
                aria-label="Rechercher un outil PDF"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-transparent focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-xs font-medium text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 outline-none transition-colors"
              />
            </div>

            {/* Bouton Google Calendar & Gmail */}
            <button
              type="button"
              onClick={onOpenWorkspaceHub}
              title="Ouvrir Google Calendar & Gmail"
              aria-label="Ouvrir Google Calendar et Gmail"
              className="relative h-10 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-bold text-xs inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="hidden 2xl:inline">Agenda &amp; Mail</span>
              {workspaceConnected && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900"
                  aria-label="Google Workspace connecté"
                />
              )}
            </button>

            {/* Bouton Premium */}
            <button
              type="button"
              onClick={onOpenPremium}
              title="Passer à PDFExpress Premium par virement bancaire (MAD, USD, EUR)"
              className="relative h-10 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-neutral-900 font-extrabold text-xs inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Premium</span>
              {hasPendingPremium && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-amber-400"
                  aria-label="Virement enregistré"
                />
              )}
            </button>

            {/* Bouton Connexion / Compte Cloud */}
            {authUser ? (
              <button
                type="button"
                onClick={() => setRecentOpen((v) => !v)}
                title={`Connecté en tant que ${authUser.displayName || authUser.email || 'Utilisateur'}`}
                className="h-10 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50 shrink-0"
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
                <span className="hidden lg:inline max-w-[95px] truncate">
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
                className="h-10 px-3 rounded-xl bg-neutral-900 dark:bg-white hover:opacity-90 text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center gap-1.5 transition-opacity disabled:opacity-50 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {isAuthBusy ? 'Connexion...' : 'Connexion'}
                </span>
              </button>
            )}

            {/* Badge fichiers récemment traités + bouton effacer cache local */}
            <div className="relative flex items-center gap-1">
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
                className="relative h-10 px-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1.5 transition-colors shrink-0"
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
                  className="hidden sm:flex w-8 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-brand-red hover:bg-red-50 dark:hover:bg-red-950/40 items-center justify-center transition-colors shrink-0"
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
                        className="w-7 h-7 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bloc Compte (E-mail ou Gmail) / Sync Cloud */}
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

            <button
              type="button"
              onClick={() =>
                setDrawerOpen(drawerOpen === 'grid' ? null : 'grid')
              }
              title="Accès rapide à tous les outils"
              aria-label="Accès rapide à tous les outils"
              className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors shrink-0"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
              aria-label={
                isDark ? 'Passer au thème clair' : 'Passer au thème sombre'
              }
              className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-colors shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Drawer latéral / Mobile & Tous les liens */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[70] flex">
          <div
            onClick={() => setDrawerOpen(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-md bg-white dark:bg-brand-cardDark h-full overflow-y-auto p-6 shadow-2xl border-neutral-200 dark:border-brand-borderDark ${
              drawerOpen === 'grid'
                ? 'ml-auto border-l'
                : 'mr-auto border-r'
            }`}
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-neutral-200 dark:border-brand-borderDark">
              <span className="font-display text-lg font-extrabold text-neutral-900 dark:text-white">
                {drawerOpen === 'grid'
                  ? `Tous les outils PDF (${TOOLS.length})`
                  : 'Navigation & Liens'}
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(null)}
                aria-label="Fermer le menu"
                className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {drawerOpen === 'grid' ? (
              <div className="space-y-6">
                {MENU_CATEGORIES.map((cat) => {
                  const catTools = TOOLS.filter((t) => t.cat === cat.id);
                  return (
                    <div key={cat.id}>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        {cat.label}
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {catTools.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToolClick(t.id)}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100 transition-colors"
                          >
                            <span
                              className={`w-7 h-7 rounded-lg ${t.badge} flex items-center justify-center shrink-0`}
                            >
                              <ToolIcon name={t.icon} className="w-4 h-4" />
                            </span>
                            <span>{t.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Catégories d'outils repliables */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Outils PDF par catégorie
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
                            className="w-full px-3.5 py-2.5 flex items-center justify-between text-sm font-bold text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                          >
                            <span>{cat.label}</span>
                            <ChevronRight
                              className={`w-4 h-4 transition-transform ${
                                isOpen ? 'rotate-90' : ''
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <div className="px-2 pb-2 space-y-1 bg-neutral-50/70 dark:bg-neutral-900/40">
                              {catTools.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => handleToolClick(t.id)}
                                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white dark:hover:bg-neutral-800 flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200"
                                >
                                  <span
                                    className={`w-6 h-6 rounded ${t.badge} flex items-center justify-center shrink-0`}
                                  >
                                    <ToolIcon name={t.icon} className="w-3.5 h-3.5" />
                                  </span>
                                  <span>{t.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tous les sous-liens Produit, Ressources, Solutions, Juridique, Entreprise */}
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
                              className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-brand-red text-left"
                            >
                              {link.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
