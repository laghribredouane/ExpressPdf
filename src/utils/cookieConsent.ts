export type CookieConsentChoice = 'accepted' | 'essential_only';

export interface CookieConsentState {
  choice: CookieConsentChoice;
  updatedAt: string;
}

const COOKIE_CONSENT_STORAGE_KEY = 'pdfexpress_cookie_consent';

const consentListeners = new Set<() => void>();

export function readCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
    if (
      parsed &&
      (parsed.choice === 'accepted' || parsed.choice === 'essential_only')
    ) {
      return {
        choice: parsed.choice,
        updatedAt:
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
    }
  } catch {
    // Fallback for plain string values
    try {
      const plain = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (plain === 'accepted' || plain === 'essential_only') {
        return { choice: plain, updatedAt: new Date().toISOString() };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function applyCookieConsentToAdSense(
  choice: CookieConsentChoice | null
): void {
  if (typeof window === 'undefined') return;
  const ads = (window.adsbygoogle = window.adsbygoogle || []) as Array<
    Record<string, unknown>
  > & {
    loaded?: boolean;
    pauseAdRequests?: number;
    requestNonPersonalizedAds?: number;
  };
  ads.requestNonPersonalizedAds = choice === 'essential_only' ? 1 : 0;
}

export function saveCookieConsent(
  choice: CookieConsentChoice
): CookieConsentState {
  const next: CookieConsentState = {
    choice,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
    applyCookieConsentToAdSense(choice);
    consentListeners.forEach((listener) => listener());
  }
  return next;
}

export function clearCookieConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  applyCookieConsentToAdSense(null);
  consentListeners.forEach((listener) => listener());
}

export function subscribeCookieConsent(listener: () => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}
