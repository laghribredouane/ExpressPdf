import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Eye,
  FileCode2,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Ruler,
  Trash2,
  X,
} from 'lucide-react';
import {
  ADSENSE_SCRIPT_ATTR,
  type AdSenseConsoleErrorEntry,
  type AdSensePlacement,
  clearAdSenseErrors,
  getAdSenseClientId,
  getAdSenseErrors,
  getAdSenseSlotId,
  isGoogleSyndicationOrPageAdError,
  subscribeAdSenseErrors,
} from '../utils/adsense';

interface AdSenseTesterProps {
  isOpen: boolean;
  onClose: () => void;
  isAdFree: boolean;
}

interface DomSlotEntry {
  slot: string;
  adsbygoogleStatus: string;
  adStatus: string;
  dimensions: string;
}

interface TesterState {
  pauseAdRequests: number | undefined;
  adFreeStorage: string | null;
  readyState: DocumentReadyState | 'unknown';
  scriptPresent: boolean;
  scriptLoaded: boolean;
  scriptErrored: boolean;
  injectedByUtility: boolean;
  handledByUtility: boolean;
  adsByGoogleLoaded: boolean;
  runtimeHooked: boolean;
  clientId: string;
  hostname: string;
  slots: Record<AdSensePlacement, string>;
  domSlots: DomSlotEntry[];
  adErrors: AdSenseConsoleErrorEntry[];
}

function readTesterState(): TesterState {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      pauseAdRequests: undefined,
      adFreeStorage: null,
      readyState: 'unknown',
      scriptPresent: false,
      scriptLoaded: false,
      scriptErrored: false,
      injectedByUtility: false,
      handledByUtility: false,
      adsByGoogleLoaded: false,
      runtimeHooked: false,
      clientId: getAdSenseClientId(),
      hostname: '',
      slots: {
        home: getAdSenseSlotId('home'),
        workspace: getAdSenseSlotId('workspace'),
        result: getAdSenseSlotId('result'),
      },
      domSlots: [],
      adErrors: [],
    };
  }

  let adFreeStorage: string | null = null;
  try {
    adFreeStorage = localStorage.getItem('pdfexpress_ad_free');
  } catch {
    adFreeStorage = null;
  }

  const scriptEl = document.querySelector<HTMLScriptElement>(
    `script[${ADSENSE_SCRIPT_ATTR}="true"], script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`
  );

  const injectedByUtility =
    scriptEl?.getAttribute(ADSENSE_SCRIPT_ATTR) === 'true';
  const handledByUtility =
    injectedByUtility || scriptEl?.dataset.pdfexpressHandled === 'true';

  const runtimeHooked = Boolean(
    window.adsbygoogle && window.adsbygoogle.push !== Array.prototype.push
  );

  const domSlots = Array.from(
    document.querySelectorAll<HTMLElement>('ins.adsbygoogle')
  ).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      slot: el.getAttribute('data-ad-slot') || 'auto',
      adsbygoogleStatus:
        el.getAttribute('data-adsbygoogle-status') || 'non initialisé',
      adStatus: el.getAttribute('data-ad-status') || 'en attente',
      dimensions: `${Math.round(rect.width)}×${Math.round(rect.height)}px`,
    };
  });

  return {
    pauseAdRequests: window.adsbygoogle?.pauseAdRequests,
    adFreeStorage,
    readyState: document.readyState,
    scriptPresent: Boolean(scriptEl),
    scriptLoaded:
      scriptEl?.dataset.loaded === 'true' ||
      Boolean(window.adsbygoogle?.loaded) ||
      runtimeHooked,
    scriptErrored: scriptEl?.dataset.errored === 'true',
    injectedByUtility,
    handledByUtility,
    adsByGoogleLoaded: Boolean(window.adsbygoogle?.loaded) || runtimeHooked,
    runtimeHooked,
    clientId: getAdSenseClientId(),
    hostname: window.location.hostname,
    slots: {
      home: getAdSenseSlotId('home'),
      workspace: getAdSenseSlotId('workspace'),
      result: getAdSenseSlotId('result'),
    },
    domSlots,
    adErrors: getAdSenseErrors(),
  };
}

