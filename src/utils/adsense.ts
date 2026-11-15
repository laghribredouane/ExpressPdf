export interface AdSenseConsoleErrorEntry {
  id: string;
  source: 'window.onerror' | 'resource' | 'console.error' | 'unhandledrejection';
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>> & {
      loaded?: boolean;
      pauseAdRequests?: number;
    };
    __pdfexpressAdSenseErrorLog?: AdSenseConsoleErrorEntry[];
  }
}

export type AdSensePlacement = 'home' | 'workspace' | 'result';

export const DEFAULT_ADSENSE_CLIENT_ID = 'ca-pub-7807016100432800';

export const ADSENSE_SCRIPT_ATTR = 'data-pdfexpress-adsense';
const ADSENSE_SCRIPT_URL =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const ADSENSE_CLIENT_ID_PATTERN = /^ca-pub-\d{10,20}$/;
const ADSENSE_ERROR_PATTERN =
  /adsbygoogle|googlesyndication|pagead|tagerror|doubleclick/i;

const ADSENSE_DOMAIN_PATTERN = /googlesyndication|pagead/i;

let inFlightScriptPromise: Promise<void> | null = null;
let errorMonitorInstalled = false;
const errorListeners = new Set<() => void>();

function notifyErrorListeners(): void {
  errorListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  });
}

function normalizeErrorEntry(
  raw: Partial<AdSenseConsoleErrorEntry> | null | undefined,
  index = 0
): AdSenseConsoleErrorEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const message =
    typeof raw.message === 'string' && raw.message.trim()
      ? raw.message
      : 'Erreur adsbygoogle';
  const source =
    raw.source === 'window.onerror' ||
    raw.source === 'resource' ||
    raw.source === 'console.error' ||
    raw.source === 'unhandledrejection'
      ? raw.source
      : 'window.onerror';
  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : Date.now();
  return {
    id:
      typeof raw.id === 'string' && raw.id
        ? raw.id
        : `${source}-${timestamp}-${index}`,
    source,
    message,
    filename: typeof raw.filename === 'string' ? raw.filename : undefined,
    lineno: typeof raw.lineno === 'number' ? raw.lineno : undefined,
    colno: typeof raw.colno === 'number' ? raw.colno : undefined,
    timestamp,
  };
}

function getLiveErrorLogArray(): AdSenseConsoleErrorEntry[] {
  if (typeof window === 'undefined') return [];
  if (!Array.isArray(window.__pdfexpressAdSenseErrorLog)) {
    window.__pdfexpressAdSenseErrorLog = [];
  }
  const log = window.__pdfexpressAdSenseErrorLog as AdSenseConsoleErrorEntry[] & {
    __pdfexpressWrapped?: boolean;
  };
  if (!log.__pdfexpressWrapped) {
    Object.defineProperty(log, '__pdfexpressWrapped', {
      value: true,
      enumerable: false,
      configurable: true,
    });
    const origPush = log.push.bind(log);
    const origUnshift = log.unshift.bind(log);
    log.push = (...items: AdSenseConsoleErrorEntry[]) => {
      const result = origPush(...items);
      notifyErrorListeners();
      return result;
    };
    log.unshift = (...items: AdSenseConsoleErrorEntry[]) => {
      const result = origUnshift(...items);
      notifyErrorListeners();
      return result;
    };
  }
  return log;
}

function recordAdSenseError(entry: Omit<AdSenseConsoleErrorEntry, 'id'>): void {
  const log = getLiveErrorLogArray();
  const duplicate = log.some(
    (item) =>
      item &&
      item.source === entry.source &&
      item.message === entry.message &&
      (item.filename || '') === (entry.filename || '') &&
      Math.abs((item.timestamp || 0) - entry.timestamp) < 500
  );
  if (duplicate) return;

  log.unshift({
    ...entry,
    id: `${entry.source}-${entry.timestamp}-${log.length}`,
  });
  if (log.length > 50) {
    log.length = 50;
  }
}

export function isAdSenseRelatedErrorText(text: string): boolean {
  return ADSENSE_ERROR_PATTERN.test(text);
}

