const FP_STORAGE_KEY = 'pdfexpress_device_fp_v1';
const GUEST_USAGE_KEY = 'pdfexpress_guest_usage_v1';
const IDB_NAME = 'pdfexpress_device_db';
const IDB_STORE = 'device_meta';

export interface DeviceTelemetry {
  deviceFingerprint: string;
  userAgent: string;
  os: string;
  browser: string;
  screenResolution: string;
  timezone: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  webglRenderer: string;
  lastIp: string;
}

interface GuestUsageSnapshot {
  dateKey: string;
  count: number;
  fingerprint: string;
}

function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 8, 90, 22);
    ctx.fillStyle = '#069';
    ctx.fillText('PDFExpress-FP-2026', 14, 12);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('HW-ID', 14, 34);
    return canvas.toDataURL().slice(-120);
  } catch {
    return 'canvas-err';
  }
}

function getWebGLInfo(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return { vendor: 'no-webgl', renderer: 'no-webgl' };
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      const vendor = String(gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) || '');
      const renderer = String(
        gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || ''
      );
      return {
        vendor: vendor || 'unknown-vendor',
        renderer: renderer || 'unknown-renderer',
      };
    }
    return {
      vendor: String(gl.getParameter(gl.VENDOR) || 'webgl-vendor'),
      renderer: String(gl.getParameter(gl.RENDERER) || 'webgl-renderer'),
    };
  } catch {
    return { vendor: 'webgl-err', renderer: 'webgl-err' };
  }
}

export function detectOperatingSystem(): string {
  const ua = navigator.userAgent || '';
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
    navigator.platform ||
    '';
  const combined = `${platform} ${ua}`.toLowerCase();
  if (combined.includes('android')) return 'Android';
  if (combined.includes('iphone') || combined.includes('ipad') || combined.includes('ios'))
    return 'iOS';
  if (combined.includes('win')) return 'Windows';
  if (combined.includes('mac')) return 'macOS';
  if (combined.includes('linux')) return 'Linux';
  if (combined.includes('cros')) return 'ChromeOS';
  return platform || 'Système inconnu';
}

export function detectBrowserName(): string {
  const ua = navigator.userAgent || '';
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Firefox/')) return 'Mozilla Firefox';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Google Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
  return 'Navigateur web';
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const bytes = Array.from(new Uint8Array(hashBuffer));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback FNV-1a 64-bit hex if SubtleCrypto unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

function openDeviceDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readFromIdb<T>(key: string): Promise<T | null> {
  const db = await openDeviceDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeToIdb(key: string, value: unknown): Promise<void> {
  const db = await openDeviceDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

let cachedFingerprintPromise: Promise<string> | null = null;

/**
 * Génère et persiste de manière redondante (localStorage + IndexedDB)
 * une empreinte matérielle SHA-256 stable (équivalent navigateur d'adresse MAC).
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprintPromise) return cachedFingerprintPromise;

  cachedFingerprintPromise = (async () => {
    const fromLs = (() => {
      try {
        return localStorage.getItem(FP_STORAGE_KEY);
      } catch {
        return null;
      }
    })();

    const fromIdb = await readFromIdb<string>(FP_STORAGE_KEY);

    const webgl = getWebGLInfo();
    const canvasSig = getCanvasFingerprint();
    const cores = navigator.hardwareConcurrency || 0;
    const memory =
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0;
    const screenSig = `${window.screen?.width || 0}x${window.screen?.height || 0}x${
      window.screen?.colorDepth || 0
    }x${window.devicePixelRatio || 1}`;
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const os = detectOperatingSystem();
    const lang = navigator.language || 'fr';

    const hardwareSeed = [
      webgl.vendor,
      webgl.renderer,
      canvasSig,
      String(cores),
      String(memory),
      screenSig,
      timezone,
      os,
      lang,
    ].join('|');

    const computedHex = await sha256Hex(hardwareSeed);
    const computedId = `fp_${computedHex.slice(0, 40)}`;

    // Préfère l'empreinte déjà ancrée en stockage redondant pour résister aux variations mineures
    const canonicalId = fromIdb || fromLs || computedId;

    try {
      localStorage.setItem(FP_STORAGE_KEY, canonicalId);
    } catch {
      // Ignore quota errors
    }
    if (fromIdb !== canonicalId) {
      await writeToIdb(FP_STORAGE_KEY, canonicalId);
    }

    return canonicalId;
  })();

  return cachedFingerprintPromise;
}

export async function collectDeviceTelemetry(): Promise<DeviceTelemetry> {
  const deviceFingerprint = await getDeviceFingerprint();
  const webgl = getWebGLInfo();
  const os = detectOperatingSystem();
  const browser = detectBrowserName();
  const screenResolution = `${window.screen?.width || 0}x${
    window.screen?.height || 0
  }`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const hardwareConcurrency = navigator.hardwareConcurrency || 0;
  const deviceMemory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0;

  let lastIp = 'client-local';
  try {
    const res = await fetch('/api/device/client-info');
    if (res.ok) {
      const data = (await res.json()) as { ip?: string };
      if (data.ip) lastIp = String(data.ip).slice(0, 64);
    }
  } catch {
    // Fallback cleanly
  }

  return {
    deviceFingerprint,
    userAgent: (navigator.userAgent || 'unknown').slice(0, 300),
    os: os.slice(0, 80),
    browser: browser.slice(0, 80),
    screenResolution: screenResolution.slice(0, 40),
    timezone,
    hardwareConcurrency,
    deviceMemory,
    webglRenderer: webgl.renderer.slice(0, 120),
    lastIp,
  };
}

export async function getGuestDailyUsageCount(
  fingerprint: string
): Promise<number> {
  const today = getTodayDateKey();
  let localCount = 0;

  try {
    const raw = localStorage.getItem(GUEST_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GuestUsageSnapshot;
      if (parsed.dateKey === today) {
        localCount = Math.max(localCount, Number(parsed.count) || 0);
      }
    }
  } catch {
    // Ignore parse errors
  }

  const idbVal = await readFromIdb<GuestUsageSnapshot>(GUEST_USAGE_KEY);
  if (idbVal && idbVal.dateKey === today) {
    localCount = Math.max(localCount, Number(idbVal.count) || 0);
  }

  try {
    const res = await fetch('/api/quota/guest/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceFingerprint: fingerprint }),
    });
    if (res.ok) {
      const data = (await res.json()) as { count?: number };
      if (typeof data.count === 'number') {
        localCount = Math.max(localCount, data.count);
      }
    }
  } catch {
    // Offline fallback uses redundant local stores
  }

  return localCount;
}

export async function incrementGuestDailyUsage(
  fingerprint: string
): Promise<number> {
  const today = getTodayDateKey();
  const current = await getGuestDailyUsageCount(fingerprint);
  const nextCount = current + 1;
  const payload: GuestUsageSnapshot = {
    dateKey: today,
    count: nextCount,
    fingerprint,
  };

  try {
    localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore
  }
  await writeToIdb(GUEST_USAGE_KEY, payload);

  try {
    const res = await fetch('/api/quota/guest/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceFingerprint: fingerprint }),
    });
    if (res.ok) {
      const data = (await res.json()) as { count?: number };
      if (typeof data.count === 'number') {
        return Math.max(nextCount, data.count);
      }
    }
  } catch {
    // Keep client count
  }

  return nextCount;
}
