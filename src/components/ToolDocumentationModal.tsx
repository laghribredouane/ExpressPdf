import { useState, useMemo } from 'react';
import { X, Search, BookOpen, CheckCircle, Sparkles, ArrowRight, Download } from 'lucide-react';
import { TOOL_DOCUMENTATIONS, type ToolDocumentationItem } from '../data/toolDocumentation';
import { TOOLS } from '../data/tools';
import type { ToolId } from '../types/pdf';
import { ToolIcon } from './ToolIcon';
import { createFormattedTextPdf } from '../utils/pdfEngine';

interface ToolDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (toolId: ToolId) => void;
  initialToolId?: ToolId | null;
}

export function ToolDocumentationModal({
  isOpen,
  onClose,
  onSelectTool,
  initialToolId,
}: ToolDocumentationModalProps) {
  const [search, setSearch] = useState('');
  const [selectedToolId, setSelectedToolId] = useState<ToolId>(
    initialToolId || 'merge'
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const allItems = useMemo(() => Object.values(TOOL_DOCUMENTATIONS), []);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
    );
  }, [allItems, search]);

  const activeDoc: ToolDocumentationItem =
    TOOL_DOCUMENTATIONS[selectedToolId] || TOOL_DOCUMENTATIONS['merge'];

  const toolDef = TOOLS.find((t) => t.id === selectedToolId);

  const handleDownloadDocumentationPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      let docText = 'PDFEXPRESS - DOCUMENTATION OFFICIELLE DES 34 OUTILS\n';
      docText += 'Guide complet d’utilisation, étapes et conseils d’experts.\n\n';

      for (const item of Object.values(TOOL_DOCUMENTATIONS)) {
        docText += `==================================================\n`;
        docText += `OUTIL : ${item.title} (${item.category})\n`;
        docText += `==================================================\n`;
        docText += `Objectif : ${item.summary}\n\n`;
        docText += `Étapes d'utilisation :\n`;
        item.steps.forEach((s, i) => {
          docText += `  ${i + 1}. ${s}\n`;
        });
        if (item.options.length > 0) {
          docText += `\nOptions :\n`;
          item.options.forEach((opt) => {
            docText += `  - ${opt.name} : ${opt.description}\n`;
          });
        }
        if (item.proTips.length > 0) {
          docText += `\nAstuces Pro :\n`;
          item.proTips.forEach((tip) => {
            docText += `  * ${tip}\n`;
          });
        }
        docText += `\n\n`;
      }

      const pdfDoc = await createFormattedTextPdf(
        docText,
        'PDFExpress - Documentation Officielle des 34 Outils'
      );
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PDFExpress_Documentation_34_Outils.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur lors de la génération du PDF de documentation:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-brand-cardDark w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl border border-neutral-200 dark:border-brand-borderDark flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-brand-borderDark flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">
                Documentation d’utilisation des outils
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Guide détaillé, étapes et conseils pour les 34 outils PDFExpress
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadDocumentationPdf}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold inline-flex items-center gap-2 hover:bg-brand-red dark:hover:bg-brand-red dark:hover:text-white transition-colors shadow-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Génération...' : 'Télécharger le PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar / Tool List */}
          <div className="w-full md:w-80 border-r border-neutral-200 dark:border-brand-borderDark flex flex-col bg-neutral-50/50 dark:bg-neutral-900/30">
            <div className="p-3 border-b border-neutral-200 dark:border-brand-borderDark">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un outil..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-1">
              {filteredItems.map((item) => {
                const isSelected = item.toolId === selectedToolId;
                const def = TOOLS.find((t) => t.id === item.toolId);
                return (
                  <button
                    key={item.toolId}
                    type="button"
                    onClick={() => setSelectedToolId(item.toolId)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-brand-red text-white shadow-md font-bold'
                        : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium'
                    }`}
                  >
                    {def && (
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : def.badge
                        }`}
                      >
                        <ToolIcon name={def.icon} className="w-4 h-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-grow">
                      <div className="text-xs truncate">{item.title}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-white/80' : 'text-neutral-400'
                        }`}
                      >
                        {item.category}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-xs text-neutral-400">
                  Aucun outil trouvé
                </div>
              )}
            </div>
          </div>

          {/* Main Documentation Details */}
          <div className="flex-grow overflow-y-auto p-6 sm:p-8 bg-white dark:bg-brand-cardDark flex flex-col justify-between">
            <div className="space-y-6">
              {/* Tool Header Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-brand-borderDark">
                <div className="flex items-center gap-4">
                  {toolDef && (
                    <div
                      className={`w-14 h-14 rounded-2xl ${toolDef.color} text-white flex items-center justify-center shadow-lg`}
                    >
                      <ToolIcon name={toolDef.icon} className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 mb-1">
                      {activeDoc.category}
                    </span>
                    <h3 className="text-2xl font-black text-neutral-900 dark:text-white">
                      {activeDoc.title}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectTool(selectedToolId);
                    onClose();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-md transition-colors"
                >
                  <span>Lancer l’outil</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Objectif
                </h4>
                <p className="text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                  {activeDoc.summary}
                </p>
              </div>

              {/* Step by Step */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Guide d’utilisation étape par étape
                </h4>
                <div className="space-y-2.5">
                  {activeDoc.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-brand-borderDark"
                    >
                      <div className="w-6 h-6 rounded-lg bg-brand-red/10 text-brand-red font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              {activeDoc.options.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Options et paramètres disponibles
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeDoc.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-brand-borderDark"
                      >
                        <div className="text-xs font-bold text-neutral-900 dark:text-white mb-1">
                          {opt.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                          {opt.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro Tips */}
              {activeDoc.proTips.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-300 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Astuces d’expert & Bonnes pratiques</span>
                  </div>
                  <ul className="space-y-1.5">
                    {activeDoc.proTips.map((tip, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200 leading-relaxed"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-brand-borderDark text-center text-xs text-neutral-400">
              PDFExpress • Traitement local sécurisé et confidentiel dans votre navigateur.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
