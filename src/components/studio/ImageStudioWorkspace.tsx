import { ArrowLeft, Crown, Lock, Sparkles } from 'lucide-react';
import {
  STUDIO_COPY,
  getLocalizedToolMeta,
  normalizeLang,
} from '../../data/studioI18n';
import type { QuotaCheckResult, ToolDefinition, ToolId } from '../../types/pdf';
import { getAdSenseSlotId } from '../../utils/adsense';
import { AdSenseBanner } from '../AdSenseBanner';
import { ToolIcon } from '../ToolIcon';
import { ImageBgRemover } from './ImageBgRemover';
import { ImageCompressor } from './ImageCompressor';
import { OcrExtractor } from './OcrExtractor';

interface ImageStudioWorkspaceProps {
  tool: ToolDefinition;
  language?: string;
  droppedFiles: File[] | null;
  onConsumeDroppedFiles: () => void;
  onGoHome: () => void;
  onSelectTool: (id: ToolId) => void;
  onSendToImageToPdf: (files: File[]) => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onFileProcessed: (entry: {
    fileName: string;
    toolId: ToolId;
    toolTitle: string;
    sizeFormatted: string;
  }) => void;
  isPremiumOrTrial: boolean;
  isAdFree?: boolean;
  remainingTasks?: number | null;
  dailyLimit?: number | null;
  checkUserQuota: (params: {
    tool?: Pick<ToolDefinition, 'id' | 'title' | 'isPro'>;
    files?: File[];
  }) => QuotaCheckResult;
  onQuotaBlocked: (result: QuotaCheckResult) => void;
  onQuotaConsumed: (toolId: ToolId, files: File[]) => Promise<void> | void;
  onOpenPremium: () => void;
  onOpenPricing?: () => void;
  onSaveToGoogleDocs?: (payload: { title: string; content: string }) => void;
}

export function ImageStudioWorkspace({
  tool,
  language = 'fr',
  droppedFiles,
  onConsumeDroppedFiles,
  onGoHome,
  onSelectTool,
  onSendToImageToPdf,
  onNotify,
  onFileProcessed,
  isPremiumOrTrial,
  isAdFree,
  remainingTasks = null,
  dailyLimit = null,
  checkUserQuota,
  onQuotaBlocked,
  onQuotaConsumed,
  onOpenPremium,
  onOpenPricing,
  onSaveToGoogleDocs,
}: ImageStudioWorkspaceProps) {
  const lang = normalizeLang(language);
  const t = STUDIO_COPY[lang];
  const meta = getLocalizedToolMeta(tool, lang);
  const effectiveAdFree = isAdFree ?? isPremiumOrTrial;

  const studioTabs: { id: ToolId; label: string }[] = [
    { id: 'img_bg_remove', label: t.tabBgRemove },
    { id: 'img_compress', label: t.tabCompress },
    { id: 'ocr_extract', label: t.tabOcr },
    { id: 'jpg2pdf', label: t.tabImgToPdf },
  ];

  return (
    <main className="flex-grow w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Bar: Back + Privacy Badge + Quota */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onGoHome}
          className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-brand-red hover:text-brand-red inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>{t.backHome}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>{t.privacyBadge}</span>
          </div>

          {isPremiumOrTrial ? (
            <span className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-400/90 text-neutral-900 text-xs font-extrabold inline-flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>{t.unlimitedPlan}</span>
            </span>
          ) : (
            dailyLimit !== null &&
            remainingTasks !== null && (
              <button
                type="button"
                onClick={onOpenPremium}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold hover:border-amber-400 tabular-nums"
              >
                {t.remainingTasks(remainingTasks, dailyLimit)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Studio Header & Tool Switcher Tabs */}
      <div className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl ${tool.badge} flex items-center justify-center shrink-0`}
            >
              <ToolIcon name={tool.icon} className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-red" />
                <span>{meta.catLabel}</span>
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white mt-0.5">
                {meta.title}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {meta.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Switcher tabs across the Studio tools */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-neutral-100 dark:border-brand-borderDark">
          {studioTabs.map((tab) => {
            const active = tool.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTool(tab.id)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Studio Tool */}
      {tool.id === 'img_bg_remove' && (
        <ImageBgRemover
          tool={tool}
          language={lang}
          initialFiles={droppedFiles}
          onConsumeInitialFiles={onConsumeDroppedFiles}
          isPremiumOrTrial={isPremiumOrTrial}
          checkUserQuota={checkUserQuota}
          onQuotaBlocked={onQuotaBlocked}
          onQuotaConsumed={onQuotaConsumed}
          onFileProcessed={onFileProcessed}
          onOpenPremium={onOpenPremium}
          onSendToImageToPdf={onSendToImageToPdf}
          onNotify={onNotify}
        />
      )}

      {tool.id === 'img_compress' && (
        <ImageCompressor
          tool={tool}
          language={lang}
          initialFiles={droppedFiles}
          onConsumeInitialFiles={onConsumeDroppedFiles}
          isPremiumOrTrial={isPremiumOrTrial}
          checkUserQuota={checkUserQuota}
          onQuotaBlocked={onQuotaBlocked}
          onQuotaConsumed={onQuotaConsumed}
          onFileProcessed={onFileProcessed}
          onOpenPremium={onOpenPremium}
          onNotify={onNotify}
        />
      )}

      {tool.id === 'ocr_extract' && (
        <OcrExtractor
          tool={tool}
          language={lang}
          initialFiles={droppedFiles}
          onConsumeInitialFiles={onConsumeDroppedFiles}
          isPremiumOrTrial={isPremiumOrTrial}
          checkUserQuota={checkUserQuota}
          onQuotaBlocked={onQuotaBlocked}
          onQuotaConsumed={onQuotaConsumed}
          onFileProcessed={onFileProcessed}
          onOpenPremium={onOpenPremium}
          onNotify={onNotify}
          onSaveToGoogleDocs={onSaveToGoogleDocs}
        />
      )}

      {!effectiveAdFree && getAdSenseSlotId('workspace') && (
        <AdSenseBanner
          placement="workspace"
          isAdFree={effectiveAdFree}
          onUpgradeClick={onOpenPricing || onOpenPremium}
        />
      )}
    </main>
  );
}
