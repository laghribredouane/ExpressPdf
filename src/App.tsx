import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  AlertTriangle,
  FileUp,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AdSenseTester } from './components/AdSenseTester';
import { AboutView } from './components/AboutView';
import { AIChatAssistant } from './components/AIChatAssistant';
import { ContactView } from './components/ContactView';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { FaqView } from './components/FaqView';
import { AuthModal, type AuthModalMode } from './components/AuthModal';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { InfoModal } from './components/InfoModal';
import {
  LegalPagesView,
  type LegalPageKey,
} from './components/LegalPagesView';
import { Navbar } from './components/Navbar';
import { ToolDocumentationModal } from './components/ToolDocumentationModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PremiumModal } from './components/PremiumModal';
import { PricingView } from './components/PricingView';
import { QuotaUpgradeModal } from './components/QuotaUpgradeModal';
import { ToastContainer } from './components/ToastContainer';
import {
  WorkspaceIntegrationsModal,
  type WorkspaceModalMode,
} from './components/WorkspaceIntegrationsModal';
import { WorkspaceView } from './components/WorkspaceView';
import { ImageStudioWorkspace } from './components/studio/ImageStudioWorkspace';
import { SITE_INFO_PAGES } from './data/siteLinks';
import { isStudioToolId } from './data/studioI18n';
import { TOOLS } from './data/tools';
import {
  auth,
  clearWorkspaceAccessToken,
  formatFirebaseAuthError,
  refreshCurrentUser,
  registerWithEmail,
  resendEmailVerification,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogleWorkspace,
  subscribeWorkspaceToken,
} from './firebase';
import { useSubscriptionAndQuota } from './hooks/useSubscriptionAndQuota';
import {
  ensureAdSenseScriptLoaded,
  getAdSenseClientId,
  removeAdSenseFromDocument,
} from './utils/adsense';
import {
  applyCookieConsentToAdSense,
  readCookieConsent,
} from './utils/cookieConsent';
import {
  clearCloudHistory,
  deleteCloudHistoryEntry,
  ensureUserProfileDocs,
  saveHistoryEntryToCloud,
  subscribeCloudHistory,
  syncLocalHistoryBatchToCloud,
} from './services/cloudHistory';
import type {
  BankTransferSubmission,
  BillingCycle,
  CategoryId,
  CurrencyCode,
  PdfChatContext,
  QuotaCheckResult,
  RecentProcessedFile,
  ToastItem,
  ToolId,
} from './types/pdf';

const RECENT_CACHE_KEY = 'pdfexpress-recent-files';
const PREMIUM_TRANSFER_KEY = 'pdfexpress-premium-transfer';

type AppPage =
  | 'main'
  | 'tarifs'
  | 'admin'
  | 'about'
  | 'contact'
  | 'faq'
  | LegalPageKey;

const PAGE_PATH_MAP: Record<AppPage, string> = {
  main: '/',
  tarifs: '/tarifs',
  admin: '/admin',
  about: '/about',
  contact: '/contact',
  faq: '/faq',
  privacy: '/confidentialite',
  terms: '/conditions',
  cookies: '/cookies',
  security: '/securite',
  accessibility: '/accessibilite',
  legal: '/mentions-legales',
  sitemap: '/plan-du-site',
};

const INFO_PAGE_ROUTE_MAP: Record<string, AppPage> = {
  about: 'about',
  contact: 'contact',
  faq: 'faq',
  privacy: 'privacy',
  terms: 'terms',
  cookies: 'cookies',
  security: 'security',
  accessibility: 'accessibility',
  sitemap: 'sitemap',
  legal_compliance: 'legal',
  legal: 'legal',
};

function getPageFromPathname(pathname: string): AppPage {
  const normalized = pathname.toLowerCase();
  if (normalized.startsWith('/tarifs')) return 'tarifs';
  if (normalized.startsWith('/admin')) return 'admin';
  if (normalized.startsWith('/about') || normalized.startsWith('/a-propos'))
    return 'about';
  if (normalized.startsWith('/contact')) return 'contact';
  if (normalized.startsWith('/faq')) return 'faq';
  if (
    normalized.startsWith('/confidentialite') ||
    normalized.startsWith('/privacy')
  )
    return 'privacy';
  if (normalized.startsWith('/conditions') || normalized.startsWith('/terms'))
    return 'terms';
  if (normalized.startsWith('/cookies')) return 'cookies';
  if (normalized.startsWith('/securite') || normalized.startsWith('/security'))
    return 'security';
  if (
    normalized.startsWith('/accessibilite') ||
    normalized.startsWith('/accessibility')
  )
    return 'accessibility';
  if (
    normalized.startsWith('/mentions-legales') ||
    normalized.startsWith('/legal')
  )
    return 'legal';
  if (normalized.startsWith('/plan-du-site') || normalized.startsWith('/sitemap'))
    return 'sitemap';
  return 'main';
}

