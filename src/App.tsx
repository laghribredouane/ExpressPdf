import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { FileUp } from 'lucide-react';
import { AuthModal, type AuthModalMode } from './components/AuthModal';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { InfoModal } from './components/InfoModal';
import { Navbar } from './components/Navbar';
import { PremiumModal } from './components/PremiumModal';
import { ToastContainer } from './components/ToastContainer';
import {
  WorkspaceIntegrationsModal,
  type WorkspaceModalMode,
} from './components/WorkspaceIntegrationsModal';
import { WorkspaceView } from './components/WorkspaceView';
import { SITE_INFO_PAGES } from './data/siteLinks';
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
  CategoryId,
  CurrencyCode,
  RecentProcessedFile,
  ToastItem,
  ToolId,
} from './types/pdf';

const RECENT_CACHE_KEY = 'pdfexpress-recent-files';
const PREMIUM_TRANSFER_KEY = 'pdfexpress-premium-transfer';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdfexpress-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentToolId, setCurrentToolId] = useState<ToolId | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const [activeInfoPageId, setActiveInfoPageId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('fr');
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('MAD');
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
  }>({
    isOpen: false,
    mode: 'hub',
    attachmentContext: null,
  });

  const dragCounterRef = useRef(0);
  const recentFilesRef = useRef(recentFiles);
  recentFilesRef.current = recentFiles;
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

  // Global drag & drop listener
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingGlobal(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingGlobal(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingGlobal(false);
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const filesArr = Array.from(e.dataTransfer.files);
        setCurrentToolId((prev) => {
          if (prev) return prev;
          return filesArr[0].type.startsWith('image/') ? 'jpg2pdf' : 'merge';
        });
        setDroppedFiles(filesArr);
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
    if (currentToolId !== null || !pendingScrollId) return;
    const frameId = requestAnimationFrame(() => {
      const target = document.getElementById(pendingScrollId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setPendingScrollId(null);
    });
    return () => cancelAnimationFrame(frameId);
  }, [currentToolId, pendingScrollId]);

  const handleSelectTool = (id: ToolId) => {
    setPendingScrollId(null);
    setCurrentToolId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setPendingScrollId(null);
    setActiveCategory('all');
    setSearchQuery('');
    setCurrentToolId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateSection = (sectionId: string) => {
    setCurrentToolId(null);
    setPendingScrollId(sectionId);
  };

  const handleSelectCategory = (cat: CategoryId) => {
    setActiveCategory(cat);
    setSearchQuery('');
    setCurrentToolId(null);
    setPendingScrollId('tools-catalog');
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
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
        setCloudFiles([]);
        return;
      }

      try {
        await ensureUserProfileDocs(user);
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
            ? 'Compte créé ! Un e-mail de vérification vient de vous être envoyé.'
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
  }, [notify]);

  const handleSignOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      clearWorkspaceAccessToken();
      await signOut(auth);
      notify('Vous êtes maintenant déconnecté.', 'info');
    } catch {
      notify('Erreur lors de la déconnexion.', 'error');
    } finally {
      setIsAuthBusy(false);
    }
  }, [notify]);

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

  return (
    <div className="min-h-screen flex flex-col bg-brand-bgLight text-neutral-800 dark:bg-brand-bgDark dark:text-neutral-100">
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
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onGoHome={handleGoHome}
        onSelectTool={handleSelectTool}
        onSelectCategory={handleSelectCategory}
        onNavigateSection={handleNavigateSection}
        onOpenInfoPage={(pageId) => setActiveInfoPageId(pageId)}
        onOpenPremium={() => setPremiumModalOpen(true)}
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
                emailVerified:
                  authProfileOverride?.emailVerified ?? authUser.emailVerified,
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
      />

      {currentTool ? (
        <WorkspaceView
          tool={currentTool}
          droppedFiles={droppedFiles}
          onConsumeDroppedFiles={() => setDroppedFiles(null)}
          onGoHome={handleGoHome}
          onNotify={notify}
          onFileProcessed={handleFileProcessed}
          onImportFromGmail={() =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'gmail_import',
              attachmentContext: null,
            })
          }
          onSendResultViaGmail={(payload) =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'gmail_send',
              attachmentContext: payload,
            })
          }
          onScheduleResultInCalendar={(payload) =>
            setWorkspaceModal({
              isOpen: true,
              mode: 'calendar_schedule',
              attachmentContext: payload,
            })
          }
        />
      ) : (
        <HomeView
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onResetFilters={() => {
            setActiveCategory('all');
            setSearchQuery('');
          }}
          onSelectTool={handleSelectTool}
          onOpenInfoPage={(pageId) => setActiveInfoPageId(pageId)}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          onOpenPremium={() => setPremiumModalOpen(true)}
        />
      )}

      <Footer
        language={language}
        onLanguageChange={(lang) => {
          setLanguage(lang);
          const labels: Record<string, string> = {
            fr: 'Langue définie sur Français',
            en: 'Language switched to English (UI remains French)',
            es: 'Idioma seleccionado: Español',
          };
          notify(labels[lang] || 'Langue mise à jour', 'info');
        }}
        onGoHome={handleGoHome}
        onSelectTool={handleSelectTool}
        onSelectCategory={handleSelectCategory}
        onNavigateSection={handleNavigateSection}
        onOpenInfoPage={(pageId) => setActiveInfoPageId(pageId)}
        onOpenPremium={() => setPremiumModalOpen(true)}
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
        onImportPdfToTool={(file, targetToolId) => {
          if (targetToolId) {
            setCurrentToolId(targetToolId);
          } else if (!currentToolId) {
            setCurrentToolId('compress');
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

      <ToastContainer toasts={toasts} />
    </div>
  );
}
