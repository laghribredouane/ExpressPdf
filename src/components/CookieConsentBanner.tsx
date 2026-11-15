import { useEffect, useState } from 'react';
import { Cookie, Settings2 } from 'lucide-react';
import {
  type CookieConsentState,
  readCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
} from '../utils/cookieConsent';

interface CookieConsentBannerProps {
  onOpenCookiesPage: () => void;
  onOpenPrivacyPage: () => void;
  isAdFree: boolean;
}

export function CookieConsentBanner({
  onOpenCookiesPage,
  onOpenPrivacyPage,
  isAdFree,
}: CookieConsentBannerProps) {
  const [consent, setConsent] = useState<CookieConsentState | null>(() =>
    readCookieConsent()
  );

  useEffect(() => {
    return subscribeCookieConsent(() => {
      setConsent(readCookieConsent());
    });
  }, []);

  if (consent || isAdFree) {
    return null;
  }

  return (
    <aside
      aria-label="Gestion du consentement aux cookies"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-lg z-40 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 shadow-xl p-3.5 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
          <Cookie className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="space-y-1">
            <h2 className="font-display text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">
              Cookies &amp; confidentialité sur PDFExpress
            </h2>
            <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Vos PDF restent traités localement dans votre navigateur. Nous utilisons le stockage local essentiel et des annonces Google AdSense pour maintenir nos 34 outils gratuits.{' '}
              <a
                href="/confidentialite"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenPrivacyPage();
                }}
                className="font-semibold text-neutral-900 dark:text-white underline underline-offset-2 hover:text-brand-red"
              >
                Politique de confidentialité
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => saveCookieConsent('accepted')}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-brand-red dark:hover:bg-brand-red dark:hover:text-white text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
            >
              Tout accepter
            </button>
            <button
              type="button"
              onClick={() => saveCookieConsent('essential_only')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-neutral-400 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              Essentiels uniquement
            </button>
            <a
              href="/cookies"
              onClick={(e) => {
                e.preventDefault();
                onOpenCookiesPage();
              }}
              className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Personnaliser</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
