import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Ruler,
  X,
} from 'lucide-react';
import {
  type AdSensePlacement,
  getAdSenseClientId,
  getAdSenseSlotId,
} from '../utils/adsense';

interface AdSenseTesterProps {
  isOpen: boolean;
  onClose: () => void;
  isAdFree: boolean;
}

interface TesterState {
  pauseAdRequests: number | undefined;
  adFreeStorage: string | null;
  scriptPresent: boolean;
  scriptLoaded: boolean;
  adsByGoogleLoaded: boolean;
  clientId: string;
  slots: Record<AdSensePlacement, string>;
}

function readTesterState(): TesterState {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      pauseAdRequests: undefined,
      adFreeStorage: null,
      scriptPresent: false,
      scriptLoaded: false,
      adsByGoogleLoaded: false,
      clientId: getAdSenseClientId(),
      slots: {
        home: getAdSenseSlotId('home'),
        workspace: getAdSenseSlotId('workspace'),
        result: getAdSenseSlotId('result'),
      },
    };
  }

  let adFreeStorage: string | null = null;
  try {
    adFreeStorage = localStorage.getItem('pdfexpress_ad_free');
  } catch {
    adFreeStorage = null;
  }

  const scriptEl = document.querySelector<HTMLScriptElement>(
    'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
  );

  return {
    pauseAdRequests: window.adsbygoogle?.pauseAdRequests,
    adFreeStorage,
    scriptPresent: Boolean(scriptEl),
    scriptLoaded:
      scriptEl?.dataset.loaded === 'true' || Boolean(window.adsbygoogle?.loaded),
    adsByGoogleLoaded: Boolean(window.adsbygoogle?.loaded),
    clientId: getAdSenseClientId(),
    slots: {
      home: getAdSenseSlotId('home'),
      workspace: getAdSenseSlotId('workspace'),
      result: getAdSenseSlotId('result'),
    },
  };
}

export function AdSenseTester({
  isOpen,
  onClose,
  isAdFree,
}: AdSenseTesterProps) {
  const [state, setState] = useState<TesterState>(() => readTesterState());
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
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refreshState();
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
                {state.scriptPresent
                  ? state.scriptLoaded || state.adsByGoogleLoaded
                    ? 'Présent & chargé'
                    : 'Présent (chargement)'
                  : 'Supprimé du DOM'}
              </p>
            </div>
          </div>

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
              <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                {(['home', 'workspace', 'result'] as AdSensePlacement[]).map(
                  (placement) => (
                    <button
                      key={placement}
                      type="button"
                      onClick={() => setPreviewPlacement(placement)}
                      className={`px-3 py-1.5 rounded-md font-bold transition-colors whitespace-nowrap cursor-pointer ${
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
