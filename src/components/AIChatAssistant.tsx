import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  FileText,
  FileUp,
  Languages,
  Maximize2,
  Minimize2,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { ChatMessage, PdfChatContext } from '../types/pdf';
import {
  extractFullTextFromPdfJs,
  formatBytes,
  getPdfPageCount,
  loadPdfJsDocument,
} from '../utils/pdfEngine';

interface AIChatAssistantProps {
  workspacePdfContext: PdfChatContext | null;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const TARGET_LANGUAGES = [
  'Anglais',
  'Français',
  'Arabe',
  'Espagnol',
  'Allemand',
  'Italien',
] as const;

function formatMessageTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push(
        <strong key={`${keyPrefix}-b-${idx}`} className="font-bold text-neutral-900 dark:text-white">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push(
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-800 font-mono text-[12px] text-neutral-900 dark:text-neutral-100"
        >
          {raw.slice(1, -1)}
        </code>
      );
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push(
        <em key={`${keyPrefix}-i-${idx}`} className="italic">
          {raw.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + raw.length;
    idx += 1;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens.length > 0 ? tokens : [text];
}

function MarkdownMessageContent({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const nodes: ReactNode[] = [];
    let i = 0;
    let blockKey = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i += 1;
        continue;
      }

      // Fenced code block
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i += 1;
        }
        i += 1;
        nodes.push(
          <div
            key={`md-${blockKey++}`}
            className="my-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 overflow-hidden"
          >
            {lang && (
              <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                {lang}
              </div>
            )}
            <pre className="p-3 text-xs font-mono overflow-x-auto leading-relaxed">
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(trimmed)) {
        nodes.push(
          <hr
            key={`md-${blockKey++}`}
            className="my-2.5 border-neutral-200 dark:border-neutral-800"
          />
        );
        i += 1;
        continue;
      }

      // Headings
      const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const cls =
          level === 1
            ? 'font-display font-bold text-base mt-2.5 mb-1 text-neutral-900 dark:text-white'
            : level === 2
            ? 'font-display font-bold text-[15px] mt-2.5 mb-1 text-neutral-900 dark:text-white'
            : 'font-display font-semibold text-sm mt-2 mb-0.5 text-neutral-900 dark:text-white';
        nodes.push(
          <div key={`md-${blockKey++}`} className={cls}>
            {renderInlineMarkdown(text, `h-${blockKey}`)}
          </div>
        );
        i += 1;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i += 1;
        }
        nodes.push(
          <blockquote
            key={`md-${blockKey++}`}
            className="my-2 pl-3 border-l-2 border-brand-red text-neutral-600 dark:text-neutral-300 italic text-[13px] leading-relaxed"
          >
            {renderInlineMarkdown(quoteLines.join(' '), `q-${blockKey}`)}
          </blockquote>
        );
        continue;
      }

