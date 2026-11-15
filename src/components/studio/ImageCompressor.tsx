import { useCallback, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import {
  Archive,
  Crown,
  Download,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  STUDIO_COPY,
  getLocalizedToolMeta,
  normalizeLang,
} from '../../data/studioI18n';
import type { QuotaCheckResult, ToolDefinition, ToolId } from '../../types/pdf';
import { formatBytes } from '../../utils/pdfEngine';
import { BeforeAfterSlider } from './BeforeAfterSlider';

type OutputFormat = 'image/webp' | 'image/jpeg' | 'image/png';

interface CompressedItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  compressedBlob: Blob;
  compressedUrl: string;
  compressedName: string;
  savingsPct: number;
}

interface ImageCompressorProps {
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
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const FORMAT_EXT: Record<OutputFormat, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

async function compressViaCanvasAndLib(
  file: File,
  opts: {
    quality: number;
    format: OutputFormat;
    resizeEnabled: boolean;
    maxDimension: number;
  }
): Promise<Blob> {
  const qNorm = Math.max(0.1, Math.min(1, opts.quality / 100));

  try {
    const compressedFile = await imageCompression(file, {
      maxWidthOrHeight: opts.resizeEnabled
        ? Math.max(120, opts.maxDimension)
        : undefined,
      useWebWorker: true,
      initialQuality: qNorm,
      fileType: opts.format,
      alwaysKeepResolution: !opts.resizeEnabled,
      maxIteration: 4,
    });

    if (compressedFile.type === opts.format) {
      return compressedFile;
    }
  } catch {
    // Fall back cleanly to direct Canvas API re-encoding below
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = bitmapUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (opts.resizeEnabled && opts.maxDimension > 0) {
      const maxSide = Math.max(width, height);
      if (maxSide > opts.maxDimension) {
        const scale = opts.maxDimension / maxSide;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    if (opts.format === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas encode failed'));
        },
        opts.format,
        qNorm
      );
    });
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export function ImageCompressor({
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
  onNotify,
}: ImageCompressorProps) {
  const lang = normalizeLang(language);
  const t = STUDIO_COPY[lang];
  const meta = getLocalizedToolMeta(tool, lang);

  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [items, setItems] = useState<CompressedItem[]>([]);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<OutputFormat>('image/webp');
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [maxDimension, setMaxDimension] = useState(1920);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<CompressedItem[]>([]);
  itemsRef.current = items;
  const runIdRef = useRef(0);
  const quotaConsumedBatchKeyRef = useRef<string | null>(null);

  const revokeItems = useCallback((list: CompressedItem[]) => {
    list.forEach((it) => {
      URL.revokeObjectURL(it.originalUrl);
      URL.revokeObjectURL(it.compressedUrl);
    });
  }, []);

  useEffect(() => {
    return () => {
      revokeItems(itemsRef.current);
    };
  }, [revokeItems]);

  const processFiles = useCallback(
    async (
      filesToRun: File[],
      opts: {
        quality: number;
        format: OutputFormat;
        resizeEnabled: boolean;
        maxDimension: number;
      },
      batchKey: string
    ) => {
      if (filesToRun.length === 0) return;
      const currentRun = ++runIdRef.current;
      setIsCompressing(true);
      setProgressPct(10);

      const nextItems: CompressedItem[] = [];
      try {
        for (let i = 0; i < filesToRun.length; i++) {
          const f = filesToRun[i];
          const outBlob = await compressViaCanvasAndLib(f, opts);
          if (runIdRef.current !== currentRun) {
            revokeItems(nextItems);
            return;
          }

          const origUrl = URL.createObjectURL(f);
          const compUrl = URL.createObjectURL(outBlob);
          const baseName = f.name.replace(/\.[^.]+$/, '');
          const ext = FORMAT_EXT[opts.format];
          const savingsPct =
            f.size > 0
              ? Math.round(((f.size - outBlob.size) / f.size) * 100)
              : 0;

          nextItems.push({
            id: `${f.name}-${f.size}-${i}`,
            originalFile: f,
            originalUrl: origUrl,
            compressedBlob: outBlob,
            compressedUrl: compUrl,
            compressedName: `${baseName}.${ext}`,
            savingsPct,
          });

          setProgressPct(
            Math.round(((i + 1) / filesToRun.length) * 100)
          );
        }

        if (runIdRef.current !== currentRun) {
          revokeItems(nextItems);
          return;
        }

        revokeItems(itemsRef.current);
        setItems(nextItems);

        if (quotaConsumedBatchKeyRef.current !== batchKey) {
          quotaConsumedBatchKeyRef.current = batchKey;
          await onQuotaConsumed(tool.id, filesToRun);
          const totalCompressedSize = nextItems.reduce(
            (sum, it) => sum + it.compressedBlob.size,
            0
          );
          onFileProcessed({
            fileName:
              nextItems.length === 1
                ? nextItems[0].compressedName
                : `${nextItems.length} images (${FORMAT_EXT[opts.format].toUpperCase()})`,
            toolId: tool.id,
            toolTitle: meta.title,
            sizeFormatted: formatBytes(totalCompressedSize),
          });
          onNotify(
            nextItems.length === 1
              ? t.compress.singleSuccessToast
              : t.compress.batchSuccessToast(nextItems.length),
            'success'
          );
        }
      } catch (err) {
        console.error('Image compression error:', err);
        revokeItems(nextItems);
        onNotify(
          err instanceof Error ? err.message : 'Compression error',
          'error'
        );
      } finally {
        if (runIdRef.current === currentRun) {
          setIsCompressing(false);
        }
      }
    },
    [
      meta.title,
      onFileProcessed,
      onNotify,
      onQuotaConsumed,
      revokeItems,
      t.compress,
      tool.id,
    ]
  );

  const handleIncomingFiles = useCallback(
    (incoming: FileList | File[], append = false) => {
      const imgs = Array.from(incoming).filter(
        (f) =>
          /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) ||
          /\.(jpe?g|png|webp)$/i.test(f.name)
      );
      if (imgs.length === 0) return;

      const combined = append ? [...sourceFiles, ...imgs] : imgs;
      if (combined.length > 1 && !isPremiumOrTrial) {
        onNotify(t.compress.batchLockedMsg, 'info');
        onOpenPremium();
        return;
      }

      const q = checkUserQuota({ tool, files: combined });
      if (!q.allowed) {
        if (
          q.blockReasonCode === 'daily_limit' ||
          q.blockReasonCode === 'file_size_limit' ||
          q.blockReasonCode === 'batch_limit'
        ) {
          onNotify(q.reason || t.compress.batchLockedMsg, 'info');
          onOpenPremium();
        } else {
          onQuotaBlocked(q);
        }
        return;
      }

      const batchKey = combined.map((f) => `${f.name}:${f.size}`).join('|');
      setSourceFiles(combined);
      void processFiles(
        combined,
        { quality, format, resizeEnabled, maxDimension },
        batchKey
      );
    },
    [
      sourceFiles,
      isPremiumOrTrial,
      checkUserQuota,
      tool,
      onNotify,
      onOpenPremium,
      onQuotaBlocked,
      processFiles,
      quality,
      format,
      resizeEnabled,
      maxDimension,
      t.compress.batchLockedMsg,
    ]
  );

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const copy = [...initialFiles];
      onConsumeInitialFiles?.();
      handleIncomingFiles(copy, false);
    }
  }, [initialFiles, onConsumeInitialFiles, handleIncomingFiles]);

  const handleReapply = () => {
    if (sourceFiles.length === 0) return;
    const batchKey =
      quotaConsumedBatchKeyRef.current ||
      sourceFiles.map((f) => `${f.name}:${f.size}`).join('|');
    void processFiles(
      sourceFiles,
      { quality, format, resizeEnabled, maxDimension },
      batchKey
    );
  };

  const handleDownloadItem = (item: CompressedItem) => {
    const a = document.createElement('a');
    a.href = item.compressedUrl;
    a.download = item.compressedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadZip = async () => {
    if (items.length === 0) return;
    const zip = new JSZip();
    items.forEach((it) => {
      zip.file(it.compressedName, it.compressedBlob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PDFExpress_Images_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReset = () => {
    revokeItems(items);
    setItems([]);
    setSourceFiles([]);
    quotaConsumedBatchKeyRef.current = null;
  };

  const totalOrigBytes = items.reduce((s, it) => s + it.originalFile.size, 0);
  const totalCompBytes = items.reduce((s, it) => s + it.compressedBlob.size, 0);
  const totalSavedPct =
    totalOrigBytes > 0
      ? Math.round(((totalOrigBytes - totalCompBytes) / totalOrigBytes) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleIncomingFiles(e.target.files, sourceFiles.length > 0);
          }
          e.target.value = '';
        }}
      />

      {sourceFiles.length === 0 && (
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
              handleIncomingFiles(e.dataTransfer.files, false);
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
              ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/30 scale-[1.01]'
              : 'border-neutral-300 dark:border-brand-borderDark hover:border-cyan-500'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-4">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-white mb-2">
            {t.compress.dropTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {t.compress.dropHint}
          </p>
          <span className="inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold transition-colors">
            <UploadCloud className="w-4 h-4" />
            <span>{meta.btnText}</span>
          </span>
        </div>
      )}

      {sourceFiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Preview / List Area */}
          <div className="lg:col-span-8 bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Live Size Comparison Badge */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 tabular-nums">
                  {t.compress.originalSize}: {formatBytes(totalOrigBytes)}
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-xs font-bold text-cyan-700 dark:text-cyan-300 tabular-nums">
                  {t.compress.compressedSize}: {formatBytes(totalCompBytes)}
                </div>
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold tabular-nums ${
                    totalSavedPct > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {totalSavedPct >= 0 ? `-${totalSavedPct}%` : `+${Math.abs(totalSavedPct)}%`}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isPremiumOrTrial) {
                      onNotify(t.compress.batchLockedMsg, 'info');
                      onOpenPremium();
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  className="min-h-[44px] px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-cyan-500 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {!isPremiumOrTrial && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.compress.addMoreFiles}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="min-h-[44px] px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red hover:border-brand-red inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.compress.clearFiles}</span>
                </button>
              </div>
            </div>

            {isCompressing && (
              <div className="rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-800 dark:text-cyan-200">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.compress.compressing}</span>
                  </span>
                  <span className="tabular-nums">{progressPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-cyan-200/70 dark:bg-cyan-900/60 overflow-hidden">
                  <div
                    className="h-full bg-cyan-600 rounded-full transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Single-image split slider */}
            {items.length === 1 && (
              <BeforeAfterSlider
                beforeSrc={items[0].originalUrl}
                afterSrc={items[0].compressedUrl}
                beforeLabel={t.compress.beforeLabel}
                afterLabel={t.compress.afterLabel}
                beforeMeta={formatBytes(items[0].originalFile.size)}
                afterMeta={formatBytes(items[0].compressedBlob.size)}
                hint={t.compress.sliderHint}
              />
            )}

            {/* Batch list for multiple images */}
            {items.length > 1 && (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={it.compressedUrl}
                        alt={it.compressedName}
                        className="w-12 h-12 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                          {it.compressedName}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                          {formatBytes(it.originalFile.size)} →{' '}
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">
                            {formatBytes(it.compressedBlob.size)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold tabular-nums ${
                          it.savingsPct > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {it.savingsPct >= 0 ? `-${it.savingsPct}%` : `+${Math.abs(it.savingsPct)}%`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadItem(it)}
                        aria-label={it.compressedName}
                        className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-cyan-500 text-neutral-700 dark:text-neutral-200 flex items-center justify-center"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Settings Panel */}
          <div className="lg:col-span-4 bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-5 space-y-5">
            {/* Quality Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="img-quality-range"
                  className="text-xs font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300"
                >
                  {t.compress.qualityLabel}
                </label>
                <span className="text-sm font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {quality}%
                </span>
              </div>
              <input
                id="img-quality-range"
                type="range"
                min={10}
                max={100}
                step={5}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-3 accent-cyan-600 cursor-pointer"
              />
            </div>

            {/* Output Format */}
            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                {t.compress.formatLabel}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'image/webp', label: 'WebP' },
                    { id: 'image/jpeg', label: 'JPEG' },
                    { id: 'image/png', label: 'PNG' },
                  ] as const
                ).map((fmt) => {
                  const active = format === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setFormat(fmt.id)}
                      className={`min-h-[44px] rounded-xl border text-xs font-extrabold transition-colors ${
                        active
                          ? 'border-cyan-600 bg-cyan-600 text-white'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-cyan-500'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resize Toggle */}
            <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <label className="flex items-center justify-between gap-3 cursor-pointer min-h-[44px]">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  {t.compress.resizeToggle}
                </span>
                <input
                  type="checkbox"
                  checked={resizeEnabled}
                  onChange={(e) => setResizeEnabled(e.target.checked)}
                  className="w-5 h-5 accent-cyan-600 rounded"
                />
              </label>

              {resizeEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">
                      {t.compress.maxDimLabel}
                    </span>
                    <input
                      type="number"
                      min={200}
                      max={8000}
                      step={100}
                      value={maxDimension}
                      onChange={(e) =>
                        setMaxDimension(Math.max(200, Number(e.target.value) || 1920))
                      }
                      className="w-24 min-h-[38px] px-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-right tabular-nums outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1280, 1920, 2560].map((dim) => (
                      <button
                        key={dim}
                        type="button"
                        onClick={() => setMaxDimension(dim)}
                        className={`min-h-[36px] rounded-lg text-[11px] font-bold border tabular-nums ${
                          maxDimension === dim
                            ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300'
                            : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {dim}px
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isCompressing}
              onClick={handleReapply}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isCompressing ? 'animate-spin' : ''}`}
              />
              <span>{t.compress.applyBtn}</span>
            </button>

            <div className="pt-3 border-t border-neutral-200 dark:border-brand-borderDark">
              {items.length === 1 ? (
                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={() => handleDownloadItem(items[0])}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{t.compress.downloadSingle}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCompressing || items.length === 0}
                  onClick={() => void handleDownloadZip()}
                  className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Archive className="w-4 h-4 shrink-0" />
                  <span>{t.compress.downloadZip}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
