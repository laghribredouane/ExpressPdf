import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Eraser,
  Eye,
  FileOutput,
  Palette,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import {
  STUDIO_COPY,
  getLocalizedToolMeta,
  normalizeLang,
} from '../../data/studioI18n';
import type { QuotaCheckResult, ToolDefinition, ToolId } from '../../types/pdf';
import { formatBytes } from '../../utils/pdfEngine';

type BgChoice =
  | { kind: 'transparent' }
  | { kind: 'solid'; color: string; labelKey: 'bgWhite' | 'bgBlack' | 'bgCustom' }
  | {
      kind: 'gradient';
      from: string;
      to: string;
      labelKey:
        | 'bgGradientCoral'
        | 'bgGradientOcean'
        | 'bgGradientEmerald'
        | 'bgGradientSlate';
    };

const PRESET_BACKGROUNDS: BgChoice[] = [
  { kind: 'transparent' },
  { kind: 'solid', color: '#FFFFFF', labelKey: 'bgWhite' },
  { kind: 'solid', color: '#0F172A', labelKey: 'bgBlack' },
  {
    kind: 'gradient',
    from: '#F43F5E',
    to: '#FB923C',
    labelKey: 'bgGradientCoral',
  },
  {
    kind: 'gradient',
    from: '#0EA5E9',
    to: '#6366F1',
    labelKey: 'bgGradientOcean',
  },
  {
    kind: 'gradient',
    from: '#10B981',
    to: '#14B8A6',
    labelKey: 'bgGradientEmerald',
  },
  {
    kind: 'gradient',
    from: '#0F172A',
    to: '#334155',
    labelKey: 'bgGradientSlate',
  },
];

interface ImageBgRemoverProps {
  tool: ToolDefinition;
  language?: string;
  initialFiles?: File[] | null;
  onConsumeInitialFiles?: () => void;
  isPremiumOrTrial: boolean;
  checkUserQuota: (params: {
    tool?: Pick<ToolDefinition, 'id' | 'title' | 'isPro'>;
    files?: File[];
  }) => QuotaCheckResult;
  onQuotaBlocked: (result: QuotaCheckResult) => void;
  onQuotaConsumed: (toolId: ToolId, files: File[]) => Promise<void> | void;
  onFileProcessed: (entry: {
    fileName: string;
    toolId: ToolId;
    toolTitle: string;
    sizeFormatted: string;
  }) => void;
  onOpenPremium: () => void;
  onSendToImageToPdf: (files: File[]) => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode error'));
    img.src = src;
  });
}

async function compositeCutoutToPngBlob(
  cutoutUrl: string,
  bg: BgChoice
): Promise<Blob> {
  const img = await loadHtmlImage(cutoutUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  if (bg.kind === 'solid') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bg.kind === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, bg.from);
    grad.addColorStop(1, bg.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });
}