export function AdSenseTester({
  isOpen,
  onClose,
  isAdFree,
}: AdSenseTesterProps) {
  const [state, setState] = useState<TesterState>(() => readTesterState());
  const [errorFilterMode, setErrorFilterMode] = useState<'domains' | 'all'>(
    'domains'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => Date.now());
  const [previewPlacement, setPreviewPlacement] =
    useState<AdSensePlacement>('home');
  const [simulateEmptySlot, setSimulateEmptySlot] = useState(true);
  const [simulateHeightPx, setSimulateHeightPx] = useState<90 | 250>(90);
  const [measuredBox, setMeasuredBox] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const refreshState = useCallback(() => {
    setState(readTesterState());
    setLastSyncedAt(Date.now());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refreshState();

    const handleReadyStateChange = () => {
      refreshState();
    };
    document.addEventListener('readystatechange', handleReadyStateChange);
    const unsubscribeErrors = subscribeAdSenseErrors(refreshState);
    const timer = window.setInterval(refreshState, 1000);

    return () => {
      document.removeEventListener('readystatechange', handleReadyStateChange);
      unsubscribeErrors();
      window.clearInterval(timer);
    };
  }, [isOpen, isAdFree, refreshState]);

  useEffect(() => {
    if (!isOpen || !simulateEmptySlot || !previewContainerRef.current) {
      setMeasuredBox({ width: 0, height: 0 });
      return;
    }

    const measure = () => {
      if (!previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      setMeasuredBox({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [isOpen, simulateEmptySlot, previewPlacement, simulateHeightPx]);

  if (!isOpen) {
    return null;
  }

  const isPaused = state.pauseAdRequests === 1;
  const activeSlotValue = state.slots[previewPlacement] || '(vide — Auto Ads)';
  const hasUnfilledSlot = state.domSlots.some((s) => s.adStatus === 'unfilled');
  const isPreviewHost =
    state.hostname !== 'pdfexpress.ai.studio' &&
    state.hostname !== 'www.pdfexpress.ai.studio';
  const domainFilteredErrors = state.adErrors.filter(
    isGoogleSyndicationOrPageAdError
  );
  const visibleErrors =
    errorFilterMode === 'domains' ? domainFilteredErrors : state.adErrors;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AdSenseTester — Diagnostic et test d'espacement CSS"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-neutral-800 shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              AdSenseTester
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Raccourci : Ctrl+Shift+A · Paramètre URL : ?adsense_test=1
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={refreshState}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-brand-red inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer AdSenseTester"
              className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                adsbygoogle.pauseAdRequests
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                {isPaused ? (
                  <PauseCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : state.pauseAdRequests === 0 ? (
                  <PlayCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-neutral-400 shrink-0" />
                )}
                <span className="font-mono tabular-nums text-xs font-bold text-neutral-900 dark:text-white">
                  {isPaused
                    ? '1 (Activé — Pubs en pause)'
                    : state.pauseAdRequests === 0
                    ? '0 (Désactivé — Diffusion active)'
                    : 'undefined (Non initialisé)'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                Mode sans publicité (isAdFree)
              </span>
              <p className="font-mono tabular-nums text-xs font-bold text-neutral-900 dark:text-white pt-0.5">
                {isAdFree ? 'true (Masqué)' : 'false (Gratuit)'} · localStorage:{' '}
                {state.adFreeStorage ?? 'null'}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                Script adsbygoogle.js
              </span>
              <p className="font-mono text-xs font-bold text-neutral-900 dark:text-white pt-0.5">
                {state.scriptErrored
                  ? 'Bloqué / Erreur réseau (bloqueur de pub ?)'
                  : state.scriptPresent
                  ? state.scriptLoaded || state.adsByGoogleLoaded
                    ? 'Présent & chargé'
                    : 'Présent (chargement)'
                  : 'Supprimé du DOM'}
              </p>
            </div>
          </div>

          {/* Precise Loading, Utility Injection & window.onerror Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                Chargement document (readyState)
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                {state.readyState === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
                )}
                <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">
                  {state.readyState === 'complete'
                    ? 'complete (DOM & ressources prêts)'
                    : state.readyState === 'interactive'
                    ? 'interactive (DOM prêt, ressources en cours)'
                    : state.readyState === 'loading'
                    ? 'loading (Analyse HTML en cours)'
                    : state.readyState}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                Injection via notre utilitaire
              </span>
              <div className="flex items-start gap-2 pt-0.5">
                <FileCode2
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    state.injectedByUtility
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : state.scriptPresent
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-neutral-400'
                  }`}
                />
                <div className="font-mono text-xs font-bold text-neutral-900 dark:text-white leading-snug">
                  {state.injectedByUtility
                    ? 'Oui (injecté dynamiquement)'
                    : state.scriptPresent
                    ? state.handledByUtility
                      ? 'Non (balise <head> gérée par utilitaire)'
                      : 'Non (balise statique <head>)'
                    : 'Non (aucun script dans le DOM)'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  Erreurs googlesyndication / pagead
                </span>
                {state.adErrors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAdSenseErrors()}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-brand-red cursor-pointer"
                    title="Effacer les erreurs enregistrées"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Effacer</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <Bug
                  className={`w-4 h-4 shrink-0 ${
                    domainFilteredErrors.length > 0
                      ? 'text-red-600 dark:text-red-400'
                      : state.adErrors.length > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                />
                <span
                  className={`font-mono tabular-nums text-xs font-bold ${
                    domainFilteredErrors.length > 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-neutral-900 dark:text-white'
                  }`}
                >
                  {domainFilteredErrors.length === 0
                    ? state.adErrors.length === 0
                      ? '0 erreur (window.onerror sain)'
                      : `0 domaine · ${state.adErrors.length} autre(s)`
                    : `${domainFilteredErrors.length} erreur${
                        domainFilteredErrors.length > 1 ? 's' : ''
                      } domaine (${state.adErrors.length} total)`}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time window.__pdfexpressAdSenseErrorLog Monitor */}
          <div
            className={`rounded-xl border p-3.5 space-y-2.5 text-xs ${
              domainFilteredErrors.length > 0
                ? 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bug
                  className={`w-4 h-4 shrink-0 ${
                    domainFilteredErrors.length > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                />
                <span
                  className={`font-bold ${
                    domainFilteredErrors.length > 0
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-neutral-900 dark:text-white'
                  }`}
                >
                  Flux temps réel window.__pdfexpressAdSenseErrorLog
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[10px] text-neutral-500 dark:text-neutral-400 mr-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {new Date(lastSyncedAt).toLocaleTimeString('fr-FR')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setErrorFilterMode('domains')}
                  className={`px-2 py-1 rounded-md font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                    errorFilterMode === 'domains'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-white/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  googlesyndication / pagead ({domainFilteredErrors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setErrorFilterMode('all')}
                  className={`px-2 py-1 rounded-md font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                    errorFilterMode === 'all'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-white/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  Tous ({state.adErrors.length})
                </button>
                {state.adErrors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAdSenseErrors()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-brand-red border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Vider</span>
                  </button>
                )}
              </div>
            </div>

            {visibleErrors.length === 0 ? (
              <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                {errorFilterMode === 'domains'
                  ? 'Aucune erreur capturée dans window.__pdfexpressAdSenseErrorLog pour les domaines googlesyndication ou pagead.'
                  : 'Aucune erreur enregistrée dans window.__pdfexpressAdSenseErrorLog.'}
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
                {visibleErrors.map((err) => {
                  const matchesDomain = isGoogleSyndicationOrPageAdError(err);
                  return (
                    <li
                      key={err.id}
                      className="rounded-lg bg-white/90 dark:bg-neutral-900/80 border border-red-200/80 dark:border-red-900/50 px-2.5 py-1.5 text-red-900 dark:text-red-200 break-words"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold">[{err.source}]</span>
                        <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                          {new Date(err.timestamp).toLocaleTimeString('fr-FR')}
                        </span>
                        {matchesDomain && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-bold">
                            googlesyndication/pagead
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5">{err.message}</p>
                      {err.filename && (
                        <span className="block text-[10px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                          {err.filename}
                          {typeof err.lineno === 'number' ? `:${err.lineno}` : ''}
                          {typeof err.colno === 'number' ? `:${err.colno}` : ''}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Live DOM <ins> Diagnostic */}
          {(state.domSlots.length > 0 || state.scriptErrored || isPreviewHost || hasUnfilledSlot) && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-neutral-900 dark:text-white">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Diagnostic de remplissage en direct ({state.hostname})</span>
              </div>

              {state.scriptErrored && (
                <p className="text-red-700 dark:text-red-400">
                  Le script adsbygoogle.js a été bloqué par le navigateur ou une extension (AdBlock / Brave / DNS).
                </p>
              )}

              {isPreviewHost && (
                <p className="text-neutral-600 dark:text-neutral-300">
                  Vous consultez actuellement <span className="font-mono">{state.hostname}</span> : Google AdSense ne remplit généralement pas les annonces hors du domaine approuvé <span className="font-mono">pdfexpress.ai.studio</span>.
                </p>
              )}

              {hasUnfilledSlot && (
                <p className="text-amber-800 dark:text-amber-300">
                  Google AdSense a répondu <span className="font-mono font-bold">data-ad-status=&quot;unfilled&quot;</span> (aucune annonce servie tant que le domaine / ads.txt est en cours d&apos;examen dans AdSense).
                </p>
              )}

              {state.domSlots.length > 0 && (
                <div className="overflow-x-auto pt-1">
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead className="text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="py-1.5 pr-3">Slot</th>
                        <th className="py-1.5 pr-3">adsbygoogle-status</th>
                        <th className="py-1.5 pr-3">ad-status</th>
                        <th className="py-1.5 text-right">Taille</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {state.domSlots.map((item, i) => (
                        <tr key={`${item.slot}-${i}`}>
                          <td className="py-1.5 pr-3">{item.slot}</td>
                          <td className="py-1.5 pr-3">{item.adsbygoogleStatus}</td>
                          <td className="py-1.5 pr-3">{item.adStatus}</td>
                          <td className="py-1.5 text-right">{item.dimensions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Empty Slot CSS Spacing Simulator */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="font-display text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-brand-red shrink-0" />
                  <span>Simulateur de slot vide &amp; vérification d&apos;espacement CSS</span>
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Vérifie les marges, bordures et dimensions réelles d&apos;un bloc AdSense sans envoyer d&apos;impression.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSimulateEmptySlot((prev) => !prev)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  simulateEmptySlot
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                    : 'border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>
                  {simulateEmptySlot ? 'Masquer l’aperçu' : 'Afficher le slot vide'}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 overflow-x-auto max-w-full">
                {(['home', 'workspace', 'result'] as AdSensePlacement[]).map(
                  (placement) => (
                    <button
                      key={placement}
                      type="button"
                      onClick={() => setPreviewPlacement(placement)}
                      className={`px-3 py-1.5 rounded-md font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        previewPlacement === placement
                          ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {placement === 'home'
                        ? 'HomeView'
                        : placement === 'workspace'
                        ? 'WorkspaceView'
                        : 'Result'}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-neutral-500 dark:text-neutral-400 font-semibold">
                  Hauteur test :
                </span>
                {([90, 250] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSimulateHeightPx(h)}
                    className={`px-2.5 py-1 rounded-md font-mono tabular-nums font-bold border cursor-pointer ${
                      simulateHeightPx === h
                        ? 'border-brand-red text-brand-red bg-red-50/60 dark:bg-red-950/30'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {h}px
                  </button>
                ))}
              </div>
            </div>

            {simulateEmptySlot && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                  <span>
                    client: {state.clientId} · slot ({previewPlacement}):{' '}
                    {activeSlotValue}
                  </span>
                  <span>
                    Dimensions mesurées : {measuredBox.width}px ×{' '}
                    {measuredBox.height}px
                  </span>
                </div>

                {/* Exact AdSenseBanner container geometry */}
                <div
                  ref={previewContainerRef}
                  className="w-full rounded-2xl border border-dashed border-amber-400 dark:border-amber-600 bg-white/95 dark:bg-brand-cardDark/95 p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    <span>
                      Publicité · Google AdSense (gabarit CSS vide —{' '}
                      {previewPlacement})
                    </span>
                    <span className="font-mono tabular-nums">
                      padding 12–16px · gap 10px
                    </span>
                  </div>
                  <div
                    style={{ minHeight: `${simulateHeightPx}px` }}
                    className="w-full flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/50"
                  >
                    <div className="text-center px-4 py-3 space-y-1">
                      <p className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-200">
                        &lt;ins class=&quot;adsbygoogle w-full&quot;
                        style=&quot;display:block&quot; /&gt;
                      </p>
                      <p className="font-mono tabular-nums text-[11px] text-neutral-500 dark:text-neutral-400">
                        data-ad-client=&quot;{state.clientId}&quot; ·
                        data-ad-format=&quot;auto&quot; · min-h:{' '}
                        {simulateHeightPx}px
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
