import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createWorker } from 'tesseract.js';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Languages,
  RefreshCw,
  ScanSearch,
  UploadCloud,
} from 'lucide-react';
import {
  STUDIO_COPY,
  getLocalizedToolMeta,
  normalizeLang,
} from '../../data/studioI18n';
import type { QuotaCheckResult, ToolDefinition, ToolId } from '../../types/pdf';
import {
  formatBytes,
  loadPdfJsDocument,
  renderPdfPageToDataURL,
} from '../../utils/pdfEngine';

type OcrLangCode = 'ara' | 'fra' | 'eng' | 'ara+fra+eng';

interface PageInput {
  imageDataUrl: string;
  tesseractPdfBytes: number[] | null;
}

interface OcrExtractorProps {
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
  onSaveToGoogleDocs?: (payload: { title: string; content: string }) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export function OcrExtractor({
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
  onSaveToGoogleDocs,
}: OcrExtractorProps) {
  const lang = normalizeLang(language);
  const t = STUDIO_COPY[lang];
  const meta = getLocalizedToolMeta(tool, lang);

  const [ocrLang, setOcrLang] = useState<OcrLangCode>(
    lang === 'ar' ? 'ara' : lang === 'en' ? 'eng' : 'fra'
  );
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInput[]>([]);
  const [extractedText, setExtractedText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusLabel, setStatusLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const runIdRef = useRef(0);

  const runOcrPipeline = useCallback(
    async (file: File, targetOcrLang: OcrLangCode) => {
      const q = checkUserQuota({ tool, files: [file] });
      if (!q.allowed) {
        if (
          q.blockReasonCode === 'daily_limit' ||
          q.blockReasonCode === 'file_size_limit' ||
          q.blockReasonCode === 'batch_limit'
        ) {
          onNotify(q.reason || t.ocr.networkErrorDesc, 'info');
          onOpenPremium();
        } else {
          onQuotaBlocked(q);
        }
        return;
      }

      const currentRun = ++runIdRef.current;
      setSourceFile(file);
      setIsRunning(true);
      setErrorMsg(null);
      setProgressPct(4);
      setStatusLabel(t.ocr.loadingLangData);
      setExtractedText('');

      let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

      try {
        const renderedPages: string[] = [];
        const isPdf =
          file.type === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const buf = await file.arrayBuffer();
          const pdfJsDoc = await loadPdfJsDocument(buf);
          const totalPages = pdfJsDoc.numPages;
          for (let p = 1; p <= totalPages; p++) {
            if (runIdRef.current !== currentRun) return;
            setStatusLabel(t.ocr.preparingPdf(p, totalPages));
            setProgressPct(Math.round((p / totalPages) * 18));
            const dataUrl = await renderPdfPageToDataURL(
              pdfJsDoc,
              p,
              2.0,
              'image/png'
            );
            renderedPages.push(dataUrl);
          }
        } else {
          renderedPages.push(await readAsDataUrl(file));
        }

        if (runIdRef.current !== currentRun) return;

        let activePageIdx = 0;
        const totalPageCount = renderedPages.length;
        setStatusLabel(t.ocr.loadingLangData);

        worker = await createWorker(targetOcrLang, 1, {
          logger: (msg) => {
            if (runIdRef.current !== currentRun) return;
            if (msg.status === 'recognizing text') {
              const base = 20 + (activePageIdx / totalPageCount) * 80;
              const slice = (1 / totalPageCount) * 80;
              setProgressPct(
                Math.min(99, Math.round(base + (msg.progress || 0) * slice))
              );
            } else if (
              msg.status === 'loading language traineddata' ||
              msg.status === 'initializing tesseract'
            ) {
              setStatusLabel(t.ocr.loadingLangData);
            }
          },
        });

        const pageOutputs: PageInput[] = [];
        const textChunks: string[] = [];

        for (let i = 0; i < totalPageCount; i++) {
          if (runIdRef.current !== currentRun) return;
          activePageIdx = i;
          setStatusLabel(t.ocr.recognizingPage(i + 1, totalPageCount));

          const res = await worker.recognize(
            renderedPages[i],
            { pdfTitle: file.name.replace(/\.[^.]+$/, '') },
            { text: true, pdf: true }
          );

          const pageText = (res.data.text || '').trim();
          pageOutputs.push({
            imageDataUrl: renderedPages[i],
            tesseractPdfBytes: res.data.pdf || null,
          });
          if (totalPageCount > 1) {
            textChunks.push(`--- Page ${i + 1} ---\n${pageText}`);
          } else {
            textChunks.push(pageText);
          }
        }

        if (runIdRef.current !== currentRun) return;

        const combinedText = textChunks.join('\n\n').trim();
        setPages(pageOutputs);
        setExtractedText(combinedText);
        setProgressPct(100);

        if (!combinedText) {
          onNotify(t.ocr.noTextWarning, 'info');
        }

        await onQuotaConsumed(tool.id, [file]);
        onFileProcessed({
          fileName: `${file.name.replace(/\.[^.]+$/, '')}_ocr.txt`,
          toolId: tool.id,
          toolTitle: meta.title,
          sizeFormatted: formatBytes(new Blob([combinedText]).size),
        });
      } catch (err) {
        if (runIdRef.current !== currentRun) return;
        console.error('OCR extraction error:', err);
        setErrorMsg(
          err instanceof Error && err.message
            ? err.message
            : t.ocr.networkErrorDesc
        );
      } finally {
        if (worker) {
          try {
            await worker.terminate();
          } catch {
            // Ignore termination cleanup error
          }
        }
        if (runIdRef.current === currentRun) {
          setIsRunning(false);
        }
      }
    },
    [
      checkUserQuota,
      tool,
      t.ocr,
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
      const valid = Array.from(incoming).filter(
        (f) =>
          f.type === 'application/pdf' ||
          /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) ||
          /\.(pdf|jpe?g|png|webp)$/i.test(f.name)
      );
      if (valid.length === 0) return;

      if (valid.length > 1 && !isPremiumOrTrial) {
        onNotify(t.bg.batchNote, 'info');
        onOpenPremium();
        return;
      }

      void runOcrPipeline(valid[0], ocrLang);
    },
    [isPremiumOrTrial, ocrLang, onNotify, onOpenPremium, runOcrPipeline, t.bg.batchNote]
  );

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const copy = [...initialFiles];
      onConsumeInitialFiles?.();
      handleIncomingFiles(copy);
    }
  }, [initialFiles, onConsumeInitialFiles, handleIncomingFiles]);

  const isRtlText = useMemo(() => {
    if (/[\u0600-\u06FF]/.test(extractedText)) return true;
    return extractedText.trim().length === 0 && ocrLang.startsWith('ara');
  }, [extractedText, ocrLang]);

  const handleCopyText = async () => {
    if (!extractedText.trim()) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      onNotify(t.ocr.copiedToast, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('Clipboard unavailable', 'error');
    }
  };

  const handleDownloadTxt = () => {
    if (!sourceFile) return;
    const blob = new Blob(['\uFEFF' + extractedText], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sourceFile.name.replace(/\.[^.]+$/, '')}_ocr.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportSearchablePdf = async () => {
    if (!sourceFile || pages.length === 0) return;
    setIsExportingPdf(true);
    try {
      const mergedPdf = await PDFDocument.create();
      let usedNativeTesseractPages = false;

      for (const page of pages) {
        if (page.tesseractPdfBytes && page.tesseractPdfBytes.length > 0) {
          try {
            const singleDoc = await PDFDocument.load(
              new Uint8Array(page.tesseractPdfBytes)
            );
            const copiedPages = await mergedPdf.copyPages(
              singleDoc,
              singleDoc.getPageIndices()
            );
            copiedPages.forEach((cp) => mergedPdf.addPage(cp));
            usedNativeTesseractPages = true;
            continue;
          } catch {
            // Fall back to pdf-lib embedding for this page
          }
        }

        const resp = await fetch(page.imageDataUrl);
        const imgBytes = await resp.arrayBuffer();
        const embeddedImg = page.imageDataUrl.includes('image/jpeg')
          ? await mergedPdf.embedJpg(imgBytes)
          : await mergedPdf.embedPng(imgBytes);
        const pdfPage = mergedPdf.addPage([
          embeddedImg.width,
          embeddedImg.height,
        ]);
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const safeText = extractedText
          .replace(/[^\x20-\xFF\n]/g, ' ')
          .slice(0, 4000);
        if (safeText.trim()) {
          pdfPage.drawText(safeText, {
            x: 24,
            y: Math.max(40, embeddedImg.height - 40),
            size: 10,
            font,
            color: rgb(0, 0, 0),
            opacity: 0.01,
          });
        }
        pdfPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height,
        });
      }

      if (!usedNativeTesseractPages && mergedPdf.getPageCount() === 0) {
        mergedPdf.addPage([595.28, 841.89]);
      }

      const bytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(bytes)], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sourceFile.name.replace(/\.[^.]+$/, '')}_searchable.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify(t.ocr.searchablePdfToast, 'success');
    } catch (err) {
      console.error('Searchable PDF export error:', err);
      onNotify(
        err instanceof Error ? err.message : 'Export PDF failed',
        'error'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleIncomingFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Language Selector Bar */}
      <div className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
          <Languages className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
          <span>{t.ocr.langLabel}</span>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {(
            ['ara', 'fra', 'eng', 'ara+fra+eng'] as OcrLangCode[]
          ).map((code) => {
            const active = ocrLang === code;
            return (
              <button
                key={code}
                type="button"
                disabled={isRunning}
                onClick={() => setOcrLang(code)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors whitespace-nowrap disabled:opacity-50 ${
                  active
                    ? 'border-fuchsia-600 bg-fuchsia-600 text-white'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-fuchsia-500'
                }`}
              >
                {t.ocr.langs[code]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dropzone */}
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
              ? 'border-fuchsia-500 bg-fuchsia-50/60 dark:bg-fuchsia-950/30 scale-[1.01]'
              : 'border-neutral-300 dark:border-brand-borderDark hover:border-fuchsia-500'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center mx-auto mb-4">
            <ScanSearch className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-white mb-2">
            {t.ocr.dropTitle}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {t.ocr.dropHint}
          </p>
          <span className="inline-flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-bold transition-colors">
            <UploadCloud className="w-4 h-4" />
            <span>{meta.btnText}</span>
          </span>
        </div>
      )}

      {/* Results & Editor */}
      {sourceFile && (
        <div className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                {sourceFile.name}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                {formatBytes(sourceFile.size)}
                {pages.length > 0 ? ` · ${t.ocr.pageCountInfo(pages.length)}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => void runOcrPipeline(sourceFile, ocrLang)}
                className="min-h-[44px] px-4 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`}
                />
                <span>{isRunning ? t.ocr.rerunning : t.ocr.startBtn}</span>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-fuchsia-500 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{t.ocr.changeFile}</span>
              </button>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/30 border border-fuchsia-200 dark:border-fuchsia-900/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-fuchsia-800 dark:text-fuchsia-200">
                <span className="flex items-center gap-2 truncate">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">{statusLabel}</span>
                </span>
                <span className="tabular-nums shrink-0">{progressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-fuchsia-200/70 dark:bg-fuchsia-900/60 overflow-hidden">
                <div
                  className="h-full bg-fuchsia-600 rounded-full transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Error + Retry */}
          {errorMsg && !isRunning && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 p-5 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-brand-red mx-auto" />
              <div>
                <p className="text-sm font-extrabold text-neutral-900 dark:text-white">
                  {t.ocr.networkErrorTitle}
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 max-w-md mx-auto">
                  {t.ocr.networkErrorDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runOcrPipeline(sourceFile, ocrLang)}
                className="min-h-[44px] px-5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t.ocr.retry}</span>
              </button>
            </div>
          )}

          {/* Output Editor + Page Thumbnails */}
          {!errorMsg && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {pages.length > 0 && (
                <div className="lg:col-span-4 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {pages.map((p, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
                    >
                      <img
                        src={p.imageDataUrl}
                        alt={`Page ${idx + 1}`}
                        className="w-full h-auto object-contain max-h-60"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div
                className={
                  pages.length > 0 ? 'lg:col-span-8 space-y-3' : 'lg:col-span-12 space-y-3'
                }
              >
                <label
                  htmlFor="ocr-output-textarea"
                  className="block text-xs font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                >
                  {t.ocr.outputLabel}
                </label>
                <textarea
                  id="ocr-output-textarea"
                  dir={isRtlText ? 'rtl' : 'ltr'}
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  placeholder={t.ocr.outputPlaceholder}
                  rows={12}
                  className={`w-full rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/70 p-4 text-sm leading-relaxed text-neutral-900 dark:text-neutral-100 outline-none focus:border-fuchsia-500 resize-y ${
                    isRtlText ? 'text-right' : 'text-left'
                  }`}
                />

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={!extractedText.trim() || isRunning}
                    onClick={() => void handleCopyText()}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{t.ocr.copyText}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!extractedText.trim() || isRunning}
                    onClick={handleDownloadTxt}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-xs font-bold inline-flex items-center gap-2 hover:border-fuchsia-500 disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{t.ocr.downloadTxt}</span>
                  </button>

                  <button
                    type="button"
                    disabled={pages.length === 0 || isRunning || isExportingPdf}
                    onClick={() => void handleExportSearchablePdf()}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isExportingPdf
                        ? t.ocr.exportingPdf
                        : t.ocr.exportSearchablePdf}
                    </span>
                  </button>

                  {onSaveToGoogleDocs && (
                    <button
                      type="button"
                      disabled={!extractedText.trim() || isRunning}
                      onClick={() =>
                        onSaveToGoogleDocs({
                          title: `${sourceFile.name.replace(/\.[^.]+$/, '')} (OCR)`,
                          content: extractedText,
                        })
                      }
                      className="min-h-[44px] px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{t.ocr.saveToGoogleDocs}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