export function ImageBgRemover({
  tool,
  language = 'fr',
  initialFiles,
  onConsumeInitialFiles,
  isPremiumOrTrial,
  checkUserQuota,
  onQuotaBlocked,
  onQuotaConsumed,
  onFileProcessed,
  onOpenPremium,
  onSendToImageToPdf,
  onNotify,
}: ImageBgRemoverProps) {
  const lang = normalizeLang(language);
  const t = STUDIO_COPY[lang];
  const meta = getLocalizedToolMeta(tool, lang);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [progressStage, setProgressStage] = useState<'fetch' | 'infer'>('fetch');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedBgIdx, setSelectedBgIdx] = useState<number | 'custom'>(0);
  const [customColor, setCustomColor] = useState('#3B82F6');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runIdRef = useRef(0);

  const activeBg: BgChoice = useMemo(() => {
    if (selectedBgIdx === 'custom') {
      return { kind: 'solid', color: customColor, labelKey: 'bgCustom' };
    }
    return PRESET_BACKGROUNDS[selectedBgIdx] || PRESET_BACKGROUNDS[0];
  }, [selectedBgIdx, customColor]);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const runBackgroundRemoval = useCallback(
    async (file: File) => {
      const q = checkUserQuota({ tool, files: [file] });
      if (!q.allowed) {
        if (
          q.blockReasonCode === 'daily_limit' ||
          q.blockReasonCode === 'file_size_limit' ||
          q.blockReasonCode === 'batch_limit'
        ) {
          onNotify(q.reason || t.bg.networkErrorDesc, 'info');
          onOpenPremium();
        } else {
          onQuotaBlocked(q);
        }
        return;
      }

      const currentRun = ++runIdRef.current;
      setSourceFile(file);
      setErrorMsg(null);
      setIsProcessing(true);
      setProgressPct(6);
      setProgressStage('fetch');
      setShowOriginal(false);

      const nextOriginalUrl = URL.createObjectURL(file);
      setOriginalUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextOriginalUrl;
      });
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setResultBlob(null);

      try {
        const { removeBackground } = await import('@imgly/background-removal');
        const outBlob = await removeBackground(file, {
          model: 'isnet_quint8',
          output: {
            format: 'image/png',
            quality: 1,
          },
          progress: (key: string, current: number, total: number) => {
            if (runIdRef.current !== currentRun) return;
            const ratio = total > 0 ? Math.min(1, current / total) : 0;
            if (key.startsWith('fetch:')) {
              setProgressStage('fetch');
              setProgressPct(Math.max(8, Math.round(ratio * 65)));
            } else {
              setProgressStage('infer');
              setProgressPct(65 + Math.round(ratio * 34));
            }
          },
        });

        if (runIdRef.current !== currentRun) return;

        const outUrl = URL.createObjectURL(outBlob);
        setResultBlob(outBlob);
        setResultUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return outUrl;
        });
        setProgressPct(100);

        const outFileName = `${file.name.replace(/\.[^.]+$/, '')}_nobg.png`;
        await onQuotaConsumed(tool.id, [file]);
        onFileProcessed({
          fileName: outFileName,
          toolId: tool.id,
          toolTitle: meta.title,
          sizeFormatted: formatBytes(outBlob.size),
        });
        onNotify(t.bg.successToast, 'success');
      } catch (err) {
        if (runIdRef.current !== currentRun) return;
        console.error('Background removal error:', err);
        setErrorMsg(
          err instanceof Error && err.message
            ? err.message
            : t.bg.networkErrorDesc
        );
      } finally {
        if (runIdRef.current === currentRun) {
          setIsProcessing(false);
        }
      }
    },
    [
      checkUserQuota,
      tool,
      t,
      meta.title,
      onNotify,
      onOpenPremium,
      onQuotaBlocked,
      onQuotaConsumed,
      onFileProcessed,
    ]
  );

  const handleIncomingFiles = useCallback(
    (incoming: FileList | File[]) => {
      const imgs = Array.from(incoming).filter((f) =>
        /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) ||
        /\.(jpe?g|png|webp)$/i.test(f.name)
      );
      if (imgs.length === 0) return;

      if (imgs.length > 1 && !isPremiumOrTrial) {
        onNotify(t.bg.batchNote, 'info');
        onOpenPremium();
        return;
      }

      void runBackgroundRemoval(imgs[0]);
    },
    [isPremiumOrTrial, onNotify, onOpenPremium, runBackgroundRemoval, t.bg.batchNote]
  );

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const copy = [...initialFiles];
      onConsumeInitialFiles?.();
      handleIncomingFiles(copy);
    }
  }, [initialFiles, onConsumeInitialFiles, handleIncomingFiles]);

  const handleDownloadPng = async () => {
    if (!resultUrl || !sourceFile) return;
    try {
      const blob =
        activeBg.kind === 'transparent' && resultBlob
          ? resultBlob
          : await compositeCutoutToPngBlob(resultUrl, activeBg);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sourceFile.name.replace(/\.[^.]+$/, '')}_nobg.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify(t.bg.downloadToast, 'success');
    } catch {
      onNotify(t.bg.networkErrorDesc, 'error');
    }
  };

  const handleSendToPdf = async () => {
    if (!resultUrl || !sourceFile) return;
    try {
      const blob =
        activeBg.kind === 'transparent' && resultBlob
          ? resultBlob
          : await compositeCutoutToPngBlob(resultUrl, activeBg);
      const fileName = `${sourceFile.name.replace(/\.[^.]+$/, '')}_nobg.png`;
      const pngFile = new File([blob], fileName, { type: 'image/png' });
      onSendToImageToPdf([pngFile]);
    } catch {
      onNotify(t.bg.networkErrorDesc, 'error');
    }
  };

  const previewBackgroundStyle = useMemo<React.CSSProperties>(() => {
    if (showOriginal || activeBg.kind === 'transparent') return {};
    if (activeBg.kind === 'solid') return { backgroundColor: activeBg.color };
    return {
      backgroundImage: `linear-gradient(135deg, ${activeBg.from}, ${activeBg.to})`,
    };
  }, [showOriginal, activeBg]);

  return (
    <div className="space-y-6">
      {/* Hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleIncomingFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Initial Dropzone */}
      {!sourceFile && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) {
              handleIncomingFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`rounded-3xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all bg-white dark:bg-brand-cardDark ${
            isDragging
              ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 scale-[1.01]'
              : 'border-neutral-300 dark:border-brand-borderDark hover:border-teal-500'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4">
            <Eraser className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-white mb-2">
            {t.bg.dropTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {t.bg.dropHint}
          </p>
          <span className="inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors">
            <UploadCloud className="w-4 h-4" />
            <span>{meta.btnText}</span>
          </span>
        </div>
      )}

      {/* Workspace Active */}
      {sourceFile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Canvas Preview Area */}
          <div className="lg:col-span-8 bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {sourceFile.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {t.bg.originalLabel}: {formatBytes(sourceFile.size)}
                  {resultBlob ? ` · ${t.bg.resultLabel}: ${formatBytes(resultBlob.size)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {resultUrl && (
                  <button
                    type="button"
                    onClick={() => setShowOriginal((v) => !v)}
                    className="min-h-[44px] px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-teal-500 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showOriginal ? t.bg.showResult : t.bg.showOriginal}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-teal-500 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{t.bg.replaceImage}</span>
                </button>
              </div>
            </div>

            {/* Non-blocking progress bar */}
            {isProcessing && (
              <div className="rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-teal-800 dark:text-teal-200">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {progressStage === 'fetch' ? t.bg.loadingModel : t.bg.inferring}
                    </span>
                  </span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-teal-200/70 dark:bg-teal-900/60 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 rounded-full transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error state with Retry */}
            {errorMsg && !isProcessing && (
              <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 p-5 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-brand-red mx-auto" />
                <div>
                  <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                    {t.bg.networkErrorTitle}
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 max-w-md mx-auto">
                    {t.bg.networkErrorDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runBackgroundRemoval(sourceFile)}
                  className="min-h-[44px] px-5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t.bg.retry}</span>
                </button>
              </div>
            )}

            {/* Interactive Preview Surface */}
            {!errorMsg && (
              <div
                className={`relative w-full h-[320px] sm:h-[420px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-brand-borderDark flex items-center justify-center ${
                  showOriginal || activeBg.kind === 'transparent' ? 'checkerboard' : ''
                }`}
                style={previewBackgroundStyle}
              >
                {(showOriginal ? originalUrl : resultUrl || originalUrl) && (
                  <img
                    src={(showOriginal ? originalUrl : resultUrl || originalUrl) || ''}
                    alt={sourceFile.name}
                    className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${
                      isProcessing && !resultUrl ? 'opacity-50 blur-[1px]' : 'opacity-100'
                    }`}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Controls Panel */}
          <div className="lg:col-span-4 bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-5 space-y-5">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-teal-600" />
                <span>{t.bg.bgLabel}</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_BACKGROUNDS.map((bg, idx) => {
                  const selected = selectedBgIdx === idx;
                  const label =
                    bg.kind === 'transparent'
                      ? t.bg.bgTransparent
                      : t.bg[bg.labelKey];
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!resultUrl || isProcessing}
                      onClick={() => {
                        setShowOriginal(false);
                        setSelectedBgIdx(idx);
                      }}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 ${
                        selected
                          ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-teal-400'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md border border-neutral-300 dark:border-neutral-600 shrink-0 ${
                          bg.kind === 'transparent' ? 'checkerboard' : ''
                        }`}
                        style={
                          bg.kind === 'solid'
                            ? { backgroundColor: bg.color }
                            : bg.kind === 'gradient'
                            ? {
                                backgroundImage: `linear-gradient(135deg, ${bg.from}, ${bg.to})`,
                              }
                            : undefined
                        }
                      />
                      <span className="truncate">{label}</span>
                      {selected && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                    </button>
                  );
                })}

                {/* Custom Color Picker */}
                <label
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    !resultUrl || isProcessing ? 'opacity-50 pointer-events-none' : ''
                  } ${
                    selectedBgIdx === 'custom'
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-teal-400'
                  }`}
                >
                  <input
                    type="color"
                    value={customColor}
                    disabled={!resultUrl || isProcessing}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setShowOriginal(false);
                      setSelectedBgIdx('custom');
                    }}
                    className="w-5 h-5 rounded border-0 p-0 bg-transparent cursor-pointer shrink-0"
                  />
                  <span className="truncate">{t.bg.bgCustom}</span>
                  {selectedBgIdx === 'custom' && (
                    <Check className="w-3.5 h-3.5 ml-auto shrink-0" />
                  )}
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-brand-borderDark space-y-2.5">
              <button
                type="button"
                disabled={!resultUrl || isProcessing}
                onClick={() => void handleDownloadPng()}
                className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{t.bg.downloadPng}</span>
              </button>

              <button
                type="button"
                disabled={!resultUrl || isProcessing}
                onClick={() => void handleSendToPdf()}
                className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-brand-red hover:bg-red-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <FileOutput className="w-4 h-4 shrink-0" />
                <span>{t.bg.sendToPdf}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