export function isGoogleSyndicationOrPageAdError(
  entry: Pick<AdSenseConsoleErrorEntry, 'message' | 'filename'>
): boolean {
  const haystack = `${entry.filename || ''} ${entry.message || ''}`;
  return ADSENSE_DOMAIN_PATTERN.test(haystack);
}

export function installAdSenseErrorMonitor(): void {
  if (typeof window === 'undefined' || errorMonitorInstalled) return;
  errorMonitorInstalled = true;

  getLiveErrorLogArray();

  const previousOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const rawMsg =
      typeof message === 'string'
        ? message
        : error instanceof Error
        ? error.message
        : String(message ?? '');
    const stack = error instanceof Error && error.stack ? error.stack : '';
    const combined = `${rawMsg} ${source || ''} ${stack}`;

    if (isAdSenseRelatedErrorText(combined)) {
      recordAdSenseError({
        source: 'window.onerror',
        message: rawMsg || 'Erreur JavaScript liée à adsbygoogle',
        filename: source ? String(source) : undefined,
        lineno: typeof lineno === 'number' ? lineno : undefined,
        colno: typeof colno === 'number' ? colno : undefined,
        timestamp: Date.now(),
      });
    }

    if (typeof previousOnError === 'function') {
      return previousOnError.call(this, message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener(
    'error',
    (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLScriptElement) {
        const src = target.src || '';
        if (isAdSenseRelatedErrorText(src)) {
          recordAdSenseError({
            source: 'resource',
            message: 'Échec de chargement du script adsbygoogle.js',
            filename: src,
            timestamp: Date.now(),
          });
        }
        return;
      }

      if (event instanceof ErrorEvent) {
        const stack =
          event.error instanceof Error && event.error.stack
            ? event.error.stack
            : '';
        const combined = `${event.message || ''} ${event.filename || ''} ${stack}`;
        if (isAdSenseRelatedErrorText(combined)) {
          recordAdSenseError({
            source: 'window.onerror',
            message: event.message || 'Erreur runtime adsbygoogle',
            filename: event.filename || undefined,
            lineno: event.lineno || undefined,
            colno: event.colno || undefined,
            timestamp: Date.now(),
          });
        }
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error ? `${reason.message} ${reason.stack || ''}` : String(reason ?? '');
    if (isAdSenseRelatedErrorText(msg)) {
      recordAdSenseError({
        source: 'unhandledrejection',
        message: reason instanceof Error ? reason.message : String(reason ?? 'Promesse rejetée adsbygoogle'),
        timestamp: Date.now(),
      });
    }
  });

  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      try {
        const formatted = args
          .map((arg) => {
            if (arg instanceof Error) {
              return `${arg.name}: ${arg.message} ${arg.stack || ''}`;
            }
            if (typeof arg === 'string') return arg;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' ');
        if (isAdSenseRelatedErrorText(formatted)) {
          recordAdSenseError({
            source: 'console.error',
            message: formatted.slice(0, 320),
            timestamp: Date.now(),
          });
        }
      } catch {
        // Never interfere with console.error
      }
      originalConsoleError(...args);
    };
  }
}

export function getAdSenseErrors(): AdSenseConsoleErrorEntry[] {
  installAdSenseErrorMonitor();
  const log = getLiveErrorLogArray();
  return log
    .map((entry, idx) => normalizeErrorEntry(entry, idx))
    .filter((entry): entry is AdSenseConsoleErrorEntry => entry !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getGoogleSyndicationPageAdErrors(): AdSenseConsoleErrorEntry[] {
  return getAdSenseErrors().filter(isGoogleSyndicationOrPageAdError);
}

export function clearAdSenseErrors(): void {
  const log = getLiveErrorLogArray();
  log.length = 0;
  notifyErrorListeners();
}

export function subscribeAdSenseErrors(listener: () => void): () => void {
  installAdSenseErrorMonitor();
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  installAdSenseErrorMonitor();
}

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
    existing.dataset.pdfexpressHandled = 'true';
    if (
      existing.dataset.loaded === 'true' ||
      existing.dataset.errored === 'true' ||
      isAdSenseRuntimeReady()
    ) {
      if (existing.dataset.errored !== 'true') {
        existing.dataset.loaded = 'true';
      }
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
