import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  type AdSensePlacement,
  DEFAULT_ADSENSE_CLIENT_ID,
  ensureAdSenseScriptLoaded,
  getAdSenseClientId,
  getAdSenseSlotId,
  removeAdSenseFromDocument,
} from '../utils/adsense';

interface AdSenseEndpointProbe {
  path: string;
  url: string;
  ok: boolean;
  status: number;
  redirectedTo302: boolean;
  locationHeader: string | null;
  contentType: string;
  cacheControl: string;
  latencyMs: number;
  snippet: string;
  error?: string;
}

interface AdSenseTargetReport {
  baseUrl: string;
  checkedAt: string;
  overallStatus: 'pass' | 'warn' | 'fail';
  detectedPublisherIds: string[];
  detectedMetaClientId: string | null;
  detectedScriptClientId: string | null;
  detectedCanonicalUrl: string | null;
  adsTxtMatchesExpected: boolean;
  hasNo302Redirect: boolean;
  headMetaValid: boolean;
  headScriptValid: boolean;
  canonicalMatchesTarget: boolean;
  robotsAllowRoot: boolean;
  probes: {
    home: AdSenseEndpointProbe;
    adsTxt: AdSenseEndpointProbe;
    robotsTxt: AdSenseEndpointProbe;
    sitemapXml: AdSenseEndpointProbe;
  };
}

interface AdSenseVerifyApiResponse {
  expectedClientId: string;
  expectedPubId: string;
  expectedAdsTxtLine: string;
  remote: AdSenseTargetReport;
  local: AdSenseTargetReport;
}

interface AdSenseDiagnosticPanelProps {
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type ScriptLoadStatus = 'loaded' | 'loading' | 'errored' | 'absent';

interface DomAuditSnapshot {
  clientId: string;
  metaContent: string | null;
  scriptSrc: string | null;
  scriptStatus: ScriptLoadStatus;
  localStorageAdFree: string | null;
  pauseAdRequests: number | null;
  slotHome: string;
  slotWorkspace: string;
  slotResult: string;
  canonicalHref: string | null;
  insCount: number;
}

function StatusLabel({
  state,
  passText = 'Conforme',
  warnText = 'Attention',
  failText = 'Non conforme',
}: {
  state: 'pass' | 'warn' | 'fail';
  passText?: string;
  warnText?: string;
  failText?: string;
}) {
  if (state === 'pass') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{passText}</span>
      </span>
    );
  }
  if (state === 'warn') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{warnText}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400 whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{failText}</span>
    </span>
  );
}

