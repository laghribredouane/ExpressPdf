declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      loaded?: boolean;
      pauseAdRequests?: number;
    };
  }
}

export type AdSensePlacement = 'home' | 'workspace' | 'result';

export const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-7807016100432800';

const ADSENSE_SCRIPT_ATTR = 'data-pdfexpress-adsense';
const ADSENSE_SCRIPT_URL =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const ADSENSE_CLIENT_ID_PATTERN = /^ca-pub-\d{10,20}$/;

let inFlightScriptPromise: Promise<void> | null = null;

function getViteEnv(): Record<string, string | undefined> {
  return (
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env || {}
  );
}

function sanitizeClientId(rawClientId?: string): string {
  const normalized = (rawClientId || '').trim();
  return ADSENSE_CLIENT_ID_PATTERN.test(normalized)
    ? normalized
    : DEFAULT_ADSENSE_CLIENT_ID;
}

function isAdSenseRuntimeReady(): boolean {
  if (typeof window === 'undefined' || !window.adsbygoogle) return false;
  return (
    window.adsbygoogle.loaded === true ||
    window.adsbygoogle.push !== Array.prototype.push
  );
}

export function getAdSenseClientId(): string {
  const env = getViteEnv();
  return sanitizeClientId(env.VITE_ADSENSE_CLIENT_ID);
}

export const ADSENSE_SLOT_KEYS: Record<AdSensePlacement, string> = {
  home: 'VITE_ADSENSE_SLOT_HOME',
  workspace: 'VITE_ADSENSE_SLOT_WORKSPACE',
  result: 'VITE_ADSENSE_SLOT_RESULT',
};

export function getAdSenseSlotId(placement: AdSensePlacement): string {
  const env = getViteEnv();
  if (placement === 'home') {
    return (
      env.VITE_ADSENSE_SLOT_HOME ||
      env.VITE_ADSENSE_SLOT_DEFAULT ||
      ''
    ).trim();
  }
  if (placement === 'workspace') {
    return (
      env.VITE_ADSENSE_SLOT_WORKSPACE ||
      env.VITE_ADSENSE_SLOT_DEFAULT ||
      ''
    ).trim();
  }
  return (
    env.VITE_ADSENSE_SLOT_RESULT ||
    env.VITE_ADSENSE_SLOT_DEFAULT ||
    ''
  ).trim();
}

export function ensureAdSenseScriptLoaded(
  clientId = getAdSenseClientId()
): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve();
  }

  const safeClientId = sanitizeClientId(clientId);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.pauseAdRequests = 0;

  const existing = document.querySelector<HTMLScriptElement>(
    `script[${ADSENSE_SCRIPT_ATTR}="true"], script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`
  );

  if (existing) {
    if (
      existing.dataset.loaded === 'true' ||
      existing.dataset.errored === 'true' ||
      isAdSenseRuntimeReady()
    ) {
      existing.dataset.loaded = 'true';
      return Promise.resolve();
    }

    if (inFlightScriptPromise) {
      return inFlightScriptPromise;
    }

    inFlightScriptPromise = new Promise<void>((resolve) => {
      let settled = false;
      const done = (loaded: boolean) => {
        if (settled) return;
        settled = true;
        if (loaded) {
          existing.dataset.loaded = 'true';
        } else {
          existing.dataset.errored = 'true';
        }
        inFlightScriptPromise = null;
        resolve();
      };
      existing.addEventListener('load', () => done(true), { once: true });
      existing.addEventListener('error', () => done(false), { once: true });
      window.setTimeout(() => {
        // Resolve after grace timeout even if load fired before React hydrated
        done(isAdSenseRuntimeReady() || existing.dataset.errored !== 'true');
      }, 1500);
    });
    return inFlightScriptPromise;
  }

  if (inFlightScriptPromise) {
    return inFlightScriptPromise;
  }

  inFlightScriptPromise = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `${ADSENSE_SCRIPT_URL}?client=${encodeURIComponent(
      safeClientId
    )}`;
    script.setAttribute(ADSENSE_SCRIPT_ATTR, 'true');

    const finish = (loaded: boolean) => {
      if (loaded) {
        script.dataset.loaded = 'true';
      } else {
        script.dataset.errored = 'true';
      }
      inFlightScriptPromise = null;
      resolve();
    };

    script.addEventListener('load', () => finish(true), { once: true });
    script.addEventListener('error', () => finish(false), { once: true });
    document.head.appendChild(script);
  });

  return inFlightScriptPromise;
}

export function removeAdSenseFromDocument(): void {
  if (typeof document === 'undefined') return;

  inFlightScriptPromise = null;

  if (typeof window !== 'undefined') {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.pauseAdRequests = 1;
  }

  document
    .querySelectorAll(
      `script[${ADSENSE_SCRIPT_ATTR}="true"], script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"], script[src*="googleads.g.doubleclick.net"]`
    )
    .forEach((el) => el.remove());

  document
    .querySelectorAll(
      'ins.adsbygoogle, ins.adsbygoogle-noablate, .google-auto-placed, iframe[id^="aswift_"], iframe[id^="google_ads_iframe"]'
    )
    .forEach((el) => el.remove());

  if (document.body) {
    document.body.style.removeProperty('padding-top');
    document.body.style.removeProperty('padding-bottom');
    document.body.style.removeProperty('height');
  }
}