      // Unordered list
      if (/^(?:[-*•])\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^(?:[-*•])\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^(?:[-*•])\s+/, ''));
          i += 1;
        }
        nodes.push(
          <ul key={`md-${blockKey++}`} className="my-1.5 space-y-1 pl-4 list-disc">
            {items.map((item, idx) => (
              <li key={`uli-${blockKey}-${idx}`} className="leading-relaxed">
                {renderInlineMarkdown(item, `uli-${blockKey}-${idx}`)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\d+[.)]\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
          i += 1;
        }
        nodes.push(
          <ol key={`md-${blockKey++}`} className="my-1.5 space-y-1 pl-4 list-decimal">
            {items.map((item, idx) => (
              <li key={`oli-${blockKey}-${idx}`} className="leading-relaxed">
                {renderInlineMarkdown(item, `oli-${blockKey}-${idx}`)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Paragraph
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('```') &&
        !/^(#{1,4})\s+/.test(lines[i].trim()) &&
        !lines[i].trim().startsWith('>') &&
        !/^(?:[-*•])\s+/.test(lines[i].trim()) &&
        !/^\d+[.)]\s+/.test(lines[i].trim()) &&
        !/^[-*_]{3,}$/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i].trim());
        i += 1;
      }
      nodes.push(
        <p key={`md-${blockKey++}`} className="my-1.5 leading-relaxed">
          {renderInlineMarkdown(paraLines.join(' '), `p-${blockKey}`)}
        </p>
      );
    }

    return nodes;
  }, [content]);

  return <div className="space-y-1 break-words text-[13.5px]">{blocks}</div>;
}

export function AIChatAssistant({
  workspacePdfContext,
  onNotify,
}: AIChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [showTranslatePicker, setShowTranslatePicker] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>('Anglais');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<{
    message: string;
    retryAction?: () => void;
  } | null>(null);

  const [uploadedPdfContext, setUploadedPdfContext] =
    useState<PdfChatContext | null>(null);
  const [dismissedWorkspaceName, setDismissedWorkspaceName] = useState<
    string | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Reset dismissal when a fresh workspace document is loaded
  useEffect(() => {
    if (workspacePdfContext?.fileName) {
      setDismissedWorkspaceName((prev) =>
        prev === workspacePdfContext.fileName ? prev : null
      );
    }
  }, [workspacePdfContext?.fileName]);

  const activeDoc: PdfChatContext | null = useMemo(() => {
    if (uploadedPdfContext) return uploadedPdfContext;
    if (
      workspacePdfContext &&
      workspacePdfContext.fileName !== dismissedWorkspaceName
    ) {
      return workspacePdfContext;
    }
    return null;
  }, [uploadedPdfContext, workspacePdfContext, dismissedWorkspaceName]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleLoadLocalPdf = useCallback(
    async (file: File) => {
      if (
        !file.name.toLowerCase().endsWith('.pdf') &&
        file.type !== 'application/pdf'
      ) {
        onNotify('Veuillez sélectionner un fichier PDF valide (.pdf).', 'error');
        return;
      }

      setIsParsingPdf(true);
      setErrorBanner(null);
      try {
        const buffer = await file.arrayBuffer();
        const pageCount = await getPdfPageCount(buffer);
        const pdfDoc = await loadPdfJsDocument(buffer);
        const extractedText = await extractFullTextFromPdfJs(pdfDoc);

        setUploadedPdfContext({
          fileName: file.name,
          pageCount,
          sizeFormatted: formatBytes(file.size),
          extractedText,
          source: 'chat-upload',
        });
        onNotify(`Document "${file.name}" prêt pour l’assistant IA.`, 'success');
      } catch (err) {
        console.error(err);
        onNotify(
          `Impossible de lire "${file.name}". Vérifiez qu’il s’agit d’un PDF valide.`,
          'error'
        );
      } finally {
        setIsParsingPdf(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [onNotify]
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleLoadLocalPdf(file);
    }
  };

  const handleClearDoc = () => {
    if (uploadedPdfContext) {
      setUploadedPdfContext(null);
    } else if (workspacePdfContext) {
      setDismissedWorkspaceName(workspacePdfContext.fileName);
    }
  };

  const pushUserAndExecute = useCallback(
    async (params: {
      promptText: string;
      actionType: 'qa' | 'summary' | 'translation';
      targetLang?: string;
    }) => {
      const cleanPrompt = params.promptText.trim();
      if (!cleanPrompt || isSending) return;

      setErrorBanner(null);
      setShowTranslatePicker(false);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: cleanPrompt,
        timestamp: Date.now(),
        actionType: params.actionType,
      };

      const prevHistory = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsSending(true);

      try {
        const docText = activeDoc?.extractedText?.trim() || '';

        if (params.actionType === 'summary' && docText) {
          const res = await fetch('/api/ai/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: docText,
              style: 'bullets',
              lang: 'fr',
            }),
          });
          const data = (await res.json()) as {
            summary?: string;
            mode?: 'ai' | 'local';
            error?: string;
          };
          if (!res.ok || !data.summary) {
            throw new Error(
              data.error || 'Impossible de générer le résumé de ce PDF.'
            );
          }

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.summary!,
              timestamp: Date.now(),
              actionType: 'summary',
              mode: data.mode || 'ai',
            },
          ]);
          return;
        }

        if (params.actionType === 'translation' && docText) {
          const langLabel = params.targetLang || selectedLang || 'Anglais';
          const res = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: docText,
              targetLang: langLabel,
            }),
          });
          const data = (await res.json()) as {
            translatedText?: string;
            error?: string;
          };
          if (!res.ok || !data.translatedText) {
            throw new Error(
              data.error || 'Impossible de traduire ce document PDF.'
            );
          }

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `### Traduction en ${langLabel}\n\n${data.translatedText}`,
              timestamp: Date.now(),
              actionType: 'translation',
              mode: 'ai',
            },
          ]);
          return;
        }

        // Standard multi-turn Gemini chat endpoint
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanPrompt,
            history: prevHistory,
            documentContext: docText,
            documentName: activeDoc?.fileName || '',
            pageCount: activeDoc?.pageCount || 0,
            actionType: params.actionType,
          }),
        });

        const data = (await res.json()) as {
          reply?: string;
          mode?: 'ai' | 'local';
          error?: string;
        };

        if (!res.ok || !data.reply) {
          throw new Error(
            data.error || 'Une erreur est survenue lors de la réponse IA.'
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.reply!,
            timestamp: Date.now(),
            actionType: params.actionType,
            mode: data.mode || 'ai',
          },
        ]);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur de connexion avec l’assistant IA.';
        setErrorBanner({
          message,
          retryAction: () => {
            setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
            void pushUserAndExecute(params);
          },
        });
      } finally {
        setIsSending(false);
      }
    },
    [activeDoc, isSending, selectedLang]
  );

  const handleSendInput = () => {
    if (!inputValue.trim() || isSending) return;
    void pushUserAndExecute({
      promptText: inputValue,
      actionType: 'qa',
    });
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  };

  const handleQuickSummary = () => {
    if (!activeDoc) {
      onNotify(
        'Chargez d’abord un document PDF pour générer son résumé.',
        'info'
      );
      fileInputRef.current?.click();
      return;
    }
    if (!activeDoc.extractedText.trim()) {
      onNotify(
        'Ce PDF semble numérisé sans texte sélectionnable. Utilisez OCR Avancé IA ou chargez un PDF textuel.',
        'info'
      );
      return;
    }
    void pushUserAndExecute({
      promptText: `Résume le document "${activeDoc.fileName}" en points clés.`,
      actionType: 'summary',
    });
  };

  const handleQuickTranslate = (lang: string) => {
    setSelectedLang(lang);
    if (!activeDoc) {
      onNotify(
        'Chargez d’abord un document PDF pour le traduire.',
        'info'
      );
      fileInputRef.current?.click();
      return;
    }
    if (!activeDoc.extractedText.trim()) {
      onNotify(
        'Aucun texte sélectionnable détecté dans ce PDF.',
        'info'
      );
      return;
    }
    void pushUserAndExecute({
      promptText: `Traduis le contenu de "${activeDoc.fileName}" en ${lang}.`,
      actionType: 'translation',
      targetLang: lang,
    });
  };

  const handleCopyContent = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      onNotify('Impossible de copier dans le presse-papiers.', 'error');
    }
  };

  const hasExtractedText = Boolean(activeDoc?.extractedText?.trim());
  const isTruncated = (activeDoc?.extractedText?.length || 0) > 30000;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Floating Launcher Button (bottom-right) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 120);
          }}
          aria-label="Ouvrir l’assistant chat IA PDFExpress"
          className="fixed bottom-5 right-5 z-50 min-h-[48px] px-4 py-2.5 rounded-2xl bg-brand-red hover:bg-brand-redHover text-white shadow-xl shadow-brand-red/25 border border-white/15 flex items-center gap-2.5 font-display font-bold text-sm transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-red"
        >
          <span className="relative flex items-center justify-center">
            <Bot className="w-5 h-5" />
            {activeDoc && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-brand-red"
                title={`Document prêt : ${activeDoc.fileName}`}
              />
            )}
          </span>
          <span className="hidden sm:inline whitespace-nowrap">Assistant IA</span>
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <aside
          aria-label="Assistant IA PDFExpress"
          className={`fixed z-50 inset-x-3 bottom-3 top-16 sm:inset-auto sm:bottom-5 sm:right-5 ${
            isExpanded ? 'sm:w-[540px]' : 'sm:w-[410px]'
          } sm:h-[min(620px,calc(100vh-5.5rem))] bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-[width,transform,opacity] duration-200`}
        >
          {/* Header */}
          <header className="px-4 py-3 border-b border-neutral-200 dark:border-brand-borderDark bg-brand-bgLight/70 dark:bg-brand-bgDark/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 border border-brand-red/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-bold text-sm text-neutral-900 dark:text-white truncate">
                  Assistant IA PDFExpress
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  Questions, résumés & traductions Gemini
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                aria-label={isExpanded ? 'Réduire la largeur' : 'Agrandir la largeur'}
                title={isExpanded ? 'Réduire' : 'Agrandir'}
                className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setErrorBanner(null);
                  setShowTranslatePicker(false);
                }}
                disabled={messages.length === 0 && !errorBanner}
                aria-label="Nouvelle conversation"
                title="Effacer la conversation"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer l’assistant"
                title="Fermer (Échap)"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Active PDF Context Strip */}
          <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-cardDark shrink-0">
            {isParsingPdf ? (
              <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300 py-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-red shrink-0" />
                <span>Extraction du texte du PDF en cours...</span>
              </div>
            ) : activeDoc ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        hasExtractedText ? 'bg-emerald-600' : 'bg-amber-500'
                      }`}
                    />
                    <FileText className="w-4 h-4 text-brand-red shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {activeDoc.fileName}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                        {activeDoc.pageCount} page{activeDoc.pageCount > 1 ? 's' : ''} •{' '}
                        {activeDoc.sizeFormatted}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-brand-borderDark transition-colors"
                    >
                      Changer
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDoc}
                      aria-label="Détacher le document"
                      title="Détacher le document"
                      className="p-1 rounded-md text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {!hasExtractedText && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                    Aucun texte sélectionnable détecté (document scanné). Utilisez l’outil OCR Avancé IA ou importez un PDF textuel.
                  </p>
                )}
                {isTruncated && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                    Document long : analyse focalisée sur les 30 000 premiers caractères.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Aucun PDF lié au chat
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-bgLight dark:bg-brand-bgDark hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-brand-borderDark transition-colors shrink-0"
                >
                  <FileUp className="w-3.5 h-3.5 text-brand-red" />
                  <span>Charger un PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Conversation Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-brand-bgLight/70 dark:bg-brand-bgDark/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-display font-bold text-sm">
                    <Bot className="w-4 h-4 text-brand-red shrink-0" />
                    <span>
                      {activeDoc
                        ? `Prêt à analyser "${activeDoc.fileName}"`
                        : 'Comment puis-je vous aider avec vos PDF ?'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {activeDoc
                      ? 'Posez n’importe quelle question sur ce document, demandez un résumé structuré ou traduisez son contenu en un clic.'
                      : 'Chargez un document PDF ci-dessus (ou ouvrez un outil PDFExpress) pour poser des questions, résumer ou traduire son contenu.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Suggestions rapides
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {activeDoc ? (
                      <>
                        <button
                          type="button"
                          onClick={handleQuickSummary}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-bgDark hover:border-brand-red/60 dark:hover:border-brand-red/60 transition-colors flex items-center gap-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
                        >
                          <FileText className="w-4 h-4 text-brand-red shrink-0" />
                          <span>Résumer ce document en points clés</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTranslatePicker(true)}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-bgDark hover:border-brand-red/60 dark:hover:border-brand-red/60 transition-colors flex items-center gap-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
                        >
                          <Languages className="w-4 h-4 text-brand-red shrink-0" />
                          <span>Traduire le contenu dans une autre langue</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void pushUserAndExecute({
                              promptText:
                                'Extrais les informations essentielles, dates et chiffres clés de ce document.',
                              actionType: 'qa',
                            })
                          }
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-bgDark hover:border-brand-red/60 dark:hover:border-brand-red/60 transition-colors flex items-center gap-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
                        >
                          <Sparkles className="w-4 h-4 text-brand-red shrink-0" />
                          <span>Extraire les chiffres, dates et faits clés</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void pushUserAndExecute({
                              promptText:
                                'Explique le sujet principal et les conclusions de ce document de façon simple.',
                              actionType: 'qa',
                            })
                          }
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-bgDark hover:border-brand-red/60 dark:hover:border-brand-red/60 transition-colors flex items-center gap-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
                        >
                          <Bot className="w-4 h-4 text-brand-red shrink-0" />
                          <span>Expliquer le document simplement</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-brand-red/30 bg-brand-red/5 hover:bg-brand-red/10 transition-colors flex items-center gap-2.5 text-xs font-semibold text-brand-red"
                        >
                          <FileUp className="w-4 h-4 shrink-0" />
                          <span>Importer un PDF pour le résumer ou l’interroger</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void pushUserAndExecute({
                              promptText:
                                'Quels sont les principaux outils gratuits disponibles sur PDFExpress ?',
                              actionType: 'qa',
                            })
                          }
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-bgDark hover:border-brand-red/60 transition-colors flex items-center gap-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
                        >
                          <Sparkles className="w-4 h-4 text-brand-red shrink-0" />
                          <span>Découvrir les outils disponibles sur PDFExpress</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void pushUserAndExecute({
                              promptText:
                                'Comment traduire ou compresser un fichier PDF efficacement sur PDFExpress ?',
                              actionType: 'qa',
                            })
                          }
                          className="w-full text-left px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-bgDark hover:border-brand-red/60 transition-colors flex items-center gap-2.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100"
                        >
                          <Languages className="w-4 h-4 text-brand-red shrink-0" />
                          <span>Comment traduire ou compresser un PDF ?</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-red text-white px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="w-full max-w-[94%] rounded-2xl rounded-bl-sm bg-brand-bgLight dark:bg-brand-bgDark border border-neutral-200 dark:border-brand-borderDark text-neutral-800 dark:text-neutral-100 px-3.5 py-3">
                      <MarkdownMessageContent content={msg.content} />
                      <div className="mt-2.5 pt-2 border-t border-neutral-200/70 dark:border-brand-borderDark/80 flex items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span className="font-mono tabular-nums">
                          {msg.actionType === 'summary'
                            ? msg.mode === 'local'
                              ? 'Résumé local'
                              : 'Résumé Gemini'
                            : msg.actionType === 'translation'
                            ? 'Traduction Gemini'
                            : 'Gemini IA'}{' '}
                          • {formatMessageTime(msg.timestamp)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyContent(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {isSending && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm bg-brand-bgLight dark:bg-brand-bgDark border border-neutral-200 dark:border-brand-borderDark px-4 py-3 flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-red shrink-0" />
                  <span>Réflexion sur votre PDF en cours...</span>
                </div>
              </div>
            )}

            {errorBanner && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorBanner.message}</span>
                </div>
                {errorBanner.retryAction && (
                  <button
                    type="button"
                    onClick={errorBanner.retryAction}
                    className="px-2 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold shrink-0 transition-colors"
                  >
                    Réessayer
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Persistent Quick Actions Bar when chatting */}
          {messages.length > 0 && activeDoc && !isSending && (
            <div className="px-3 py-1.5 border-t border-neutral-200/80 dark:border-brand-borderDark bg-brand-bgLight/50 dark:bg-brand-bgDark/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={handleQuickSummary}
                className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-cardDark hover:border-brand-red text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 whitespace-nowrap shrink-0 transition-colors"
              >
                Résumer
              </button>
              <button
                type="button"
                onClick={() => setShowTranslatePicker((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  showTranslatePicker
                    ? 'border-brand-red bg-brand-red/10 text-brand-red'
                    : 'border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-cardDark hover:border-brand-red text-neutral-700 dark:text-neutral-200'
                }`}
              >
                Traduire
              </button>
              <button
                type="button"
                onClick={() =>
                  void pushUserAndExecute({
                    promptText: 'Quels sont les points d’action ou recommandations clés ?',
                    actionType: 'qa',
                  })
                }
                className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-cardDark hover:border-brand-red text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 whitespace-nowrap shrink-0 transition-colors"
              >
                Points d’action
              </button>
            </div>
          )}

          {/* Inline Translation Language Picker */}
          {showTranslatePicker && (
            <div className="px-3 py-2 border-t border-neutral-200 dark:border-brand-borderDark bg-brand-bgLight dark:bg-brand-bgDark space-y-1.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                  Traduire le PDF complet vers :
                </span>
                <button
                  type="button"
                  onClick={() => setShowTranslatePicker(false)}
                  className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  Fermer
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    disabled={isSending}
                    onClick={() => handleQuickTranslate(lang)}
                    className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-cardDark hover:border-brand-red hover:text-brand-red text-xs font-medium text-neutral-800 dark:text-neutral-200 transition-colors"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer Footer */}
          <div className="p-3 border-t border-neutral-200 dark:border-brand-borderDark bg-white dark:bg-brand-cardDark shrink-0">
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Joindre un document PDF"
                title="Joindre un document PDF"
                className="min-w-[42px] min-h-[42px] rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-brand-bgLight dark:bg-brand-bgDark hover:border-brand-red text-neutral-600 dark:text-neutral-300 hover:text-brand-red flex items-center justify-center shrink-0 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={
                  activeDoc
                    ? `Posez une question sur ${activeDoc.fileName}...`
                    : 'Posez une question ou importez un PDF...'
                }
                disabled={isSending}
                className="flex-1 min-h-[42px] max-h-28 resize-none rounded-xl border border-neutral-200 dark:border-brand-borderDark bg-brand-bgLight dark:bg-brand-bgDark px-3 py-2.5 text-[13.5px] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-brand-red transition-colors"
              />
              <button
                type="button"
                onClick={handleSendInput}
                disabled={!inputValue.trim() || isSending}
                aria-label="Envoyer le message"
                className="min-w-[42px] min-h-[42px] rounded-xl bg-brand-red hover:bg-brand-redHover disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shrink-0 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