export function AdSenseDiagnosticPanel({ onNotify }: AdSenseDiagnosticPanelProps) {
  const [targetUrl, setTargetUrl] = useState('https://pdfexpress.ai.studio');
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<AdSenseVerifyApiResponse | null>(null);
  const [viewScope, setViewScope] = useState<'remote' | 'local'>('remote');
  const [domSnapshot, setDomSnapshot] = useState<DomAuditSnapshot | null>(null);

  // Manual debug refresh state
  const [debugPlacement, setDebugPlacement] = useState<AdSensePlacement>('home');
  const [debugSlotInput, setDebugSlotInput] = useState(() =>
    getAdSenseSlotId('home')
  );
  const [debugMounted, setDebugMounted] = useState(false);
  const [debugRefreshKey, setDebugRefreshKey] = useState(0);
  const [debugRefreshing, setDebugRefreshing] = useState(false);
  const [debugInsStatus, setDebugInsStatus] = useState<string>(
    'En attente d’un rafraîchissement manuel'
  );
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<string | null>(
    null
  );
  const debugInsRef = useRef<HTMLModElement | null>(null);

  const readDomSnapshot = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const metaEl = document.querySelector<HTMLMetaElement>(
      'meta[name="google-adsense-account"]'
    );
    const scriptEl = document.querySelector<HTMLScriptElement>(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    const canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const insCount = document.querySelectorAll('ins.adsbygoogle').length;

    let localStorageAdFree: string | null = null;
    try {
      localStorageAdFree = localStorage.getItem('pdfexpress_ad_free');
    } catch {
      localStorageAdFree = null;
    }

    let scriptStatus: ScriptLoadStatus = 'absent';
    if (scriptEl) {
      if (scriptEl.dataset.errored === 'true') {
        scriptStatus = 'errored';
      } else if (
        scriptEl.dataset.loaded === 'true' ||
        window.adsbygoogle?.loaded === true ||
        (window.adsbygoogle && window.adsbygoogle.push !== Array.prototype.push)
      ) {
        scriptStatus = 'loaded';
      } else {
        scriptStatus = 'loading';
      }
    }

    setDomSnapshot({
      clientId: getAdSenseClientId(),
      metaContent: metaEl?.content || null,
      scriptSrc: scriptEl?.src || null,
      scriptStatus,
      localStorageAdFree,
      pauseAdRequests:
        typeof window.adsbygoogle?.pauseAdRequests === 'number'
          ? window.adsbygoogle.pauseAdRequests
          : null,
      slotHome: getAdSenseSlotId('home'),
      slotWorkspace: getAdSenseSlotId('workspace'),
      slotResult: getAdSenseSlotId('result'),
      canonicalHref: canonicalEl?.href || null,
      insCount,
    });
  }, []);

  const runVerification = useCallback(
    async (customUrl?: string) => {
      readDomSnapshot();
      setChecking(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/admin/adsense-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: (customUrl ?? targetUrl).trim() }),
        });
        const payload = (await res.json()) as AdSenseVerifyApiResponse & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            payload.error || 'Impossible de vérifier le domaine cible.'
          );
        }
        setReport(payload);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Erreur lors du contrôle Google AdSense.';
        setErrorMsg(msg);
        onNotify(msg, 'error');
      } finally {
        setChecking(false);
      }
    },
    [onNotify, readDomSnapshot, targetUrl]
  );

  useEffect(() => {
    void runVerification('https://pdfexpress.ai.studio');
  }, [runVerification]);

  useEffect(() => {
    setDebugSlotInput(getAdSenseSlotId(debugPlacement));
  }, [debugPlacement]);

  const handleForceAdRefresh = useCallback(async () => {
    const clientId = getAdSenseClientId();
    setDebugRefreshing(true);
    setDebugMounted(true);
    setDebugRefreshKey((prev) => prev + 1);

    try {
      await ensureAdSenseScriptLoaded(clientId);
      requestAnimationFrame(() => {
        const el = debugInsRef.current;
        const effectiveSlot = debugSlotInput.trim() || getAdSenseSlotId(debugPlacement);
        if (el && effectiveSlot) {
          try {
            window.adsbygoogle = window.adsbygoogle || [];
            window.adsbygoogle.push({});
            const adStatus =
              el.getAttribute('data-adsbygoogle-status') ||
              el.getAttribute('data-ad-status') ||
              'push() exécuté';
            setDebugInsStatus(adStatus);
          } catch (err) {
            setDebugInsStatus(
              err instanceof Error ? err.message : 'Erreur push() AdSense'
            );
          }
        } else {
          setDebugInsStatus(
            effectiveSlot
              ? 'Bloc <ins> non monté'
              : 'Script chargé · Aucun data-ad-slot saisi (aperçu CSS uniquement)'
          );
        }
        setLastManualRefreshAt(new Date().toLocaleTimeString('fr-FR'));
        readDomSnapshot();
        setDebugRefreshing(false);
        onNotify('Bloc AdSense de débogage rafraîchi.', 'success');
      });
    } catch {
      setDebugRefreshing(false);
      setDebugInsStatus('Erreur lors du rechargement du script AdSense');
      onNotify('Impossible de rafraîchir le script AdSense.', 'error');
    }
  }, [debugPlacement, debugSlotInput, onNotify, readDomSnapshot]);

  const handleRestoreAdminAdFree = useCallback(() => {
    setDebugMounted(false);
    try {
      localStorage.setItem('pdfexpress_ad_free', '1');
    } catch {
      // Ignore storage quota errors
    }
    removeAdSenseFromDocument();
    setDebugInsStatus('Nettoyé — mode sans publicité restauré');
    readDomSnapshot();
    onNotify('Mode sans publicité restauré pour la session Admin.', 'info');
  }, [onNotify, readDomSnapshot]);

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify(`${label} copié dans le presse-papiers.`, 'success');
    } catch {
      onNotify('Copie impossible depuis ce navigateur.', 'error');
    }
  };

  const activeTarget = report
    ? viewScope === 'remote'
      ? report.remote
      : report.local
    : null;

  const remoteHasStaleId = Boolean(
    report?.remote.detectedPublisherIds.some(
      (id) =>
        id !== report.expectedClientId && id !== report.expectedPubId
    )
  );

  const expectedScriptSnippet = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${DEFAULT_ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>`;
  const expectedAdsTxtSnippet = `google.com, pub-7807016100432800, DIRECT, f08c47fec0942fa0`;

  const scriptStatusLabel =
    domSnapshot?.scriptStatus === 'loaded'
      ? 'Chargé et opérationnel'
      : domSnapshot?.scriptStatus === 'loading'
      ? 'Chargement en cours'
      : domSnapshot?.scriptStatus === 'errored'
      ? 'Erreur de chargement'
      : 'Absent du DOM (supprimé en mode sans pub)';

  return (
    <section className="space-y-6">
      {/* Control bar */}
      <div className="rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              Diagnostic de liaison Google AdSense
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Vérifie les en-têtes HTTP sans redirection 302, les balises &lt;head&gt; et le fichier /ads.txt tels que vus par Googlebot.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runVerification();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto"
          >
            <div className="relative flex-grow sm:w-72">
              <Globe className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://pdfexpress.ai.studio"
                aria-label="Domaine public à vérifier"
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-mono text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-red"
              />
            </div>
            <button
              type="submit"
              disabled={checking}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`}
              />
              <span>
                {checking ? 'Vérification...' : 'Lancer la vérification'}
              </span>
            </button>
          </form>
        </div>

        {/* Local vs Remote Alert if deployed public site is stale */}
        {report && remoteHasStaleId && report.local.overallStatus === 'pass' && (
          <div
            role="status"
            className="rounded-lg border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold">
                  Le domaine public {report.remote.baseUrl} diffuse encore une version publiée antérieure
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  Identifiants détectés en ligne :{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {report.remote.detectedPublisherIds.join(', ') || 'aucun'}
                  </span>
                  . Le serveur local est déjà conforme avec{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {report.expectedClientId}
                  </span>
                  {' '}— republiez l&apos;application puis relancez le test pour valider dans AdSense.
                </p>
              </div>
            </div>
            <a
              href="https://pdfexpress.ai.studio/ads.txt"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 whitespace-nowrap shrink-0"
            >
              <span>Voir /ads.txt en ligne</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Scope selector + Remote/Local Report */}
      <div className="rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => setViewScope('remote')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                viewScope === 'remote'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Domaine public ({report?.remote.baseUrl.replace(/^https?:\/\//, '') || 'pdfexpress.ai.studio'})
            </button>
            <button
              type="button"
              onClick={() => setViewScope('local')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                viewScope === 'local'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Code local actif
            </button>
          </div>

          {activeTarget && (
            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <StatusLabel
                state={activeTarget.overallStatus}
                passText="Prêt pour AdSense"
                warnText="Avertissement mineur"
                failText="Action requise"
              />
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {new Date(activeTarget.checkedAt).toLocaleTimeString('fr-FR')}
              </span>
            </div>
          )}
        </div>

        {checking && !activeTarget ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : activeTarget ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Point de contrôle</th>
                  <th className="py-2.5 px-3 font-semibold">Attendu</th>
                  <th className="py-2.5 px-3 font-semibold">Observé</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                    Accès public sans redirection 302
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    HTTP 200 sur / et /ads.txt
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-700 dark:text-neutral-200">
                    / → {activeTarget.probes.home.status || 'ERR'} · /ads.txt →{' '}
                    {activeTarget.probes.adsTxt.status || 'ERR'}
                    {activeTarget.probes.home.locationHeader
                      ? ` (Location: ${activeTarget.probes.home.locationHeader})`
                      : ''}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusLabel
                      state={activeTarget.hasNo302Redirect ? 'pass' : 'fail'}
                      failText={
                        activeTarget.probes.home.redirectedTo302
                          ? 'Redirection 302'
                          : 'Erreur HTTP'
                      }
                    />
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                    Balise meta google-adsense-account
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    {report?.expectedClientId}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-700 dark:text-neutral-200">
                    {activeTarget.detectedMetaClientId || 'Absente'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusLabel
                      state={activeTarget.headMetaValid ? 'pass' : 'fail'}
                      failText="Identifiant différent"
                    />
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                    Script Auto Ads dans &lt;head&gt;
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                    adsbygoogle.js?client={report?.expectedClientId}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-700 dark:text-neutral-200">
                    {activeTarget.detectedScriptClientId || 'Absent'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusLabel
                      state={activeTarget.headScriptValid ? 'pass' : 'fail'}
                      failText="Script non aligné"
                    />
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                    Fichier /ads.txt (text/plain)
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-600 dark:text-neutral-300">
                    {report?.expectedPubId}
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-700 dark:text-neutral-200 max-w-[280px] truncate">
                    {activeTarget.probes.adsTxt.snippet ||
                      activeTarget.probes.adsTxt.error ||
                      'Vide'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusLabel
                      state={activeTarget.adsTxtMatchesExpected ? 'pass' : 'fail'}
                      failText="Contenu différent"
                    />
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                    URL canonique HTML
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-600 dark:text-neutral-300">
                    https://pdfexpress.ai.studio/
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-700 dark:text-neutral-200">
                    {activeTarget.detectedCanonicalUrl || 'Absente'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusLabel
                      state={activeTarget.canonicalMatchesTarget ? 'pass' : 'warn'}
                      warnText="Domaine différent"
                    />
                  </td>
                </tr>

                <tr>
                  <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                    Exploration robots.txt &amp; sitemap.xml
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-600 dark:text-neutral-300">
                    Allow: / · Sitemap 200
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-neutral-700 dark:text-neutral-200">
                    robots.txt → {activeTarget.probes.robotsTxt.status} · sitemap.xml →{' '}
                    {activeTarget.probes.sitemapXml.status}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusLabel
                      state={
                        activeTarget.robotsAllowRoot &&
                        activeTarget.probes.sitemapXml.ok
                          ? 'pass'
                          : 'warn'
                      }
                      warnText="À vérifier"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Client DOM & Manual Ad Block Debug Refresh */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>État script, stockage &amp; navigateur</span>
            </h3>
            <button
              type="button"
              onClick={readDomSnapshot}
              className="text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red cursor-pointer"
            >
              Actualiser DOM
            </button>
          </div>

          <dl className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">
                Chargement du script AdSense
              </dt>
              <dd className="font-mono font-semibold text-neutral-900 dark:text-white text-right">
                {scriptStatusLabel}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">
                localStorage.getItem(&apos;pdfexpress_ad_free&apos;)
              </dt>
              <dd className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-white">
                {domSnapshot?.localStorageAdFree === '1'
                  ? '"1" (Sans pub)'
                  : domSnapshot?.localStorageAdFree ?? 'null (Mode gratuit)'}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">
                ID client résolu (fallback inclus)
              </dt>
              <dd className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-white">
                {domSnapshot?.clientId || DEFAULT_ADSENSE_CLIENT_ID}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">
                pauseAdRequests (session admin)
              </dt>
              <dd className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-white">
                {domSnapshot?.pauseAdRequests === 1
                  ? '1 (Publicités bloquées pour admin/Premium)'
                  : domSnapshot?.pauseAdRequests === 0
                  ? '0 (Diffusion active en gratuit)'
                  : 'Non initialisé'}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">
                Blocs manuels (Home / Workspace / Result)
              </dt>
              <dd className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                {[
                  domSnapshot?.slotHome || 'auto',
                  domSnapshot?.slotWorkspace || 'auto',
                  domSnapshot?.slotResult || 'auto',
                ].join(' / ')}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">
                Encarts &lt;ins.adsbygoogle&gt; dans le DOM
              </dt>
              <dd className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-white">
                {domSnapshot?.insCount ?? 0}
              </dd>
            </div>
          </dl>
        </div>

        {/* Manual ad block refresh debug tool */}
        <div className="rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3.5">
          <div className="space-y-0.5">
            <h3 className="font-display text-sm font-bold text-neutral-900 dark:text-white">
              Débogage &amp; rafraîchissement manuel du bloc d&apos;annonce
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Recharge le script AdSense et réinitialise un bloc de test sans quitter la console admin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={debugPlacement}
              onChange={(e) =>
                setDebugPlacement(e.target.value as AdSensePlacement)
              }
              aria-label="Emplacement de test AdSense"
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-semibold text-neutral-800 dark:text-neutral-200 outline-none"
            >
              <option value="home">Placement : Home</option>
              <option value="workspace">Placement : Workspace</option>
              <option value="result">Placement : Result</option>
            </select>

            <input
              type="text"
              value={debugSlotInput}
              onChange={(e) => setDebugSlotInput(e.target.value)}
              placeholder="ID data-ad-slot (optionnel)"
              aria-label="Identifiant du slot de débogage"
              className="flex-grow min-w-[160px] min-h-[38px] px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-mono text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-red"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={debugRefreshing}
              onClick={() => void handleForceAdRefresh()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${debugRefreshing ? 'animate-spin' : ''}`}
              />
              <span>Forcer le rafraîchissement du bloc</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreAdminAdFree}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-brand-red inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Nettoyer &amp; repasser sans pub</span>
            </button>
          </div>

          <div className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            Statut bloc : {debugInsStatus}
            {lastManualRefreshAt ? ` · ${lastManualRefreshAt}` : ''}
          </div>

          {debugMounted && (
            <div
              key={debugRefreshKey}
              className="w-full min-h-[90px] rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/50 p-3 flex items-center justify-center overflow-hidden"
            >
              {debugSlotInput.trim() ? (
                <ins
                  ref={debugInsRef}
                  className="adsbygoogle w-full"
                  style={{ display: 'block' }}
                  data-ad-client={getAdSenseClientId()}
                  data-ad-slot={debugSlotInput.trim()}
                  data-ad-format="auto"
                  data-full-width-responsive="true"
                  data-adtest="on"
                />
              ) : (
                <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 text-center">
                  Conteneur de test ({debugPlacement}) monté · min-h 90px · saisissez un slot ID pour exécuter push({`{}`})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reference Snippets */}
      <div className="rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 space-y-3">
        <h3 className="font-display text-sm font-bold text-neutral-900 dark:text-white">
          Extraits de référence AdSense
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400 font-semibold">
                Extrait /ads.txt
              </span>
              <button
                type="button"
                onClick={() => void handleCopy('Extrait ads.txt', expectedAdsTxtSnippet)}
                className="inline-flex items-center gap-1 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-brand-red cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copier</span>
              </button>
            </div>
            <pre className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] overflow-x-auto text-neutral-800 dark:text-neutral-200">
              {expectedAdsTxtSnippet}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400 font-semibold">
                Balise &lt;script&gt; dans &lt;head&gt;
              </span>
              <button
                type="button"
                onClick={() => void handleCopy('Code AdSense', expectedScriptSnippet)}
                className="inline-flex items-center gap-1 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:text-brand-red cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copier</span>
              </button>
            </div>
            <pre className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] overflow-x-auto text-neutral-800 dark:text-neutral-200">
              {expectedScriptSnippet}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
