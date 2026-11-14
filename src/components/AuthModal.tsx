import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  X,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';

export type AuthModalMode = 'signup' | 'login';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  isBusy?: boolean;
  onClose: () => void;
  onSubmitEmailSignup: (data: {
    displayName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onSubmitEmailLogin: (data: {
    email: string;
    password: string;
  }) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  onSignInGoogle: () => Promise<void>;
}

export function AuthModal({
  isOpen,
  initialMode = 'login',
  isBusy = false,
  onClose,
  onSubmitEmailSignup,
  onSubmitEmailLogin,
  onSendPasswordReset,
  onSignInGoogle,
}: AuthModalProps) {
  const [view, setView] = useState<'signup' | 'login' | 'reset'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(initialMode);
      setLocalError(null);
      setInfoMessage(null);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, submitting, isBusy]);

  if (!isOpen) return null;

  const busy = isBusy || submitting;

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    if (view === 'reset') {
      setSubmitting(true);
      try {
        await onSendPasswordReset(trimmedEmail);
        setInfoMessage(
          `Si un compte existe pour ${trimmedEmail}, un e-mail de réinitialisation vient d'être envoyé.`
        );
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : "Impossible d'envoyer l'e-mail de réinitialisation."
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (view === 'signup') {
      const trimmedName = displayName.trim();
      if (!trimmedName || trimmedName.length > 120) {
        setLocalError('Veuillez saisir votre nom complet (120 caractères max).');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Les deux mots de passe ne correspondent pas.');
        return;
      }

      setSubmitting(true);
      try {
        await onSubmitEmailSignup({
          displayName: trimmedName,
          email: trimmedEmail,
          password,
        });
      } catch (err) {
        setLocalError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la création du compte.'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitEmailLogin({ email: trimmedEmail, password });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Erreur lors de la connexion.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setLocalError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      await onSignInGoogle();
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la connexion avec Gmail / Google.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        onClick={() => {
          if (!busy) onClose();
        }}
        className="fixed inset-0 bg-black/55 backdrop-blur-xs"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-brand-cardDark rounded-3xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark overflow-hidden">
        {/* En-tête */}
        <div className="px-6 pt-6 pb-4 border-b border-neutral-100 dark:border-brand-borderDark flex items-start justify-between gap-4">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-xl font-extrabold text-neutral-900 dark:text-white"
            >
              {view === 'signup'
                ? 'Créer un compte PDFExpress'
                : view === 'reset'
                ? 'Mot de passe oublié'
                : 'Connexion à PDFExpress'}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {view === 'reset'
                ? 'Recevez un lien pour définir un nouveau mot de passe.'
                : 'Sauvegardez votre historique PDF dans le cloud via E-mail ou Gmail.'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Fermer la fenêtre de connexion"
            className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 transition-colors disabled:opacity-50 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Onglets Créer un compte / Se connecter */}
          {view !== 'reset' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setView('signup');
                  setLocalError(null);
                  setInfoMessage(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                  view === 'signup'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Créer un compte
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setView('login');
                  setLocalError(null);
                  setInfoMessage(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all ${
                  view === 'login'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Se connecter
              </button>
            </div>
          )}

          {/* Bouton Gmail / Google */}
          {view !== 'reset' && (
            <div className="space-y-2">
              <GoogleSignInButton
                onClick={() => {
                  void handleGoogleClick();
                }}
                disabled={busy}
                label={
                  view === 'signup'
                    ? "S'inscrire avec Gmail / Google"
                    : 'Se connecter avec Gmail / Google'
                }
                className="w-full"
              />
              <p className="text-[11px] text-center text-neutral-500 dark:text-neutral-400">
                Active aussi l’import/envoi Gmail et Google Calendar en un clic.
              </p>

              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-neutral-200 dark:border-brand-borderDark" />
                <span className="mx-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  ou par e-mail
                </span>
                <div className="flex-grow border-t border-neutral-200 dark:border-brand-borderDark" />
              </div>
            </div>
          )}

          {/* Alertes erreur / info */}
          {localError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Formulaire E-mail */}
          <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-3.5">
            {view === 'signup' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5"
                >
                  Nom complet
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-display-name"
                    type="text"
                    required
                    maxLength={120}
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex. Nadia Benali"
                    disabled={busy}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-brand-borderDark focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none transition-colors disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5"
              >
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  disabled={busy}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-brand-borderDark focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none transition-colors disabled:opacity-60"
                />
              </div>
            </div>

            {view !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-bold text-neutral-700 dark:text-neutral-300"
                  >
                    Mot de passe
                  </label>
                  {view === 'login' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setView('reset');
                        setLocalError(null);
                        setInfoMessage(null);
                      }}
                      className="text-[11px] font-bold text-brand-red hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={
                      view === 'signup' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 caractères minimum"
                    disabled={busy}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-brand-borderDark focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none transition-colors disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {view === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez votre mot de passe"
                    disabled={busy}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-brand-borderDark focus:border-brand-red focus:bg-white dark:focus:bg-neutral-900 text-sm text-neutral-900 dark:text-white outline-none transition-colors disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-brand-red hover:bg-red-700 text-white text-sm font-extrabold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {busy
                ? 'Traitement en cours...'
                : view === 'signup'
                ? 'Créer mon compte par e-mail'
                : view === 'reset'
                ? 'Envoyer le lien de réinitialisation'
                : 'Se connecter par e-mail'}
            </button>

            {view === 'reset' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setView('login');
                  setLocalError(null);
                  setInfoMessage(null);
                }}
                className="w-full py-2 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la connexion</span>
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
