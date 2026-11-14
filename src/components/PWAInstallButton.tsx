import { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer';
  onAfterTrigger?: () => void;
}

export function PWAInstallButton({
  variant = 'header',
  onAfterTrigger,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'drawer') {
      return (
        <button
          type="button"
          onClick={async () => {
            await install();
            onAfterTrigger?.();
          }}
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 text-xs font-extrabold flex items-center justify-between transition-opacity"
        >
          <span className="inline-flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-red" />
            <span>Installer l’application sur l’écran d’accueil</span>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-brand-red text-white text-[10px] font-bold uppercase">
            PWA
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        title="Installer PDFExpress sur votre appareil (accès hors ligne)"
        className="hidden sm:inline-flex min-h-[44px] px-3 rounded-xl bg-neutral-900 dark:bg-white hover:opacity-90 text-white dark:text-neutral-900 text-xs font-extrabold items-center gap-1.5 transition-opacity shrink-0 whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5 text-brand-red shrink-0" />
        <span className="hidden xl:inline">Installer l’app</span>
        <span className="xl:hidden">App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        {variant === 'drawer' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 text-xs font-bold flex items-center justify-between"
          >
            <span className="inline-flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-brand-red" />
              <span>Ajouter à l’écran d’accueil (iOS)</span>
            </span>
            <span className="text-[10px] font-extrabold uppercase text-brand-red">
              Guide
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            title="Installer PDFExpress sur iPhone / iPad"
            className="hidden sm:inline-flex min-h-[44px] px-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:border-brand-red text-xs font-bold items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap"
          >
            <Smartphone className="w-3.5 h-3.5 text-brand-red shrink-0" />
            <span>Installer iOS</span>
          </button>
        )}

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center p-3 bg-black/55 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-[95vw] max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3
                  id="ios-install-title"
                  className="font-display text-base font-extrabold text-neutral-900 dark:text-white"
                >
                  Installer sur iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fermer"
                  className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2.5 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-brand-red">1.</span>
                  <span>
                    Appuyez sur le bouton{' '}
                    <strong className="inline-flex items-center gap-1 text-neutral-900 dark:text-white">
                      <Share className="w-3.5 h-3.5 text-blue-600" />
                      Partager
                    </strong>{' '}
                    dans la barre Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-extrabold text-brand-red">2.</span>
                  <span>
                    Faites défiler vers le bas puis touchez{' '}
                    <strong className="text-neutral-900 dark:text-white">
                      Sur l’écran d’accueil
                    </strong>
                    .
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => {
                  setShowIOSGuide(false);
                  onAfterTrigger?.();
                }}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-brand-red hover:bg-brand-redHover text-white text-sm font-bold transition-colors"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
