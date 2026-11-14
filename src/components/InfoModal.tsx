import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import type { SiteInfoPage, ToolId } from '../types/pdf';

interface InfoModalProps {
  page: SiteInfoPage | null;
  onClose: () => void;
  onSelectTool: (id: ToolId) => void;
}

export function InfoModal({ page, onClose, onSelectTool }: InfoModalProps) {
  if (!page) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-xs"
      />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark shadow-2xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-red mb-1">
              {page.section}
            </p>
            <h2
              id="info-modal-title"
              className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white"
            >
              {page.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-5">
          {page.subtitle}
        </p>

        <ul className="space-y-2.5 mb-6">
          {page.highlights.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-brand-borderDark">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Fermer
          </button>
          {page.ctaToolId && page.ctaLabel && (
            <button
              type="button"
              onClick={() => {
                const target = page.ctaToolId!;
                onClose();
                onSelectTool(target);
              }}
              className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-brand-redHover text-white text-sm font-bold inline-flex items-center gap-2 transition-colors"
            >
              <span>{page.ctaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