function getToolFromSearch(search: string): ToolId | null {
  try {
    const params = new URLSearchParams(search);
    const toolParam = params.get('tool');
    if (toolParam && TOOLS.some((t) => t.id === toolParam)) {
      return toolParam as ToolId;
    }
  } catch {
    // Ignore malformed query string
  }
  return null;
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdfexpress-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [activePage, setActivePage] = useState<AppPage>(() =>
    getPageFromPathname(window.location.pathname)
  );
  const [adsenseTesterOpen, setAdsenseTesterOpen] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('adsense_test') === '1';
    } catch {
      return false;
    }
  });
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentToolId, setCurrentToolId] = useState<ToolId | null>(() =>
    getPageFromPathname(window.location.pathname) === 'main'
      ? getToolFromSearch(window.location.search)
      : null
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [heroDroppedImages, setHeroDroppedImages] = useState<File[] | null>(null);
  const [activeInfoPageId, setActiveInfoPageId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('fr');
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [premiumInitialPlan, setPremiumInitialPlan] = useState<
    'premium_pro' | 'premium_team'
  >('premium_pro');
  const [premiumInitialCycle, setPremiumInitialCycle] =
    useState<BillingCycle>('annual');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('MAD');
  const [quotaModalState, setQuotaModalState] = useState<{
    isOpen: boolean;
    result: QuotaCheckResult | null;
  }>({
    isOpen: false,
    result: null,
  });
  const [activeTransfer, setActiveTransfer] =
    useState<BankTransferSubmission | null>(() => {
      try {
        const raw = localStorage.getItem(PREMIUM_TRANSFER_KEY);
        return raw ? (JSON.parse(raw) as BankTransferSubmission) : null;
      } catch {
        return null;
      }
    });
  const [recentFiles, setRecentFiles] = useState<RecentProcessedFile[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profileReadyUid, setProfileReadyUid] = useState<string | null>(null);
  const [authProfileOverride, setAuthProfileOverride] = useState<{
    displayName?: string | null;
    emailVerified?: boolean;
  } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean;
    mode: AuthModalMode;
  }>({
    isOpen: false,
    mode: 'login',
  });
  const [cloudFiles, setCloudFiles] = useState<RecentProcessedFile[]>([]);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [workspaceModal, setWorkspaceModal] = useState<{
    isOpen: boolean;
    mode: WorkspaceModalMode;
    attachmentContext?: {
      fileName: string;
      blob: Blob;
      toolTitle?: string;
    } | null;
    textExportContext?: {
      title: string;
      content: string;
    } | null;
  }>({
    isOpen: false,
    mode: 'hub',
    attachmentContext: null,
    textExportContext: null,
  });
  const [globalProgress, setGlobalProgress] = useState<{
    progress: number;
    message: string;
  } | null>(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [workspacePdfContext, setWorkspacePdfContext] =
    useState<PdfChatContext | null>(null);

  const dragCounterRef = useRef(0);
  const recentFilesRef = useRef(recentFiles);
  recentFilesRef.current = recentFiles;
  const trialNotifiedUidRef = useRef<string | null>(null);
  const deviceBlockedNotifiedUidRef = useRef<string | null>(null);
  const currentTool = TOOLS.find((t) => t.id === currentToolId) || null;

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('pdfexpress-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('pdfexpress-theme', 'light');
    }
  }, [isDark]);

  // Dynamic SEO metadata, canonical URL & social cards per active page / tool
  useEffect(() => {
    const defaultTitle = 'PDFExpress – 34 Outils PDF Gratuits & IA en Ligne';
    const defaultDesc =
      'Fusionnez, divisez, compressez, convertissez, signez et résumez vos PDF avec l’IA gratuitement dans votre navigateur, même hors ligne, avec PDFExpress.';

    let pageTitle = defaultTitle;
    let pageDesc = defaultDesc;
    let canonicalPath = '/';
    let robotsContent =
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

    if (activePage === 'tarifs') {
      pageTitle = 'Tarifs & Essai Premium 7 Jours – PDFExpress';
      pageDesc =
        'Découvrez les offres Gratuit et Premium PDFExpress : essai offert de 7 jours, outils PDF illimités et assistants IA.';
      canonicalPath = '/tarifs';
    } else if (activePage === 'admin') {
      pageTitle = 'Administration SaaS – PDFExpress';
      pageDesc = 'Panneau de gestion des comptes et abonnements PDFExpress.';
      canonicalPath = '/admin';
      robotsContent = 'noindex, nofollow';
    } else if (activePage === 'about') {
      pageTitle = 'À propos de PDFExpress – Notre mission & technologie';
      pageDesc =
        'Découvrez l’équipe et l’architecture locale sécurisée derrière la suite de 34 outils PDF gratuits PDFExpress.';
      canonicalPath = '/about';
    } else if (activePage === 'contact') {
      pageTitle = 'Contact & Support – PDFExpress';
      pageDesc =
        'Contactez l’équipe PDFExpress pour toute question technique, demande entreprise ou réclamation relative à vos données.';
      canonicalPath = '/contact';
    } else if (activePage === 'faq') {
      pageTitle = 'Foire aux questions (FAQ) – PDFExpress';
      pageDesc =
        'Réponses aux questions fréquentes sur le fonctionnement local, la confidentialité, les formats et les offres PDFExpress.';
      canonicalPath = '/faq';
    } else if (activePage === 'privacy') {
      pageTitle = 'Politique de confidentialité – PDFExpress';
      pageDesc =
        'Comment PDFExpress protège vos documents PDF en local et gère la conformité RGPD et Google AdSense.';
      canonicalPath = '/confidentialite';
    } else if (activePage === 'terms') {
      pageTitle = 'Conditions générales d’utilisation – PDFExpress';
      pageDesc =
        'Conditions générales d’utilisation des outils PDF gratuits, quotas et abonnements Premium sur pdfexpress.ai.studio.';
      canonicalPath = '/conditions';
    } else if (activePage === 'cookies') {
      pageTitle = 'Politique de cookies & Consentement – PDFExpress';
      pageDesc =
        'Informations et contrôle des traceurs fonctionnels et cookies publicitaires Google AdSense sur PDFExpress.';
      canonicalPath = '/cookies';
    } else if (activePage === 'security') {
      pageTitle = 'Sécurité des données & Zero-Upload – PDFExpress';
      pageDesc =
        'Découvrez le traitement local en mémoire vive, le chiffrement TLS et les garanties de sécurité de PDFExpress.';
      canonicalPath = '/securite';
    } else if (activePage === 'accessibility') {
      pageTitle = 'Accessibilité numérique (WCAG 2.1 AA) – PDFExpress';
      pageDesc =
        'Engagements de PDFExpress pour la navigation clavier, les lecteurs d’écran et les contrastes WCAG.';
      canonicalPath = '/accessibilite';
    } else if (activePage === 'legal') {
      pageTitle = 'Mentions légales & Conformité – PDFExpress';
      pageDesc =
        'Informations officielles sur l’éditeur, l’hébergement Cloud Run et la transparence publicitaire de pdfexpress.ai.studio.';
      canonicalPath = '/mentions-legales';
    } else if (activePage === 'sitemap') {
      pageTitle = 'Plan du site – Tous les outils et pages PDFExpress';
      pageDesc =
        'Accès structuré à toutes les pages légales, informatives et aux 34 outils PDF de PDFExpress.';
      canonicalPath = '/plan-du-site';
    } else if (currentTool) {
      pageTitle = `${currentTool.title} en ligne gratuit – PDFExpress`;
      pageDesc = currentTool.desc;
      canonicalPath = `/?tool=${encodeURIComponent(currentTool.id)}`;
    }

    document.title = pageTitle;

    const canonicalUrl = `${window.location.origin}${canonicalPath}`;
    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', pageDesc);
    setMeta('meta[name="robots"]', robotsContent);
    setMeta('meta[property="og:title"]', pageTitle);
    setMeta('meta[property="og:description"]', pageDesc);
    setMeta('meta[name="twitter:title"]', pageTitle);
    setMeta('meta[name="twitter:description"]', pageDesc);

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', canonicalUrl);
    }

    const sitemapLink = document.querySelector('link[rel="sitemap"]');
    if (sitemapLink) {
      sitemapLink.setAttribute('href', `${window.location.origin}/sitemap.xml`);
    }

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', canonicalUrl);
  }, [activePage, currentTool]);

  // Browser back/forward navigation support for /tarifs, /admin and ?tool= PWA shortcuts
  useEffect(() => {
    const onPopState = () => {
      const nextPage = getPageFromPathname(window.location.pathname);
      setActivePage(nextPage);
      setCurrentToolId(
        nextPage === 'main' ? getToolFromSearch(window.location.search) : null
      );
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const existingConsent = readCookieConsent();
    if (existingConsent) {
      applyCookieConsentToAdSense(existingConsent.choice);
    }
  }, []);

  const navigateToPage = useCallback((page: AppPage) => {
    setActivePage(page);
    if (page !== 'main') {
      setCurrentToolId(null);
    }
    const targetPath = PAGE_PATH_MAP[page] || '/';
    if (
      window.location.pathname !== targetPath ||
      (page === 'main' && window.location.search)
    ) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenInfoOrLegalPage = useCallback(
    (pageId: string) => {
      const targetPage = INFO_PAGE_ROUTE_MAP[pageId];
      if (targetPage) {
        navigateToPage(targetPage);
      } else {
        setActiveInfoPageId(pageId);
      }
    },
    [navigateToPage]
  );

  const notify = useCallback(
    (message: string, type: 'info' | 'success' | 'error' = 'info') => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const handleLanguageChange = useCallback(
    (lang: string) => {
      setLanguage(lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      const labels: Record<string, string> = {
        fr: 'Langue définie sur Français (FR)',
        en: 'Language switched to English (EN)',
        ar: 'تم تحديد اللغة: العربية (AR)',
      };
      notify(labels[lang] || 'Langue mise à jour', 'info');
    },
    [notify]
  );

  const handleTrialActivated = useCallback(() => {
    const uid = auth.currentUser?.uid || 'active';
    if (trialNotifiedUidRef.current === uid) return;
    trialNotifiedUidRef.current = uid;
    notify(
      'Votre essai Premium gratuit de 7 jours est maintenant actif !',
      'success'
    );
  }, [notify]);

  const handleDeviceTrialBlocked = useCallback(() => {
    const uid = auth.currentUser?.uid || 'blocked';
    if (deviceBlockedNotifiedUidRef.current === uid) return;
    deviceBlockedNotifiedUidRef.current = uid;
    notify(
      'Un essai gratuit a déjà été utilisé sur cet appareil. Votre compte reste sur le plan Gratuit Limité.',
      'info'
    );
  }, [notify]);

  const {
    profile: saasProfile,
    myRequests,
    effectiveTier,
    isAdmin,
    isPremiumOrTrial,
    isDeviceBanned,
    banReason,
    trialBlockedOnDevice,
    dismissTrialBlockedBanner,
    countdownLabel,
    currentLimits,
    checkUserQuota,
    consumeQuota,
    refreshDeviceSync,
  } = useSubscriptionAndQuota({
    authUser,
    authEmailVerified:
      authProfileOverride?.emailVerified ?? authUser?.emailVerified,
    isUserDocReady: Boolean(authUser && profileReadyUid === authUser.uid),
    onTrialActivated: handleTrialActivated,
    onDeviceTrialBlocked: handleDeviceTrialBlocked,
  });

  const isSubscriptionResolved =
    isAuthReady && (!authUser || profileReadyUid === authUser.uid);
  const isAdFree = !isSubscriptionResolved || isPremiumOrTrial || isAdmin;

  useEffect(() => {
    if (!isSubscriptionResolved) return;
    const paidOrTrial = isPremiumOrTrial || isAdmin;
    try {
      if (paidOrTrial) {
        localStorage.setItem('pdfexpress_ad_free', '1');
      } else {
        localStorage.removeItem('pdfexpress_ad_free');
      }
    } catch {
      // Ignore storage quota errors
    }
    if (paidOrTrial) {
      removeAdSenseFromDocument();
      return;
    }
    void ensureAdSenseScriptLoaded(getAdSenseClientId());
  }, [isSubscriptionResolved, isPremiumOrTrial, isAdmin]);

  const handleQuotaBlocked = useCallback((result: QuotaCheckResult) => {
    setQuotaModalState({ isOpen: true, result });
  }, []);

  const handleConsumeDroppedFiles = useCallback(() => {
    setDroppedFiles(null);
  }, []);

  const handleGlobalProgress = useCallback(
    (pct: number | null, msg?: string) => {
      setGlobalProgress(
        pct !== null
          ? { progress: pct, message: msg || 'Chargement des fichiers...' }
          : null
      );
    },
    []
  );

  // Global drag & drop listener (external files only, ignore internal element drags)
  useEffect(() => {
    const isFileDrag = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types || []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingGlobal(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingGlobal(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      dragCounterRef.current = 0;
      setIsDraggingGlobal(false);
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const filesArr = Array.from(e.dataTransfer.files);
        const allImages = filesArr.every(
          (f) =>
            f.type.startsWith('image/') ||
            /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)
        );
        setActivePage('main');
        if (window.location.pathname !== '/') {
          window.history.pushState({}, '', '/');
        }
        setCurrentToolId((prev) => {
          if (prev) {
            setDroppedFiles(filesArr);
            return prev;
          }
          if (allImages) {
            setHeroDroppedImages(filesArr);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return null;
          }
          setDroppedFiles(filesArr);
          return 'merge';
        });
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          setAdsenseTesterOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (activePage !== 'main' || currentToolId !== null || !pendingScrollId) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      const target = document.getElementById(pendingScrollId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setPendingScrollId(null);
    });
    return () => cancelAnimationFrame(frameId);
  }, [activePage, currentToolId, pendingScrollId]);

  const handleSelectTool = (id: ToolId) => {
    const toolObj = TOOLS.find((t) => t.id === id);
    if (toolObj) {
      const q = checkUserQuota({ tool: toolObj });
      if (
        !q.allowed &&
        (q.blockReasonCode === 'pro_tool_locked' ||
          q.blockReasonCode === 'banned_device' ||
          q.blockReasonCode === 'suspended_account')
      ) {
        handleQuotaBlocked(q);
        return;
      }
    }

    setPendingScrollId(null);
    setActivePage('main');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setCurrentToolId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setPendingScrollId(null);
    setActiveCategory('all');
    setSearchQuery('');
    setCurrentToolId(null);
    navigateToPage('main');
  };

  const handleNavigateSection = (sectionId: string) => {
    setCurrentToolId(null);
    setActivePage('main');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setPendingScrollId(sectionId);
  };

  const handleSelectCategory = (cat: CategoryId) => {
    setActiveCategory(cat);
    setSearchQuery('');
    setCurrentToolId(null);
    setActivePage('main');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setPendingScrollId('tools-catalog');
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (activePage !== 'main') {
      setActivePage('main');
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    }
    if (currentToolId !== null) {
      setCurrentToolId(null);
    }
  };

  // Firebase Auth listener + real-time Firestore cloud history sync
  useEffect(() => {
    let unsubHistory: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubHistory) {
        unsubHistory();
        unsubHistory = null;
      }

      setAuthUser(user);
      setAuthProfileOverride(
        user
          ? {
              displayName: user.displayName,
              emailVerified: user.emailVerified,
            }
          : null
      );
      setIsAuthReady(true);

      if (!user) {
        setProfileReadyUid(null);
        setCloudFiles([]);
        trialNotifiedUidRef.current = null;
        deviceBlockedNotifiedUidRef.current = null;
        return;
      }

      try {
        await ensureUserProfileDocs(user);
        setProfileReadyUid(user.uid);
        const syncedCount = await syncLocalHistoryBatchToCloud(
          user.uid,
          recentFilesRef.current
        );
        if (syncedCount > 0) {
          notify(
            `${syncedCount} fichier(s) local(aux) synchronisé(s) dans le cloud.`,
            'success'
          );
        }
        unsubHistory = subscribeCloudHistory(
          user.uid,
          (entries) => setCloudFiles(entries),
          (err) => {
            console.error(err);
            notify(
              'Impossible de charger l’historique cloud Firestore.',
              'error'
            );
          }
        );
      } catch (err) {
        console.error(err);
        notify('Erreur lors de la synchronisation cloud.', 'error');
      }
    });

    return () => {
      unsubAuth();
      if (unsubHistory) unsubHistory();
    };
  }, [notify]);

  useEffect(() => {
    return subscribeWorkspaceToken((token) => setWorkspaceToken(token));
  }, []);

  const handleSignInGoogle = useCallback(
    async (throwOnError = false) => {
      setIsAuthBusy(true);
      try {
        const { accessToken } = await signInWithGoogleWorkspace();
        setAuthModal((prev) => ({ ...prev, isOpen: false }));
        if (accessToken) {
          notify(
            'Connecté avec Google : Calendar, Gmail et historique cloud activés !',
            'success'
          );
        } else {
          notify('Connecté avec Google : historique cloud activé !', 'success');
        }
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: unknown }).code)
            : '';
        const friendly = formatFirebaseAuthError(err);
        if (code !== 'auth/popup-closed-by-user') {
          if (throwOnError) {
            throw new Error(friendly);
          }
          notify(friendly, 'error');
        }
      } finally {
        setIsAuthBusy(false);
      }
    },
    [notify]
  );

  const handleEmailSignup = useCallback(
    async (data: { displayName: string; email: string; password: string }) => {
      setIsAuthBusy(true);
      try {
        const { user, verificationSent } = await registerWithEmail(data);
        setAuthProfileOverride({
          displayName: data.displayName.trim().slice(0, 120),
          emailVerified: user.emailVerified,
        });
        await ensureUserProfileDocs(user, data.displayName);
        setAuthModal((prev) => ({ ...prev, isOpen: false }));
        notify(
          verificationSent
            ? 'Compte créé ! Vérifiez votre e-mail pour activer vos 7 jours Premium offerts.'
            : 'Compte créé avec succès ! Historique cloud activé.',
          'success'
        );
      } catch (err) {
        throw new Error(formatFirebaseAuthError(err));
      } finally {
        setIsAuthBusy(false);
      }
    },
    [notify]
  );

  const handleEmailLogin = useCallback(
    async (data: { email: string; password: string }) => {
      setIsAuthBusy(true);
      try {
        await signInWithEmail(data.email, data.password);
        setAuthModal((prev) => ({ ...prev, isOpen: false }));
        notify('Connexion réussie ! Historique cloud synchronisé.', 'success');
      } catch (err) {
        throw new Error(formatFirebaseAuthError(err));
      } finally {
        setIsAuthBusy(false);
      }
    },
    [notify]
  );

  const handleSendPasswordReset = useCallback(async (email: string) => {
    setIsAuthBusy(true);
    try {
      await sendPasswordReset(email);
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleResendVerification = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await resendEmailVerification();
      notify(
        'E-mail de vérification renvoyé ! Pensez à vérifier vos courriers indésirables.',
        'success'
      );
    } catch (err) {
      notify(formatFirebaseAuthError(err), 'error');
    } finally {
      setIsAuthBusy(false);
    }
  }, [notify]);

  const handleRefreshVerification = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      const refreshed = await refreshCurrentUser();
      if (refreshed) {
        setAuthProfileOverride({
          displayName: refreshed.displayName,
          emailVerified: refreshed.emailVerified,
        });
        if (refreshed.emailVerified) {
          await refreshDeviceSync();
          notify('Adresse e-mail vérifiée avec succès !', 'success');
        } else {
          notify(
            "Votre e-mail n'est pas encore marqué comme vérifié. Cliquez sur le lien reçu par e-mail.",
            'info'
          );
        }
      }
    } catch (err) {
      notify(formatFirebaseAuthError(err), 'error');
    } finally {
      setIsAuthBusy(false);
    }
  }, [notify, refreshDeviceSync]);

  const handleSignOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      clearWorkspaceAccessToken();
      await signOut(auth);
      if (activePage === 'admin') {
        navigateToPage('main');
      }
      notify('Vous êtes maintenant déconnecté.', 'info');
    } catch {
      notify('Erreur lors de la déconnexion.', 'error');
    } finally {
      setIsAuthBusy(false);
    }
  }, [activePage, navigateToPage, notify]);

  const handleFileProcessed = useCallback(
    (entry: {
      fileName: string;
      toolId: ToolId;
      toolTitle: string;
      sizeFormatted: string;
    }) => {
      const newEntry: RecentProcessedFile = {
        id: crypto.randomUUID(),
        fileName: entry.fileName,
        toolId: entry.toolId,
        toolTitle: entry.toolTitle,
        sizeFormatted: entry.sizeFormatted,
        processedAt: Date.now(),
        cloudSynced: Boolean(authUser),
      };

      setRecentFiles((prev) => {
        const next: RecentProcessedFile[] = [newEntry, ...prev].slice(0, 20);
        try {
          localStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage quota errors
        }
        return next;
      });

      if (authUser && isAuthReady) {
        void saveHistoryEntryToCloud(authUser.uid, newEntry).catch((err) => {
          console.error(err);
          notify(
            'Sauvegardé localement, mais échec de la synchronisation cloud.',
            'error'
          );
        });
      }
    },
    [authUser, isAuthReady, notify]
  );

  const handleDeleteHistoryItem = useCallback(
    async (id: string) => {
      setRecentFiles((prev) => {
        const next = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
      if (authUser) {
        try {
          await deleteCloudHistoryEntry(authUser.uid, id);
          notify('Entrée supprimée de l’historique cloud.', 'info');
        } catch {
          notify('Impossible de supprimer l’entrée du cloud.', 'error');
        }
      }
    },
    [authUser, notify]
  );

  const handleClearRecentCache = useCallback(async () => {
    setRecentFiles([]);
    try {
      localStorage.removeItem(RECENT_CACHE_KEY);
    } catch {
      // Ignore storage errors
    }
    if (authUser) {
      try {
        await clearCloudHistory(authUser.uid);
        notify('Historique local et cloud Firestore effacé.', 'info');
        return;
      } catch {
        notify(
          'Cache local effacé, mais erreur lors du nettoyage cloud.',
          'error'
        );
        return;
      }
    }
    notify('Cache local des fichiers récemment traités effacé.', 'info');
  }, [authUser, notify]);

  const displayedRecentFiles = authUser ? cloudFiles : recentFiles;
  const currentEmailVerified =
    authProfileOverride?.emailVerified ?? authUser?.emailVerified ?? false;

  return (
    <div className="min-h-screen overflow-x-hidden max-w-full flex flex-col bg-brand-bgLight text-neutral-800 dark:bg-brand-bgDark dark:text-neutral-100">
      {/* Global Drag & Drop Overlay */}
      {isDraggingGlobal && (
        <div className="fixed inset-0 z-[100] bg-brand-red/90 backdrop-blur-sm flex flex-col items-center justify-center text-white pointer-events-none">
          <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center mb-4">
            <FileUp className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-extrabold">Déposez vos fichiers ici</h2>
          <p className="text-white/85 mt-2">
            Le traitement démarrera immédiatement dans votre navigateur
          </p>
        </div>
      )}

      <Navbar
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        language={language}
        onLanguageChange={handleLanguageChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onGoHome={handleGoHome}
        onSelectTool={handleSelectTool}
        onSelectCategory={handleSelectCategory}
        onNavigateSection={handleNavigateSection}
        onOpenInfoPage={handleOpenInfoOrLegalPage}
        onOpenPremium={() => {
          setPremiumInitialPlan('premium_pro');
          setPremiumInitialCycle('annual');
          setPremiumModalOpen(true);
        }}
        hasPendingPremium={Boolean(activeTransfer)}
        recentFiles={displayedRecentFiles}
        onClearRecentCache={() => {
          void handleClearRecentCache();
        }}
        onDeleteHistoryItem={(id) => {
          void handleDeleteHistoryItem(id);
        }}
        authUser={
          authUser
            ? {
                uid: authUser.uid,
                displayName:
                  authProfileOverride?.displayName ?? authUser.displayName,
                email: authUser.email,
                photoURL: authUser.photoURL,
                emailVerified: currentEmailVerified,
              }
            : null
        }
        isAuthBusy={isAuthBusy}
        onOpenAuthModal={(mode) => setAuthModal({ isOpen: true, mode })}
        onSignOut={() => {
          void handleSignOut();
        }}
        onResendVerification={() => {
          void handleResendVerification();
        }}
        onRefreshVerification={() => {
          void handleRefreshVerification();
        }}
        workspaceConnected={Boolean(workspaceToken)}
        onOpenWorkspaceHub={() =>
          setWorkspaceModal({
            isOpen: true,
            mode: 'hub',
            attachmentContext: null,
          })
        }
        effectiveTier={effectiveTier}
        countdownLabel={countdownLabel}
        remainingToday={currentLimits.remainingToday}
        dailyLimit={currentLimits.dailyLimit}
        isAdmin={isAdmin}
        onOpenPricing={() => navigateToPage('tarifs')}
        onOpenAdmin={() => navigateToPage('admin')}
        onOpenDocs={() => setDocsModalOpen(true)}
        onNotify={notify}
      />

      {/* Bannières d'état SaaS contextuelles */}
      {isDeviceBanned && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold">
          <div className="max-w-[1440px] mx-auto flex items-center justify-center gap-2 text-center">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {banReason ||
                "Cet appareil a été bloqué par l'administrateur pour abus répété."}
            </span>
          </div>
        </div>
      )}

      {!isDeviceBanned && effectiveTier === 'suspended' && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold">
          <div className="max-w-[1440px] mx-auto flex items-center justify-center gap-2 text-center">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Votre compte a été suspendu par l’administrateur. Les outils de
              traitement sont temporairement verrouillés.
            </span>
          </div>
        </div>
      )}

      {!isDeviceBanned &&
        effectiveTier !== 'suspended' &&
        trialBlockedOnDevice && (
          <div className="bg-amber-100 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-800 px-4 py-2.5 text-xs font-semibold text-amber-950 dark:text-amber-200">
            <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Un essai gratuit a déjà été utilisé sur cet appareil. Ce compte
                  a été placé sur le plan <strong>Gratuit Limité</strong> (3
                  tâches/24h).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateToPage('tarifs')}
                  className="px-3 py-1 rounded-lg bg-amber-400 text-neutral-900 font-extrabold hover:bg-amber-500 transition-colors"
                >
                  Voir les tarifs
                </button>
                <button
                  type="button"
                  onClick={dismissTrialBlockedBanner}
                  aria-label="Fermer l'alerte"
                  className="p-1 rounded-lg hover:bg-amber-200/70 dark:hover:bg-amber-900/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      {!isDeviceBanned &&
        effectiveTier !== 'suspended' &&
        !trialBlockedOnDevice &&
        authUser &&
        !currentEmailVerified && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-900 px-4 py-2.5 text-xs font-semibold text-sky-900 dark:text-sky-200">
            <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MailCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>
                  Vérifiez votre e-mail (<strong>{authUser.email}</strong>) pour
                  activer automatiquement votre{' '}
                  <strong>essai Premium gratuit de 7 jours</strong>.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isAuthBusy}
                  onClick={() => {
                    void handleResendVerification();
                  }}
                  className="px-3 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-sky-300 dark:border-sky-800 hover:border-sky-500 font-bold"
                >
                  Renvoyer l’e-mail
                </button>
                <button
                  type="button"
                  disabled={isAuthBusy}
                  onClick={() => {
                    void handleRefreshVerification();
                  }}
                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>J’ai vérifié</span>
                </button>
              </div>
            </div>
          </div>
        )}

      {globalProgress && (
        <div className="bg-brand-red text-white px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-md transition-all duration-300 z-40 sticky top-16">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 truncate">
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span className="truncate">{globalProgress.message}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-bold">{Math.round(globalProgress.progress)}%</span>
              <div className="w-32 sm:w-48 h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200 shadow-sm"
                  style={{ width: `${Math.max(0, Math.min(100, globalProgress.progress))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activePage === 'admin' ? (
        <AdminDashboardView
          isAdmin={isAdmin}
          adminUid={authUser?.uid || null}
          onBackHome={handleGoHome}
          onNotify={notify}
        />
      ) : activePage === 'tarifs' ? (
        <PricingView
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          effectiveTier={effectiveTier}
          countdownLabel={countdownLabel}
          myRequests={myRequests}
          isSignedIn={Boolean(authUser)}
          onBackHome={handleGoHome}
          onOpenSignup={() => setAuthModal({ isOpen: true, mode: 'signup' })}
          onRequestPremiumActivation={(planId, cycle) => {
            setPremiumInitialPlan(planId);
            setPremiumInitialCycle(cycle);
            setPremiumModalOpen(true);
          }}
        />
      ) : activePage === 'about' ? (
        <AboutView onBackHome={handleGoHome} />
      ) : activePage === 'contact' ? (
        <ContactView onBackHome={handleGoHome} onNotify={notify} />
      ) : activePage === 'faq' ? (
        <FaqView onBackHome={handleGoHome} />
      ) : activePage === 'privacy' ||
        activePage === 'terms' ||
        activePage === 'cookies' ||
        activePage === 'security' ||
        activePage === 'accessibility' ||
        activePage === 'legal' ||
        activePage === 'sitemap' ? (
        <LegalPagesView
          page={activePage}
          onNavigateLegal={(legalPage) => navigateToPage(legalPage)}
          onNavigateRoute={(routePath) => {
            if (routePath === '/about') navigateToPage('about');
            else if (routePath === '/contact') navigateToPage('contact');
            else if (routePath === '/faq') navigateToPage('faq');
            else if (routePath === '/tarifs') navigateToPage('tarifs');
          }}
          onSelectTool={handleSelectTool}
          onBackHome={handleGoHome}
          onNotify={notify}
        />
      ) : currentTool && isStudioToolId(currentTool.id) ? (
        <ImageStudioWorkspace
          tool={currentTool}
          language={language}
          droppedFiles={droppedFiles}
          onConsumeDroppedFiles={handleConsumeDroppedFiles}
          onGoHome={handleGoHome}
          onSelectTool={handleSelectTool}
          onSendToImageToPdf={(files) => {
            setActivePage('main');
            if (window.location.pathname !== '/') {
              window.history.pushState({}, '', '/');
            }
            setDroppedFiles(files);
            setCurrentToolId('jpg2pdf');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNotify={notify}
          onFileProcessed={handleFileProcessed}
          isPremiumOrTrial={isPremiumOrTrial}
          isAdFree={isAdFree}
          remainingTasks={currentLimits.remainingToday}
          dailyLimit={currentLimits.dailyLimit}
          checkUserQuota={checkUserQuota}
          onQuotaBlocked={handleQuotaBlocked}
          onQuotaConsumed={consumeQuota}
          onOpenPremium={() => {
            setPremiumInitialPlan('premium_pro');
            setPremiumInitialCycle('annual');
            setPremiumModalOpen(true);
          }}
          onOpenPricing={() => navigateToPage('tarifs')}
          onSaveToGoogleDocs={(payload) =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'docs_export',
              attachmentContext: null,
              textExportContext: payload,
            })
          }
        />
      ) : currentTool ? (
        <WorkspaceView
          tool={currentTool}
          droppedFiles={droppedFiles}
          onConsumeDroppedFiles={handleConsumeDroppedFiles}
          onGoHome={handleGoHome}
          onNotify={notify}
          onFileProcessed={handleFileProcessed}
          onImportFromGmail={() =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'gmail_import',
              attachmentContext: null,
              textExportContext: null,
            })
          }
          onImportFromGoogleDocs={() =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'docs_browse',
              attachmentContext: null,
              textExportContext: null,
            })
          }
          onSendResultViaGmail={(payload) =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'gmail_send',
              attachmentContext: payload,
              textExportContext: null,
            })
          }
          onScheduleResultInCalendar={(payload) =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'calendar_schedule',
              attachmentContext: payload,
              textExportContext: null,
            })
          }
          isPremiumOrTrial={isPremiumOrTrial}
          isAdFree={isAdFree}
          isWatermarked={currentLimits.isWatermarked}
          maxFileMb={currentLimits.maxFileMb}
          maxBatchFiles={currentLimits.maxBatchFiles}
          remainingTasks={currentLimits.remainingToday}
          dailyLimit={currentLimits.dailyLimit}
          checkUserQuota={checkUserQuota}
          onQuotaBlocked={handleQuotaBlocked}
          onQuotaConsumed={consumeQuota}
          onGlobalProgress={handleGlobalProgress}
          onActivePdfContextChange={setWorkspacePdfContext}
          onOpenPricing={() => navigateToPage('tarifs')}
        />
      ) : (
        <HomeView
          language={language}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onResetFilters={() => {
            setActiveCategory('all');
            setSearchQuery('');
          }}
          onSelectTool={handleSelectTool}
          pendingHeroImages={heroDroppedImages}
          onHeroFilesDropped={(files) => setHeroDroppedImages(files)}
          onRouteHeroImages={(targetToolId, files) => {
            setHeroDroppedImages(null);
            setDroppedFiles(files);
            handleSelectTool(targetToolId);
          }}
          onClearHeroImages={() => setHeroDroppedImages(null)}
          onOpenInfoPage={handleOpenInfoOrLegalPage}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          onOpenPremium={() => {
            setPremiumInitialPlan('premium_pro');
            setPremiumInitialCycle('annual');
            setPremiumModalOpen(true);
          }}
          onOpenPricing={() => navigateToPage('tarifs')}
          isPremiumOrTrial={isPremiumOrTrial}
          isAdFree={isAdFree}
        />
      )}

      <Footer
        language={language}
        onLanguageChange={handleLanguageChange}
        onGoHome={handleGoHome}
        onSelectTool={handleSelectTool}
        onSelectCategory={handleSelectCategory}
        onNavigateSection={handleNavigateSection}
        onOpenInfoPage={handleOpenInfoOrLegalPage}
        onOpenPremium={() => {
          setPremiumInitialPlan('premium_pro');
          setPremiumInitialCycle('annual');
          setPremiumModalOpen(true);
        }}
        onOpenPricing={() => navigateToPage('tarifs')}
        onOpenDocs={() => setDocsModalOpen(true)}
        onOpenAdSenseTester={() => setAdsenseTesterOpen(true)}
      />

      <CookieConsentBanner
        onOpenCookiesPage={() => navigateToPage('cookies')}
        onOpenPrivacyPage={() => navigateToPage('privacy')}
        isAdFree={isAdFree}
      />

      <AdSenseTester
        isOpen={adsenseTesterOpen}
        onClose={() => setAdsenseTesterOpen(false)}
        isAdFree={isAdFree}
      />

      <ToolDocumentationModal
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
        onSelectTool={(toolId) => {
          handleSelectTool(toolId);
          setDocsModalOpen(false);
        }}
      />

      <InfoModal
        page={activeInfoPageId ? SITE_INFO_PAGES[activeInfoPageId] || null : null}
        onClose={() => setActiveInfoPageId(null)}
        onSelectTool={handleSelectTool}
      />

      <PremiumModal
        isOpen={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        selectedCurrency={selectedCurrency}
        onCurrencyChange={setSelectedCurrency}
        activeTransfer={activeTransfer}
        onTransferSubmitted={(submission) => {
          setActiveTransfer(submission);
          try {
            localStorage.setItem(
              PREMIUM_TRANSFER_KEY,
              JSON.stringify(submission)
            );
          } catch {
            // Ignore storage errors
          }
        }}
        onResetTransfer={() => {
          setActiveTransfer(null);
          try {
            localStorage.removeItem(PREMIUM_TRANSFER_KEY);
          } catch {
            // Ignore storage errors
          }
        }}
        onNotify={notify}
        authUserId={authUser?.uid || null}
        defaultPayerName={
          authProfileOverride?.displayName ??
          authUser?.displayName ??
          saasProfile?.displayName ??
          null
        }
        defaultPayerEmail={authUser?.email || null}
        initialPlanId={premiumInitialPlan}
        initialCycle={premiumInitialCycle}
        onRequireAuth={() => setAuthModal({ isOpen: true, mode: 'login' })}
      />

      <QuotaUpgradeModal
        isOpen={quotaModalState.isOpen}
        quotaResult={quotaModalState.result}
        isGuest={!authUser}
        onClose={() =>
          setQuotaModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onOpenSignup={() => setAuthModal({ isOpen: true, mode: 'signup' })}
        onOpenPricing={() => navigateToPage('tarifs')}
      />

      <WorkspaceIntegrationsModal
        isOpen={workspaceModal.isOpen}
        initialMode={workspaceModal.mode}
        workspaceToken={workspaceToken}
        isAuthBusy={isAuthBusy}
        userEmail={authUser?.email}
        onAuthorizeGoogle={() => {
          void handleSignInGoogle();
        }}
        onClose={() =>
          setWorkspaceModal((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
        onNotify={notify}
        attachmentContext={workspaceModal.attachmentContext}
        textExportContext={workspaceModal.textExportContext}
        onImportPdfToTool={(file, targetToolId) => {
          if (targetToolId) {
            setCurrentToolId(targetToolId);
          } else if (!currentToolId) {
            setCurrentToolId('compress');
          }
          setActivePage('main');
          if (window.location.pathname !== '/') {
            window.history.pushState({}, '', '/');
          }
          setDroppedFiles([file]);
        }}
      />

      <AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        isBusy={isAuthBusy}
        onClose={() => setAuthModal((prev) => ({ ...prev, isOpen: false }))}
        onSubmitEmailSignup={handleEmailSignup}
        onSubmitEmailLogin={handleEmailLogin}
        onSendPasswordReset={handleSendPasswordReset}
        onSignInGoogle={() => handleSignInGoogle(true)}
      />

      <AIChatAssistant
        workspacePdfContext={workspacePdfContext}
        onNotify={notify}
      />
      <OfflineIndicator />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
