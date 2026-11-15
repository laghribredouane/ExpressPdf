import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightCircle,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  Crown,
  Download,
  FileDiff,
  FilePlus,
  FileSpreadsheet,
  GripVertical,
  ImagePlus,
  LayoutGrid,
  Lock,
  Mail,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import { useHistoryState } from '../hooks/useHistoryState';
import type {
  CanvasAnnotation,
  CropMargins,
  ExecutionResult,
  LoadedFile,
  PageOrderItem,
  PdfChatContext,
  QuotaCheckResult,
  ToolDefinition,
  ToolId,
  WorkflowStepId,
} from '../types/pdf';
import {
  applyFreeTierPdfFooter,
  executePdfTool,
  extractFullTextFromPdfJs,
  formatBytes,
  getPdfPageCount,
  loadPdfJsDocument,
  readFileAsDataURL,
  renderPdfPageToDataURL,
} from '../utils/pdfEngine';
import { getAdSenseSlotId } from '../utils/adsense';
import { AdSenseBanner } from './AdSenseBanner';
import { SignaturePad } from './SignaturePad';
import { SocialPostStudio } from './SocialPostStudio';
import { ToolIcon } from './ToolIcon';

interface WorkspaceViewProps {
  tool: ToolDefinition;
  droppedFiles: File[] | null;
  onConsumeDroppedFiles: () => void;
  onGoHome: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onFileProcessed: (entry: {
    fileName: string;
    toolId: ToolId;
    toolTitle: string;
    sizeFormatted: string;
  }) => void;
  onImportFromGmail?: () => void;
  onSendResultViaGmail?: (payload: {
    fileName: string;
    blob: Blob;
    toolTitle: string;
  }) => void;
  onScheduleResultInCalendar?: (payload: {
    fileName: string;
    blob: Blob;
    toolTitle: string;
  }) => void;
  isPremiumOrTrial?: boolean;
  isAdFree?: boolean;
  isWatermarked?: boolean;
  maxFileMb?: number;
  maxBatchFiles?: number;
  remainingTasks?: number | null;
  dailyLimit?: number | null;
  checkUserQuota?: (params: {
    tool?: Pick<ToolDefinition, 'id' | 'title' | 'isPro'>;
    files?: File[];
    compressLevel?: string;
  }) => QuotaCheckResult;
  onQuotaBlocked?: (result: QuotaCheckResult) => void;
  onQuotaConsumed?: (toolId: ToolId, files: File[]) => Promise<void> | void;
  onGlobalProgress?: (progress: number | null, message?: string) => void;
  onActivePdfContextChange?: (ctx: PdfChatContext | null) => void;
  onOpenPricing?: () => void;
}

type Stage = 'dropzone' | 'editor' | 'processing' | 'result';

const FILE_CARD_TOOLS = new Set([
  'merge',
  'jpg2pdf',
  'word2pdf',
  'ppt2pdf',
  'excel2pdf',
  'compress',
  'repair',
  'ocr',
  'pdf2jpg',
  'pdf2word',
  'pdf2ppt',
  'pdf2excel',
  'pdf2pdfa',
  'pdf2md',
  'pagenumbers',
  'watermark',
  'unlock',
  'protect',
  'aisummary',
  'translatepdf',
  'aiocr',
  'workflow',
  'stampgenerator',
]);

const THUMBNAIL_TOOLS = new Set([
  'removepages',
  'extractpages',
  'organizepages',
  'rotate',
]);

const INTERACTIVE_CANVAS_TOOLS = new Set([
  'sign',
  'editpdf',
  'redact',
  'crop',
  'pdfforms',
]);

const HISTORY_ENABLED_TOOLS = new Set<ToolId>([
  'editpdf',
  'sign',
  'redact',
  'crop',
  'pdfforms',
  'rotate',
  'removepages',
  'extractpages',
  'organizepages',
  'merge',
  'jpg2pdf',
  'scan2pdf',
]);

interface DocumentEditSnapshot {
  files: LoadedFile[];
  selectedPages: number[];
  pageOrder: PageOrderItem[];
  pageRotations: Record<number, number>;
  annotations: Record<number, CanvasAnnotation[]>;
  cropMargins: CropMargins;
  scannedImages: string[];
}

const EMPTY_DOC_SNAPSHOT: DocumentEditSnapshot = {
  files: [],
  selectedPages: [],
  pageOrder: [],
  pageRotations: {},
  annotations: {},
  cropMargins: { top: 0, bottom: 0, left: 0, right: 0 },
  scannedImages: [],
};

const MAX_ORG_FILES = 15;

const getOrgFileKey = (name: string, size: number) =>
  `${name.trim().toLowerCase()}::${size}`;

const ORG_FILE_DOT_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-lime-600',
  'bg-rose-500',
  'bg-sky-500',
  'bg-fuchsia-500',
  'bg-stone-500',
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; padding: 30px; color: #1f2937; }
  h1 { color: #E5322D; border-bottom: 2px solid #E5322D; padding-bottom: 8px; }
  .box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px; }
</style>
</head>
<body>
  <h1>Rapport Généré depuis HTML</h1>
  <p>Ce document a été converti directement en PDF dans votre navigateur grâce à PDFExpress.</p>
  <div class="box">
    <strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}<br>
    <strong>Statut :</strong> Validé et prêt pour diffusion.
  </div>
</body>
</html>`;

export function WorkspaceView({
  tool,
  droppedFiles,
  onConsumeDroppedFiles,
  onGoHome,
  onNotify,
  onFileProcessed,
  onImportFromGmail,
  onSendResultViaGmail,
  onScheduleResultInCalendar,
  isPremiumOrTrial = false,
  isAdFree,
  isWatermarked = true,
  maxFileMb = 200,
  maxBatchFiles = 999,
  remainingTasks = null,
  dailyLimit = null,
  checkUserQuota,
  onQuotaBlocked,
  onQuotaConsumed,
  onGlobalProgress,
  onActivePdfContextChange,
  onOpenPricing,
}: WorkspaceViewProps) {
  const effectiveAdFree = isAdFree ?? isPremiumOrTrial;
  const [stage, setStage] = useState<Stage>('dropzone');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const docHistory = useHistoryState<DocumentEditSnapshot>(
    EMPTY_DOC_SNAPSHOT,
    20
  );
  const {
    state: docState,
    canUndo,
    canRedo,
    setState: setDocState,
    replaceState: replaceDocState,
    undo: undoDocState,
    redo: redoDocState,
    reset: resetDocState,
  } = docHistory;
  const {
    files,
    pageOrder,
    pageRotations,
    annotations,
    cropMargins,
    scannedImages,
  } = docState;
  const selectedPages = useMemo(
    () => new Set(docState.selectedPages),
    [docState.selectedPages]
  );
  const docStateRef = useRef(docState);
  docStateRef.current = docState;

  const [firstPageThumbs, setFirstPageThumbs] = useState<Record<string, string>>({});
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([]);
  const [orgThumbnailsByFile, setOrgThumbnailsByFile] = useState<Record<string, string[]>>({});
  const [draggedPageIdx, setDraggedPageIdx] = useState<number | null>(null);
  const [dragOverPageIdx, setDragOverPageIdx] = useState<number | null>(null);
  const [orgFileFilter, setOrgFileFilter] = useState<'all' | number>('all');

  // Interactive Canvas state
  const [currentCanvasPage, setCurrentCanvasPage] = useState(1);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [sigSize, setSigSize] = useState(160);
  const [editMode, setEditMode] = useState<'text' | 'highlight'>('text');
  const [editText, setEditText] = useState(
    `Validé le ${new Date().toLocaleDateString('fr-FR')}`
  );
  const [editColor, setEditColor] = useState('#E5322D');
  const [editFontSize, setEditFontSize] = useState(18);

  // Scanner state
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamFailed, setWebcamFailed] = useState(false);

  // HTML Editor state
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML);

  // Compare state
  const [secondCompareName, setSecondCompareName] = useState<string | null>(null);
  const [secondPdfJsDoc, setSecondPdfJsDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(
    null
  );
  const [compareDiffLines, setCompareDiffLines] = useState<{
    summary: string;
    identical: boolean;
    removed: string[];
    added: string[];
    plainText: string;
  } | null>(null);

  // Tool options state
  const [mergeName, setMergeName] = useState('PDFExpress_fusionne.pdf');
  const [splitMode, setSplitMode] = useState<'range' | 'all'>('range');
  const [splitRanges, setSplitRanges] = useState('1-1');
  const [extractFormat, setExtractFormat] = useState<'single' | 'zip'>('single');
  const [scanFilter, setScanFilter] = useState<'bw' | 'color'>('bw');
  const [compressLevel, setCompressLevel] = useState<
    'extreme' | 'recommended' | 'low' | 'lossless'
  >('recommended');
  const [compressQuality, setCompressQuality] = useState<number>(68);
  const [compressGrayscale, setCompressGrayscale] = useState<boolean>(false);
  const [compressStripMetadata, setCompressStripMetadata] =
    useState<boolean>(true);
  const [ocrLang, setOcrLang] = useState('fra');
  const [ocrOutput, setOcrOutput] = useState<'pdf' | 'txt'>('pdf');
  const [jpgOrient, setJpgOrient] = useState<'portrait' | 'landscape' | 'fit'>('portrait');
  const [jpgMargin, setJpgMargin] = useState(25);
  const [pdf2jpgScale, setPdf2jpgScale] = useState(2.5);
  const [numPos, setNumPos] = useState<'bc' | 'br' | 'bl' | 'tc' | 'tr' | 'tl'>('bc');
  const [numFmt, setNumFmt] = useState<'1' | 'page' | 'total'>('1');
  const [wmText, setWmText] = useState('CONFIDENTIEL');
  const [wmColor, setWmColor] = useState<'red' | 'gray' | 'blue'>('red');
  const [wmAngle, setWmAngle] = useState(45);
  const [wmOpacity, setWmOpacity] = useState(35);
  const [unlockPwd, setUnlockPwd] = useState('');
  const [protectPwd, setProtectPwd] = useState('');
  const [protectStamp, setProtectStamp] = useState(true);
  const [formFieldType, setFormFieldType] = useState<
    'form-text' | 'form-check' | 'form-select'
  >('form-text');
  const [formFieldName, setFormFieldName] = useState('champ');
  const [formFieldOptions, setFormFieldOptions] = useState(
    'Option A, Option B, Option C'
  );
  const [summaryStyle, setSummaryStyle] = useState<'short' | 'bullets' | 'detailed'>(
    'bullets'
  );
  const [summaryOutput, setSummaryOutput] = useState<'pdf' | 'txt'>('pdf');
  const [translateTargetLang, setTranslateTargetLang] = useState('Anglais');
  const [aiOcrLang, setAiOcrLang] = useState('Automatique');
  const [aiOcrOutput, setAiOcrOutput] = useState<
    'searchable' | 'editable' | 'txt' | 'md'
  >('searchable');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepId[]>([
    'merge',
    'pagenumbers',
    'compress',
  ]);
  const [stampShape, setStampShape] = useState<'circle' | 'rectangle' | 'badge'>('circle');
  const [stampTextTop, setStampTextTop] = useState('REPUBLIQUE FRANCAISE');
  const [stampCenterText, setStampCenterText] = useState('APPROUVÉ');
  const [stampTextBottom, setStampTextBottom] = useState(new Date().toLocaleDateString('fr-FR'));
  const [stampColor, setStampColor] = useState<'red' | 'blue' | 'green' | 'black' | 'purple'>('red');
  const [stampOpacity, setStampOpacity] = useState(90);
  const [stampPosition, setStampPosition] = useState<'br' | 'bl' | 'tr' | 'tl' | 'center'>('br');
  const [stampPageMode, setStampPageMode] = useState<'all' | 'first' | 'last'>('all');

  // Execution result
  const [progress, setProgress] = useState(25);
  const [result, setResult] = useState<{
    url: string;
    blob: Blob;
    fileName: string;
    sizeFormatted: string;
    btnText: string;
    statsHtml?: string;
  } | null>(null);

  const [canvasWrapWidth, setCanvasWrapWidth] = useState(0);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const secondCompareInputRef = useRef<HTMLInputElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const pdfRenderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareCanvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const compareCanvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const drawStateRef = useRef<{ isDrawing: boolean; startX: number; startY: number }>({
    isDrawing: false,
    startX: 0,
    startY: 0,
  });
  const sigImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const createdPreviewUrlsRef = useRef<Set<string>>(new Set());
  const pendingOrgFileKeysRef = useRef<Set<string>>(new Set());

  const stopWebcam = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    setWebcamActive(false);
  }, []);

  const revokeUrls = useCallback((fileList: LoadedFile[], resUrl?: string | null) => {
    fileList.forEach((f) => {
      if (f.previewUrl) {
        URL.revokeObjectURL(f.previewUrl);
        createdPreviewUrlsRef.current.delete(f.previewUrl);
      }
    });
    createdPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    createdPreviewUrlsRef.current.clear();
    if (resUrl) URL.revokeObjectURL(resUrl);
  }, []);

  const resetWorkspace = useCallback(() => {
    stopWebcam();
    revokeUrls(docStateRef.current.files);
    resetDocState(EMPTY_DOC_SNAPSHOT);
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setFirstPageThumbs({});
    setPageThumbnails([]);
    setOrgThumbnailsByFile({});
    setDraggedPageIdx(null);
    setDragOverPageIdx(null);
    setOrgFileFilter('all');
    setCurrentCanvasPage(1);
    setSecondCompareName(null);
    setSecondPdfJsDoc(null);
    setCompareDiffLines(null);
    setStage('dropzone');
    pendingOrgFileKeysRef.current.clear();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [stopWebcam, revokeUrls, resetDocState]);

  // Reset when tool changes
  useEffect(() => {
    resetWorkspace();
  }, [tool.id, resetWorkspace]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      createdPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdPreviewUrlsRef.current.clear();
      onActivePdfContextChange?.(null);
    };
  }, [stopWebcam, onActivePdfContextChange]);

  // Sync primary loaded PDF text to global AI Chat Assistant
  const primaryLoadedFile = files[0] || null;
  useEffect(() => {
    if (!onActivePdfContextChange) return;
    if (!primaryLoadedFile || !primaryLoadedFile.pdfJsDoc) {
      onActivePdfContextChange(null);
      return;
    }

    let cancelled = false;
    extractFullTextFromPdfJs(primaryLoadedFile.pdfJsDoc)
      .then((extractedText) => {
        if (cancelled) return;
        onActivePdfContextChange({
          fileName: primaryLoadedFile.name,
          pageCount: primaryLoadedFile.pageCount,
          sizeFormatted: primaryLoadedFile.sizeFormatted,
          extractedText,
          source: 'workspace',
        });
      })
      .catch(() => {
        if (!cancelled) {
          onActivePdfContextChange(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [primaryLoadedFile, onActivePdfContextChange]);

  const handleUndo = useCallback(() => {
    undoDocState();
  }, [undoDocState]);

  const handleRedo = useCallback(() => {
    redoDocState();
  }, [redoDocState]);

  // Global Undo / Redo keyboard shortcuts (Ctrl/Cmd+Z, Ctrl+Y, Ctrl/Cmd+Shift+Z)
  useEffect(() => {
    if (stage !== 'editor' || !HISTORY_ENABLED_TOOLS.has(tool.id)) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl instanceof HTMLInputElement &&
          ![
            'checkbox',
            'radio',
            'range',
            'button',
            'submit',
            'reset',
            'file',
            'color',
          ].includes(activeEl.type)) ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, tool.id, handleUndo, handleRedo]);

  const handleIncomingFiles = useCallback(
    async (incomingList: FileList | File[]) => {
      let incoming = Array.from(incomingList);
      if (incoming.length === 0) return;

      const reservedOrgKeys: string[] = [];

      if (tool.id === 'organizepages') {
        const existingKeys = new Set(
          docStateRef.current.files.map((f) => getOrgFileKey(f.name, f.sizeBytes))
        );
        const batchKeys = new Set<string>();
        const uniqueIncoming: File[] = [];
        let duplicateCount = 0;

        for (const f of incoming) {
          const key = getOrgFileKey(f.name, f.size);
          if (
            existingKeys.has(key) ||
            batchKeys.has(key) ||
            pendingOrgFileKeysRef.current.has(key)
          ) {
            duplicateCount += 1;
            continue;
          }
          batchKeys.add(key);
          uniqueIncoming.push(f);
        }

        if (duplicateCount > 0) {
          onNotify(
            uniqueIncoming.length === 0
              ? duplicateCount > 1
                ? 'Ces fichiers PDF sont déjà présents dans Organiser PDF (duplication annulée).'
                : `"${incoming[0].name}" est déjà présent dans Organiser PDF (duplication annulée).`
              : `${duplicateCount} fichier(s) en double ignoré(s).`,
            'info'
          );
        }

        if (uniqueIncoming.length === 0) return;
        incoming = uniqueIncoming;

        const occupiedCount =
          docStateRef.current.files.length + pendingOrgFileKeysRef.current.size;
        const remainingSlots = MAX_ORG_FILES - occupiedCount;
        if (remainingSlots <= 0) {
          onNotify(
            `Limite atteinte : maximum ${MAX_ORG_FILES} fichiers PDF dans Organiser PDF.`,
            'info'
          );
          return;
        }
        if (incoming.length > remainingSlots) {
          incoming = incoming.slice(0, remainingSlots);
          onNotify(
            `Limite de ${MAX_ORG_FILES} fichiers PDF : seuls les ${remainingSlots} premier(s) fichier(s) ont été ajoutés.`,
            'info'
          );
        }
      }

      if (checkUserQuota) {
        const filesToCheck = tool.multiple
          ? [...docStateRef.current.files.map((f) => f.file), ...incoming]
          : [incoming[0]];
        const quotaRes = checkUserQuota({
          tool,
          files: filesToCheck,
          compressLevel,
        });
        if (!quotaRes.allowed) {
          onQuotaBlocked?.(quotaRes);
          return;
        }
      }

      if (tool.id === 'organizepages') {
        incoming.forEach((f) => {
          const key = getOrgFileKey(f.name, f.size);
          pendingOrgFileKeysRef.current.add(key);
          reservedOrgKeys.push(key);
        });
      }

      setIsLoadingFiles(true);
      onGlobalProgress?.(15, 'Chargement des fichiers PDF...');
      try {
        if (tool.id === 'html2pdf') {
          const text = await incoming[0].text();
          setHtmlCode(text);
          setStage('editor');
          return;
        }

        if (tool.id === 'scan2pdf') {
          const newScans: string[] = [];
          for (const f of incoming) {
            if (f.type.startsWith('image/')) {
              newScans.push(await readFileAsDataURL(f));
            }
          }
          if (newScans.length > 0) {
            if (docStateRef.current.scannedImages.length === 0) {
              resetDocState({
                ...EMPTY_DOC_SNAPSHOT,
                scannedImages: newScans,
              });
            } else {
              setDocState((prev) => ({
                ...prev,
                scannedImages: [...prev.scannedImages, ...newScans],
              }));
            }
            setStage('editor');
          } else {
            onNotify('Veuillez sélectionner des fichiers image.', 'error');
          }
          return;
        }

        const loaded: LoadedFile[] = [];
        for (const file of incoming) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            let pageCount = 1;
            let previewUrl: string | null = null;
            let pdfJsDoc: pdfjsLib.PDFDocumentProxy | null = null;

            if (
              tool.id === 'jpg2pdf' ||
              (tool.id === 'aiocr' && file.type.startsWith('image/'))
            ) {
              previewUrl = URL.createObjectURL(file);
              createdPreviewUrlsRef.current.add(previewUrl);
            } else if (['word2pdf', 'ppt2pdf', 'excel2pdf'].includes(tool.id)) {
              pageCount = 1;
            } else {
              pageCount = await getPdfPageCount(arrayBuffer);
              pdfJsDoc = await loadPdfJsDocument(arrayBuffer);
            }

            loaded.push({
              id: crypto.randomUUID(),
              file,
              name: file.name,
              sizeBytes: file.size,
              sizeFormatted: formatBytes(file.size),
              arrayBuffer,
              pageCount,
              previewUrl,
              pdfJsDoc,
            });
          } catch (err) {
            console.error(err);
            onNotify(`Erreur lors de l'ouverture de "${file.name}".`, 'error');
          }
        }

        if (loaded.length === 0) return;

        if (!tool.multiple) {
          setPageThumbnails([]);
          resetDocState({
            ...EMPTY_DOC_SNAPSHOT,
            files: [loaded[0]],
          });
          setSplitRanges(`1-${loaded[0].pageCount}`);
        } else if (tool.id === 'organizepages') {
          const applyOrgFiles = (prev: DocumentEditSnapshot): DocumentEditSnapshot => {
            const prevKeys = new Set(
              prev.files.map((f) => getOrgFileKey(f.name, f.sizeBytes))
            );
            const uniqueLoaded: LoadedFile[] = [];
            for (const lf of loaded) {
              const key = getOrgFileKey(lf.name, lf.sizeBytes);
              if (prevKeys.has(key)) {
                if (lf.previewUrl) {
                  URL.revokeObjectURL(lf.previewUrl);
                  createdPreviewUrlsRef.current.delete(lf.previewUrl);
                }
                continue;
              }
              prevKeys.add(key);
              uniqueLoaded.push(lf);
            }
            const available = Math.max(0, MAX_ORG_FILES - prev.files.length);
            const accepted = uniqueLoaded.slice(0, available);
            if (accepted.length === 0) return prev;

            const startIdx = prev.files.length;
            const appendedOrder: PageOrderItem[] = [];
            accepted.forEach((f, offset) => {
              const fIdx = startIdx + offset;
              for (let p = 0; p < f.pageCount; p++) {
                appendedOrder.push({ fileIndex: fIdx, originalIndex: p, rotation: 0 });
              }
            });
            return {
              ...prev,
              files: [...prev.files, ...accepted],
              pageOrder: [...prev.pageOrder, ...appendedOrder],
            };
          };

          if (docStateRef.current.files.length === 0) {
            replaceDocState(applyOrgFiles);
          } else {
            setDocState(applyOrgFiles);
          }
        } else if (docStateRef.current.files.length === 0) {
          resetDocState({
            ...EMPTY_DOC_SNAPSHOT,
            files: loaded,
          });
        } else {
          setDocState((prev) => ({
            ...prev,
            files: [...prev.files, ...loaded],
          }));
        }

        setCurrentCanvasPage(1);
        setStage('editor');
      } finally {
        reservedOrgKeys.forEach((k) => pendingOrgFileKeysRef.current.delete(k));
        setIsLoadingFiles(false);
        onGlobalProgress?.(null);
      }
    },
    [
      tool,
      compressLevel,
      checkUserQuota,
      onQuotaBlocked,
      onNotify,
      onGlobalProgress,
      resetDocState,
      replaceDocState,
      setDocState,
    ]
  );

  // Consume global drag-and-drop files forwarded from App
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      handleIncomingFiles(droppedFiles);
      onConsumeDroppedFiles();
    }
  }, [droppedFiles, handleIncomingFiles, onConsumeDroppedFiles]);

  // Generate first-page thumbnails for File Card tools
  useEffect(() => {
    if (stage !== 'editor' || !FILE_CARD_TOOLS.has(tool.id)) return;
    let cancelled = false;

    const generateThumbs = async () => {
      for (const item of files) {
        if (firstPageThumbs[item.id] || !item.pdfJsDoc) continue;
        try {
          const url = await renderPdfPageToDataURL(item.pdfJsDoc, 1, 0.45);
          if (!cancelled) {
            setFirstPageThumbs((prev) => ({ ...prev, [item.id]: url }));
          }
        } catch {
          // Ignore thumbnail failures cleanly
        }
      }
    };
    generateThumbs();
    return () => {
      cancelled = true;
    };
  }, [stage, tool.id, files, firstPageThumbs]);

  // Generate all-page thumbnails for Thumbnail tools
  useEffect(() => {
    if (stage !== 'editor' || !THUMBNAIL_TOOLS.has(tool.id)) return;
    let cancelled = false;

    if (tool.id === 'organizepages') {
      const generateMultiOrg = async () => {
        for (const item of files) {
          if (cancelled) return;
          if (!item.pdfJsDoc || orgThumbnailsByFile[item.id]) continue;
          const urls: string[] = [];
          for (let p = 1; p <= item.pdfJsDoc.numPages; p++) {
            if (cancelled) return;
            urls.push(await renderPdfPageToDataURL(item.pdfJsDoc, p, 0.4));
          }
          if (!cancelled) {
            setOrgThumbnailsByFile((prev) => ({ ...prev, [item.id]: urls }));
          }
        }
        if (pageOrder.length === 0 && files.length > 0 && !cancelled) {
          const initialOrder: PageOrderItem[] = [];
          files.forEach((f, fIdx) => {
            for (let p = 0; p < f.pageCount; p++) {
              initialOrder.push({ fileIndex: fIdx, originalIndex: p, rotation: 0 });
            }
          });
          replaceDocState((prev) =>
            prev.pageOrder.length === 0 ? { ...prev, pageOrder: initialOrder } : prev
          );
        }
      };
      void generateMultiOrg();
      return () => {
        cancelled = true;
      };
    }

    const primaryDoc = files[0]?.pdfJsDoc;
    if (!primaryDoc) return;

    const generateAll = async () => {
      const total = primaryDoc.numPages;
      if (pageThumbnails.length !== total) {
        const urls: string[] = [];
        for (let p = 1; p <= total; p++) {
          urls.push(await renderPdfPageToDataURL(primaryDoc, p, 0.4));
        }
        if (!cancelled) {
          setPageThumbnails(urls);
        }
      }
      if (pageOrder.length === 0) {
        const initialOrder: PageOrderItem[] = [];
        for (let i = 0; i < total; i++) {
          initialOrder.push({ fileIndex: 0, originalIndex: i, rotation: 0 });
        }
        if (!cancelled) {
          replaceDocState((prev) =>
            prev.pageOrder.length === 0 ? { ...prev, pageOrder: initialOrder } : prev
          );
        }
      }
    };
    void generateAll();
    return () => {
      cancelled = true;
    };
  }, [stage, tool.id, files, pageThumbnails.length, orgThumbnailsByFile, pageOrder.length, replaceDocState]);

  // Redraw interactive overlay canvas
  const redrawOverlay = useCallback(() => {
    const overlay = pdfOverlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (tool.id === 'crop') {
      const { top, bottom, left, right } = cropMargins;
      const tPx = (top / 100) * overlay.height;
      const bPx = (bottom / 100) * overlay.height;
      const lPx = (left / 100) * overlay.width;
      const rPx = (right / 100) * overlay.width;
      ctx.fillStyle = 'rgba(229, 50, 45, 0.28)';
      ctx.fillRect(0, 0, overlay.width, tPx);
      ctx.fillRect(0, overlay.height - bPx, overlay.width, bPx);
      ctx.fillRect(0, tPx, lPx, overlay.height - tPx - bPx);
      ctx.fillRect(overlay.width - rPx, tPx, rPx, overlay.height - tPx - bPx);
      ctx.strokeStyle = '#E5322D';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        lPx,
        tPx,
        Math.max(0, overlay.width - lPx - rPx),
        Math.max(0, overlay.height - tPx - bPx)
      );
      ctx.setLineDash([]);
      return;
    }

    const items = annotations[currentCanvasPage] || [];
    for (const item of items) {
      const x = item.rx * overlay.width;
      const y = item.ry * overlay.height;
      const w = item.rw * overlay.width;
      const h = item.rh * overlay.height;
      if (item.type === 'redact') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, w, h);
      } else if (item.type === 'highlight') {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(x, y, w, h);
      } else if (item.type === 'text' && item.text) {
        ctx.font = `bold ${item.size || 18}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = item.color || '#E5322D';
        ctx.fillText(item.text, x, y);
      } else if (item.type === 'sig' && item.imgData) {
        const cached = sigImgCacheRef.current.get(item.imgData);
        if (cached && cached.complete) {
          ctx.drawImage(cached, x, y, w, h);
        } else {
          const img = new Image();
          img.onload = () => {
            sigImgCacheRef.current.set(item.imgData!, img);
            ctx.drawImage(img, x, y, w, h);
          };
          img.src = item.imgData;
        }
      } else if (item.type === 'form-text') {
        ctx.save();
        ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#0369a1';
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(item.fieldName || 'Champ texte', x + 6, y + Math.min(17, h - 5));
        ctx.restore();
      } else if (item.type === 'form-check') {
        ctx.save();
        ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.8;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#0369a1';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('✓', x + 4, y + h - 4);
        ctx.restore();
      } else if (item.type === 'form-select') {
        ctx.save();
        ctx.fillStyle = 'rgba(99, 102, 241, 0.14)';
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#4338ca';
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `${item.fieldName || 'Liste'} ▼`,
          x + 6,
          y + Math.min(18, h - 5)
        );
        ctx.restore();
      }
    }

    // Aperçu fantôme en temps réel sous le curseur pour l'outil Signer PDF
    if (tool.id === 'sign' && signatureDataUrl && hoverPosRef.current) {
      const gx = hoverPosRef.current.x - sigSize / 2;
      const gy = hoverPosRef.current.y - (sigSize * 0.4) / 2;
      const gw = sigSize;
      const gh = sigSize * 0.4;
      const cached = sigImgCacheRef.current.get(signatureDataUrl);
      if (cached && cached.complete) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.drawImage(cached, gx, gy, gw, gh);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(gx, gy, gw, gh);
        ctx.restore();
      } else {
        const img = new Image();
        img.onload = () => {
          sigImgCacheRef.current.set(signatureDataUrl, img);
          redrawOverlay();
        };
        img.src = signatureDataUrl;
      }
    }
  }, [tool.id, cropMargins, annotations, currentCanvasPage, signatureDataUrl, sigSize]);

  // Observe interactive canvas wrapper width for responsive PDF scaling
  useEffect(() => {
    if (stage !== 'editor' || !INTERACTIVE_CANVAS_TOOLS.has(tool.id)) return;
    const container = canvasWrapRef.current;
    if (!container) return;

    const updateWidth = () => {
      const next = Math.round(container.clientWidth);
      if (next > 0) {
        setCanvasWrapWidth((prev) => (Math.abs(prev - next) >= 4 ? next : prev));
      }
    };
    updateWidth();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [stage, tool.id]);

  // Render PDF page onto interactive base canvas
  useEffect(() => {
    if (stage !== 'editor' || !INTERACTIVE_CANVAS_TOOLS.has(tool.id)) return;
    const primaryDoc = files[0]?.pdfJsDoc;
    const baseCanvas = pdfRenderCanvasRef.current;
    const overlayCanvas = pdfOverlayCanvasRef.current;
    if (!primaryDoc || !baseCanvas || !overlayCanvas) return;

    let cancelled = false;
    const renderPage = async () => {
      const page = await primaryDoc.getPage(currentCanvasPage);
      const baseViewport = page.getViewport({ scale: 1 });
      const responsiveScale =
        canvasWrapWidth > 0
          ? Math.max(0.45, Math.min(1.4, (canvasWrapWidth - 12) / baseViewport.width))
          : 1.25;
      const viewport = page.getViewport({ scale: responsiveScale });
      if (cancelled) return;
      baseCanvas.width = Math.ceil(viewport.width);
      baseCanvas.height = Math.ceil(viewport.height);
      overlayCanvas.width = Math.ceil(viewport.width);
      overlayCanvas.height = Math.ceil(viewport.height);
      await page.render({ canvas: baseCanvas, viewport }).promise;
      if (!cancelled) redrawOverlay();
    };
    renderPage();
    return () => {
      cancelled = true;
    };
  }, [stage, tool.id, files, currentCanvasPage, canvasWrapWidth, redrawOverlay]);

  // Redraw overlay whenever annotations or cropMargins change
  useEffect(() => {
    if (stage === 'editor' && INTERACTIVE_CANVAS_TOOLS.has(tool.id)) {
      redrawOverlay();
    }
  }, [stage, tool.id, redrawOverlay]);

  // Render Compare view canvases
  useEffect(() => {
    if (stage !== 'editor' || tool.id !== 'compare') return;
    const doc1 = files[0]?.pdfJsDoc;
    if (!doc1) return;
    let cancelled = false;

    const renderCompare = async () => {
      if (compareCanvas1Ref.current) {
        const page1 = await doc1.getPage(1);
        const vp1 = page1.getViewport({ scale: 0.75 });
        const c1 = compareCanvas1Ref.current;
        c1.width = Math.ceil(vp1.width);
        c1.height = Math.ceil(vp1.height);
        await page1.render({ canvas: c1, viewport: vp1 }).promise;
      }
      if (secondPdfJsDoc && compareCanvas2Ref.current) {
        const page2 = await secondPdfJsDoc.getPage(1);
        const vp2 = page2.getViewport({ scale: 0.75 });
        const c2 = compareCanvas2Ref.current;
        c2.width = Math.ceil(vp2.width);
        c2.height = Math.ceil(vp2.height);
        await page2.render({ canvas: c2, viewport: vp2 }).promise;

        const text1 = await extractFullTextFromPdfJs(doc1);
        const text2 = await extractFullTextFromPdfJs(secondPdfJsDoc);
        if (cancelled) return;

        const identical = text1.trim() === text2.trim();
        if (identical) {
          const summary = `Aucun changement textuel détecté entre les deux documents (${doc1.numPages} vs ${secondPdfJsDoc.numPages} pages).`;
          setCompareDiffLines({
            summary,
            identical: true,
            removed: [],
            added: [],
            plainText: summary,
          });
        } else {
          const lines1 = new Set(
            text1
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
          );
          const lines2 = new Set(
            text2
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
          );
          const removed = [...lines1].filter((x) => !lines2.has(x)).slice(0, 8);
          const added = [...lines2].filter((x) => !lines1.has(x)).slice(0, 8);
          const summary = `Différences détectées (${doc1.numPages} pages vs ${secondPdfJsDoc.numPages} pages) :`;
          const plainText = [
            summary,
            ...removed.map((r) => `- ${r}`),
            ...added.map((a) => `+ ${a}`),
          ].join('\n');
          setCompareDiffLines({
            summary,
            identical: false,
            removed,
            added,
            plainText,
          });
        }
      }
    };
    renderCompare();
    return () => {
      cancelled = true;
    };
  }, [stage, tool.id, files, secondPdfJsDoc]);

  const handleLoadSecondCompare = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const doc = await loadPdfJsDocument(buf);
      setSecondCompareName(file.name);
      setSecondPdfJsDoc(doc);
      onNotify('Second PDF chargé et comparé !', 'success');
    } catch {
      onNotify('Impossible de lire le second fichier PDF.', 'error');
    }
  };

  // Interactive Canvas pointer handlers
  const getOverlayCoords = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
    isTouchEnd = false
  ) => {
    const overlay = pdfOverlayCanvasRef.current!;
    const rect = overlay.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      const touch = isTouchEnd ? e.changedTouches[0] : e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * (overlay.width / rect.width),
      y: (clientY - rect.top) * (overlay.height / rect.height),
    };
  };

  const pushAnnotation = (
    item: Omit<CanvasAnnotation, 'rx' | 'ry' | 'rw' | 'rh'> & {
      x: number;
      y: number;
      w?: number;
      h?: number;
    }
  ) => {
    const overlay = pdfOverlayCanvasRef.current;
    if (!overlay) return;
    const ann: CanvasAnnotation = {
      type: item.type,
      rx: item.x / overlay.width,
      ry: item.y / overlay.height,
      rw: (item.w || 0) / overlay.width,
      rh: (item.h || 0) / overlay.height,
      text: item.text,
      color: item.color,
      size: item.size,
      imgData: item.imgData,
      fieldName: item.fieldName,
      options: item.options,
    };
    docHistory.setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        [currentCanvasPage]: [...(prev.annotations[currentCanvasPage] || []), ann],
      },
    }));
  };

  const handleOverlayStart = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (tool.id === 'crop') return;
    e.preventDefault();
    const pos = getOverlayCoords(e);

    if (tool.id === 'sign') {
      if (!signatureDataUrl) {
        onNotify(
          'Dessinez ou validez d’abord votre signature dans le panneau de droite.',
          'error'
        );
        return;
      }
      pushAnnotation({
        type: 'sig',
        x: pos.x - sigSize / 2,
        y: pos.y - (sigSize * 0.4) / 2,
        w: sigSize,
        h: sigSize * 0.4,
        imgData: signatureDataUrl,
      });
      return;
    }

    if (tool.id === 'editpdf' && editMode === 'text') {
      pushAnnotation({
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: editText.trim() || 'Texte annoté',
        color: editColor,
        size: editFontSize,
      });
      return;
    }

    if (tool.id === 'pdfforms') {
      const cleanName = formFieldName.trim() || 'champ';
      if (formFieldType === 'form-check') {
        pushAnnotation({
          type: 'form-check',
          x: pos.x - 10,
          y: pos.y - 10,
          w: 20,
          h: 20,
          fieldName: cleanName,
        });
      } else if (formFieldType === 'form-select') {
        const parsedOptions = formFieldOptions
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        pushAnnotation({
          type: 'form-select',
          x: pos.x,
          y: pos.y - 14,
          w: 170,
          h: 28,
          fieldName: cleanName,
          options: parsedOptions.length > 0 ? parsedOptions : ['Option A', 'Option B'],
        });
      } else {
        pushAnnotation({
          type: 'form-text',
          x: pos.x,
          y: pos.y - 13,
          w: 170,
          h: 26,
          fieldName: cleanName,
        });
      }
      return;
    }

    drawStateRef.current = {
      isDrawing: true,
      startX: pos.x,
      startY: pos.y,
    };
  };

  const handleOverlayMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (tool.id === 'sign' && signatureDataUrl && !('touches' in e)) {
      hoverPosRef.current = getOverlayCoords(e);
      redrawOverlay();
      return;
    }

    if (!drawStateRef.current.isDrawing) return;
    const overlay = pdfOverlayCanvasRef.current;
    const ctx = overlay?.getContext('2d');
    if (!overlay || !ctx) return;

    const pos = getOverlayCoords(e);
    redrawOverlay();
    const w = pos.x - drawStateRef.current.startX;
    const h = pos.y - drawStateRef.current.startY;
    if (tool.id === 'redact') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(drawStateRef.current.startX, drawStateRef.current.startY, w, h);
    } else if (tool.id === 'editpdf') {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.fillRect(drawStateRef.current.startX, drawStateRef.current.startY, w, h);
    }
  };

  const handleOverlayLeave = (
    e: React.MouseEvent<HTMLCanvasElement>
  ) => {
    if (hoverPosRef.current) {
      hoverPosRef.current = null;
      redrawOverlay();
    }
    handleOverlayEnd(e);
  };

  const handleOverlayEnd = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!drawStateRef.current.isDrawing) return;
    drawStateRef.current.isDrawing = false;
    const pos = getOverlayCoords(e, true);
    const x = Math.min(drawStateRef.current.startX, pos.x);
    const y = Math.min(drawStateRef.current.startY, pos.y);
    const w = Math.abs(pos.x - drawStateRef.current.startX);
    const h = Math.abs(pos.y - drawStateRef.current.startY);
    if (w > 8 && h > 8) {
      if (tool.id === 'redact') {
        pushAnnotation({ type: 'redact', x, y, w, h });
      } else if (tool.id === 'editpdf') {
        pushAnnotation({ type: 'highlight', x, y, w, h });
      }
    } else {
      redrawOverlay();
    }
  };

  const handleOverlayCancel = () => {
    if (drawStateRef.current.isDrawing) {
      drawStateRef.current.isDrawing = false;
      redrawOverlay();
    }
  };

  // Start Webcam scanner
  const startWebcamScanner = async () => {
    setStage('editor');
    setWebcamFailed(false);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        webcamStreamRef.current = stream;
        setWebcamActive(true);
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        });
      } catch {
        setWebcamActive(false);
        setWebcamFailed(true);
      }
    } else {
      setWebcamActive(false);
      setWebcamFailed(true);
    }
  };

  const captureWebcamFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      onNotify('Flux caméra non prêt. Importez une image à la place.', 'error');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    docHistory.setState((prev) => ({
      ...prev,
      scannedImages: [...prev.scannedImages, dataUrl],
    }));
    onNotify('Page capturée !', 'success');
  };

  // Thumbnail actions
  const toggleSelectedPage = (idx: number) => {
    if (tool.id === 'removepages' || tool.id === 'extractpages') {
      docHistory.setState((prev) => {
        const next = new Set(prev.selectedPages);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return { ...prev, selectedPages: Array.from(next) };
      });
    } else if (tool.id === 'rotate') {
      docHistory.setState((prev) => ({
        ...prev,
        pageRotations: {
          ...prev.pageRotations,
          [idx]: ((prev.pageRotations[idx] || 0) + 90) % 360,
        },
      }));
    }
  };

  const rotateAllPages = (deg: number) => {
    docHistory.setState((prev) => {
      const next: Record<number, number> = {};
      for (let i = 0; i < pageThumbnails.length; i++) {
        next[i] = ((prev.pageRotations[i] || 0) + deg) % 360;
      }
      return { ...prev, pageRotations: next };
    });
  };

  const moveOrgPage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= pageOrder.length) return;
    docHistory.setState((prev) => {
      if (target < 0 || target >= prev.pageOrder.length) return prev;
      const copy = [...prev.pageOrder];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return { ...prev, pageOrder: copy };
    });
  };

  const duplicateOrgPage = (idx: number) => {
    docHistory.setState((prev) => {
      const copy = [...prev.pageOrder];
      copy.splice(idx + 1, 0, { ...copy[idx] });
      return { ...prev, pageOrder: copy };
    });
  };

  const deleteOrgPage = (idx: number) => {
    if (pageOrder.length <= 1) {
      onNotify('Un document doit conserver au moins une page.', 'error');
      return;
    }
    docHistory.setState((prev) => {
      if (prev.pageOrder.length <= 1) return prev;
      return {
        ...prev,
        pageOrder: prev.pageOrder.filter((_, i) => i !== idx),
      };
    });
  };

  const rotateOrgPage = (idx: number) => {
    docHistory.setState((prev) => {
      const copy = [...prev.pageOrder];
      const item = copy[idx];
      if (!item) return prev;
      copy[idx] = { ...item, rotation: (item.rotation + 90) % 360 };
      return { ...prev, pageOrder: copy };
    });
  };

  const removeOrgSourceFile = (removeIdx: number) => {
    if (files.length <= 1) {
      resetWorkspace();
      return;
    }
    if (orgFileFilter === removeIdx) {
      setOrgFileFilter('all');
    } else if (typeof orgFileFilter === 'number' && orgFileFilter > removeIdx) {
      setOrgFileFilter(orgFileFilter - 1);
    }
    docHistory.setState((prev) => {
      const nextFiles = prev.files.filter((_, i) => i !== removeIdx);
      const nextOrder = prev.pageOrder
        .filter((p) => (p.fileIndex ?? 0) !== removeIdx)
        .map((p) => ({
          ...p,
          fileIndex: (p.fileIndex ?? 0) > removeIdx ? (p.fileIndex ?? 0) - 1 : (p.fileIndex ?? 0),
        }));
      const ensuredOrder: PageOrderItem[] =
        nextOrder.length > 0
          ? nextOrder
          : nextFiles.flatMap((f, fIdx) =>
              Array.from({ length: f.pageCount }, (_, p) => ({
                fileIndex: fIdx,
                originalIndex: p,
                rotation: 0,
              }))
            );
      return {
        ...prev,
        files: nextFiles,
        pageOrder: ensuredOrder,
      };
    });
  };

  const reorderOrgPage = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    docHistory.setState((prev) => {
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= prev.pageOrder.length ||
        toIdx >= prev.pageOrder.length
      ) {
        return prev;
      }
      const copy = [...prev.pageOrder];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return { ...prev, pageOrder: copy };
    });
  };

  const moveOrgSourceFile = (fileIdx: number, dir: -1 | 1) => {
    const targetIdx = fileIdx + dir;
    if (targetIdx < 0 || targetIdx >= files.length) return;
    if (orgFileFilter === fileIdx) setOrgFileFilter(targetIdx);
    else if (orgFileFilter === targetIdx) setOrgFileFilter(fileIdx);

    docHistory.setState((prev) => {
      if (targetIdx < 0 || targetIdx >= prev.files.length) return prev;
      const nextFiles = [...prev.files];
      [nextFiles[fileIdx], nextFiles[targetIdx]] = [
        nextFiles[targetIdx],
        nextFiles[fileIdx],
      ];

      const remappedOrder = prev.pageOrder.map((item) => {
        const cur = item.fileIndex ?? 0;
        if (cur === fileIdx) return { ...item, fileIndex: targetIdx };
        if (cur === targetIdx) return { ...item, fileIndex: fileIdx };
        return item;
      });

      const groupedOrder: PageOrderItem[] = [];
      for (let i = 0; i < nextFiles.length; i++) {
        groupedOrder.push(...remappedOrder.filter((p) => (p.fileIndex ?? 0) === i));
      }

      return {
        ...prev,
        files: nextFiles,
        pageOrder: groupedOrder,
      };
    });
  };

  const groupOrgPagesByFile = () => {
    docHistory.setState((prev) => {
      const grouped: PageOrderItem[] = [];
      for (let i = 0; i < prev.files.length; i++) {
        grouped.push(...prev.pageOrder.filter((p) => (p.fileIndex ?? 0) === i));
      }
      return { ...prev, pageOrder: grouped };
    });
  };

  const sortOrgFilesAlphabetically = () => {
    setOrgFileFilter('all');
    docHistory.setState((prev) => {
      const indexed = prev.files.map((f, oldIdx) => ({ f, oldIdx }));
      indexed.sort((a, b) => a.f.name.localeCompare(b.f.name, 'fr'));
      const oldToNew = new Map<number, number>();
      indexed.forEach((entry, newIdx) => oldToNew.set(entry.oldIdx, newIdx));

      const nextFiles = indexed.map((e) => e.f);
      const remapped = prev.pageOrder.map((p) => ({
        ...p,
        fileIndex: oldToNew.get(p.fileIndex ?? 0) ?? 0,
      }));
      const grouped: PageOrderItem[] = [];
      for (let i = 0; i < nextFiles.length; i++) {
        grouped.push(...remapped.filter((p) => (p.fileIndex ?? 0) === i));
      }
      return {
        ...prev,
        files: nextFiles,
        pageOrder: grouped,
      };
    });
  };

  const reverseOrgPages = () => {
    docHistory.setState((prev) => ({
      ...prev,
      pageOrder: [...prev.pageOrder].reverse(),
    }));
  };

  const rotateAllOrgPages = () => {
    docHistory.setState((prev) => ({
      ...prev,
      pageOrder: prev.pageOrder.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      })),
    }));
  };

  // Execute tool action
  const handleExecute = async () => {
    const rawFiles = files.map((f) => f.file);
    let shouldApplyWatermark = isWatermarked;

    if (checkUserQuota) {
      const quotaRes = checkUserQuota({
        tool,
        files: rawFiles,
        compressLevel,
      });
      if (!quotaRes.allowed) {
        onQuotaBlocked?.(quotaRes);
        return;
      }
      shouldApplyWatermark = quotaRes.isWatermarked;
    }

    if (tool.id === 'sign') {
      const totalPlaced = Object.values(annotations).reduce(
        (sum, list) => sum + list.length,
        0
      );
      if (totalPlaced === 0) {
        onNotify(
          'Créez puis cliquez sur la page PDF pour placer au moins une signature.',
          'error'
        );
        return;
      }
    }

    setStage('processing');
    setProgress(30);
    onGlobalProgress?.(30, `Traitement en cours (${tool.title})...`);

    try {
      await new Promise((r) => setTimeout(r, 150));
      setProgress(65);
      onGlobalProgress?.(65, 'Exécution des opérations PDF...');

      const execRes: ExecutionResult = await executePdfTool({
        toolId: tool.id,
        files,
        pdfJsDoc: files[0]?.pdfJsDoc || null,
        selectedPages,
        pageOrder,
        pageRotations,
        annotations,
        cropMargins,
        scannedImages,
        options: {
          mergeName,
          splitMode,
          splitRanges,
          extractFormat,
          scanFilter,
          compressLevel,
          compressQuality,
          compressGrayscale,
          compressStripMetadata,
          ocrOutput,
          jpgOrient,
          jpgMargin,
          htmlCode,
          pdf2jpgScale,
          numPos,
          numFmt,
          wmText,
          wmColor,
          wmAngle,
          wmOpacity,
          protectPwd,
          protectStamp,
          compareDiffText:
            compareDiffLines?.plainText ||
            'Chargez un second document PDF pour lancer la comparaison automatique.',
          summaryStyle,
          summaryOutput,
          translateTargetLang,
          aiOcrLang,
          aiOcrOutput,
          workflowSteps,
          stampShape,
          stampTextTop,
          stampCenterText,
          stampTextBottom,
          stampColor,
          stampOpacity,
          stampPosition,
          stampPageMode,
        },
        onProgress: (pct) => {
          setProgress(pct);
          onGlobalProgress?.(pct, `Traitement en cours... (${pct}%)`);
        },
      });

      const finalBlob = shouldApplyWatermark
        ? await applyFreeTierPdfFooter(execRes.blob)
        : execRes.blob;

      setProgress(100);
      onGlobalProgress?.(100, 'Finalisation et compression...');
      await new Promise((r) => setTimeout(r, 150));

      const sizeFormatted = formatBytes(finalBlob.size);
      const url = URL.createObjectURL(finalBlob);
      setResult((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return {
          url,
          blob: finalBlob,
          fileName: execRes.fileName,
          sizeFormatted,
          btnText: execRes.btnText,
          statsHtml: execRes.statsHtml,
        };
      });
      await onQuotaConsumed?.(tool.id, rawFiles);
      onFileProcessed({
        fileName: execRes.fileName,
        toolId: tool.id,
        toolTitle: tool.title,
        sizeFormatted,
      });
      setStage('result');
      onNotify('Traitement terminé avec succès !', 'success');
      onGlobalProgress?.(null);
    } catch (err) {
      onGlobalProgress?.(null);
      const message =
        err instanceof Error ? err.message : 'Erreur lors du traitement du fichier.';
      onNotify(message, 'error');
      setStage('editor');
    }
  };

  const totalInteractivePages = files[0]?.pdfJsDoc?.numPages || 1;
  const isReorderable = tool.id === 'merge' || tool.id === 'jpg2pdf';

  return (
    <section className="flex-grow flex flex-col">
      {/* Barre supérieure contextuelle */}
      <div className="bg-white dark:bg-brand-cardDark border-b border-neutral-200 dark:border-brand-borderDark px-3 sm:px-6 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            revokeUrls(files, result?.url);
            stopWebcam();
            onGoHome();
          }}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-1.5 text-xs sm:text-sm font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden min-[380px]:inline">Tous les outils</span>
          <span className="min-[380px]:hidden">Retour</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${tool.color}`}
          >
            <ToolIcon name={tool.icon} className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-extrabold text-neutral-900 dark:text-white leading-tight truncate">
              {tool.title}
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium truncate hidden sm:block">
              {tool.catLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          {stage === 'editor' && HISTORY_ENABLED_TOOLS.has(tool.id) && (
            <div className="inline-flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 p-0.5">
              <button
                type="button"
                disabled={!canUndo}
                onClick={handleUndo}
                title="Annuler (Ctrl+Z)"
                aria-label="Annuler (Ctrl+Z)"
                className="h-9 min-w-[36px] px-2 sm:px-2.5 rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-700 hover:text-brand-red disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-700 dark:disabled:hover:text-neutral-200 transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <Undo2 className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Annuler</span>
              </button>
              <div
                className="w-px h-4 bg-neutral-200 dark:bg-neutral-700"
                aria-hidden="true"
              />
              <button
                type="button"
                disabled={!canRedo}
                onClick={handleRedo}
                title="Rétablir (Ctrl+Y)"
                aria-label="Rétablir (Ctrl+Y)"
                className="h-9 min-w-[36px] px-2 sm:px-2.5 rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-700 hover:text-brand-red disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neutral-700 dark:disabled:hover:text-neutral-200 transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <Redo2 className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Rétablir</span>
              </button>
            </div>
          )}
          {stage !== 'dropzone' && (
            <button
              type="button"
              onClick={resetWorkspace}
              className="min-h-[36px] px-2 text-xs font-bold text-brand-red hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </button>
          )}
        </div>
      </div>

      {/* Inputs cachés */}
      <input
        ref={fileInputRef}
        type="file"
        accept={tool.accept}
        multiple={tool.multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleIncomingFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />
      <input
        ref={secondCompareInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleLoadSecondCompare(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      <AnimatePresence mode="wait">
      {/* ÉTAT 1 : ÉCRAN D'IMPORTATION (DROPZONE) */}
      {stage === 'dropzone' && (
        <motion.div
          key="stage-dropzone"
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.99 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="flex-grow flex flex-col items-center justify-center p-3 sm:p-6 text-center"
        >
          <div className="w-full max-w-2xl bg-white dark:bg-brand-cardDark border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-3xl p-5 sm:p-10 lg:p-14 shadow-sm relative overflow-hidden">
            <AnimatePresence>
              {isLoadingFiles && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 z-20 bg-white/85 dark:bg-brand-cardDark/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-10 h-10 border-4 border-red-200 dark:border-red-900 border-t-brand-red rounded-full animate-spin" />
                  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                    Chargement des fichiers en cours...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <div
              className={`w-20 h-20 rounded-2xl ${tool.badge} flex items-center justify-center mx-auto mb-6`}
            >
              <ToolIcon name={tool.icon} className="w-10 h-10" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-3 [text-wrap:balance]">
              {tool.title}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-lg mx-auto text-sm sm:text-base">
              {tool.desc}
            </p>

            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand-red hover:bg-brand-redHover text-white font-bold text-base sm:text-lg px-8 py-4 rounded-2xl shadow-lg shadow-red-500/20 hover:shadow-red-500/35 transition-all inline-flex items-center gap-3"
              >
                <FilePlus className="w-5 h-5" />
                <span>{tool.btnText}</span>
              </button>
              <p className="mt-4 text-xs text-neutral-400">
                ou glissez-déposez vos fichiers n’importe où sur la fenêtre
              </p>
              <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
                <span>Max {maxFileMb} Mo / fichier</span>
                <span>·</span>
                <span>
                  {tool.id === 'organizepages'
                    ? `Max ${MAX_ORG_FILES} fichiers PDF`
                    : maxBatchFiles >= 999
                    ? 'Lots illimités'
                    : `Max ${maxBatchFiles} fichier(s)`}
                </span>
                {dailyLimit !== null && remainingTasks !== null && (
                  <>
                    <span>·</span>
                    <span className={remainingTasks === 0 ? 'text-brand-red font-extrabold' : ''}>
                      {remainingTasks}/{dailyLimit} tâches restantes
                    </span>
                  </>
                )}
              </div>
              {onImportFromGmail && tool.accept.includes('.pdf') && (
                <button
                  type="button"
                  onClick={onImportFromGmail}
                  className="mt-4 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/70 hover:border-brand-red text-xs font-bold text-neutral-700 dark:text-neutral-200 inline-flex items-center gap-2 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-brand-red" />
                  <span>Importer une pièce jointe PDF depuis Gmail</span>
                </button>
              )}
            </div>

            {tool.id === 'html2pdf' && (
              <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStage('editor')}
                  className="text-sm font-bold text-brand-red hover:underline inline-flex items-center gap-1.5"
                >
                  <Code className="w-4 h-4" />
                  <span>Ou saisir / coller directement du code HTML</span>
                </button>
              </div>
            )}

            {tool.id === 'scan2pdf' && (
              <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={startWebcamScanner}
                  className="bg-neutral-900 dark:bg-neutral-700 hover:bg-black text-white font-bold text-sm px-6 py-3 rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Aperture className="w-4 h-4" />
                  <span>Ouvrir la caméra / Webcam</span>
                </button>
              </div>
            )}

            {tool.id === 'socialpost' && (
              <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setStage('editor')}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm px-6 py-3 rounded-xl inline-flex items-center gap-2 transition-colors shadow-md shadow-pink-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Créer directement un post sans importer de PDF</span>
                </button>
              </div>
            )}
          </div>
          {!effectiveAdFree && getAdSenseSlotId('workspace') && (
            <AdSenseBanner
              placement="workspace"
              isAdFree={effectiveAdFree}
              onUpgradeClick={onOpenPricing}
              className="w-full max-w-2xl mt-5 text-left"
            />
          )}
        </motion.div>
      )}

      {/* ÉTAT 2 : ESPACE DE CONFIGURATION EN 2 COLONNES */}
      {stage === 'editor' && (
        <motion.div
          key="stage-editor"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className={
            tool.id === 'socialpost'
              ? 'flex-grow flex flex-col lg:flex-row overflow-x-clip'
              : 'flex-grow flex flex-col lg:grid lg:grid-cols-12 lg:items-start w-full overflow-x-clip'
          }
        >
          {tool.id === 'socialpost' ? (
            <SocialPostStudio
              loadedFile={files[0] || null}
              onNotify={onNotify}
              onExportRecorded={(fileName, sizeFormatted) => {
                void onQuotaConsumed?.(
                  tool.id,
                  files.map((f) => f.file)
                );
                onFileProcessed({
                  fileName,
                  toolId: tool.id,
                  toolTitle: tool.title,
                  sizeFormatted,
                });
              }}
            />
          ) : (
            <>
          {/* Colonne Principale Gauche */}
          <div className="w-full lg:col-span-8 min-w-0 p-3 sm:p-6 lg:p-8 bg-brand-bgLight dark:bg-brand-bgDark">
            {/* Barre d'info fichiers & ajout */}
            {tool.id !== 'scan2pdf' && tool.id !== 'html2pdf' && (
              <div className="max-w-6xl mx-auto mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm font-bold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-brand-cardDark px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark tabular-nums">
                    {files.length} {files.length > 1 ? 'fichiers' : 'fichier'}
                    {tool.id === 'organizepages' ? ` / ${MAX_ORG_FILES}` : ''}
                    {files.length > 0
                      ? ` · ${formatBytes(
                          files.reduce((sum, f) => sum + f.sizeBytes, 0)
                        )}`
                      : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {tool.id === 'compare' && (
                    <button
                      type="button"
                      onClick={() => secondCompareInputRef.current?.click()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
                    >
                      <FileDiff className="w-4 h-4" />
                      <span>Charger le 2ᵉ PDF à comparer</span>
                    </button>
                  )}
                  {tool.multiple && (
                    <button
                      type="button"
                      disabled={tool.id === 'organizepages' && files.length >= MAX_ORG_FILES}
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-brand-red hover:bg-brand-redHover disabled:opacity-45 disabled:pointer-events-none text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {tool.id === 'organizepages' && files.length >= MAX_ORG_FILES
                          ? `Limite (${MAX_ORG_FILES}/${MAX_ORG_FILES})`
                          : 'Ajouter des fichiers'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 2A: Grille des fichiers */}
            {FILE_CARD_TOOLS.has(tool.id) && (
              <div className="max-w-6xl mx-auto grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                <AnimatePresence>
                  {files.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -6 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-white dark:bg-brand-cardDark rounded-2xl p-4 border border-neutral-200 dark:border-brand-borderDark flex flex-col justify-between relative"
                    >
                    <button
                      type="button"
                      onClick={() => {
                        const next = files.filter((f) => f.id !== item.id);
                        if (next.length === 0) {
                          resetWorkspace();
                        } else {
                          docHistory.setState((prev) => ({
                            ...prev,
                            files: prev.files.filter((f) => f.id !== item.id),
                          }));
                        }
                      }}
                      aria-label={`Retirer ${item.name}`}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md hover:bg-red-700 transition-colors z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="h-40 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 flex items-center justify-center overflow-hidden mb-3 relative">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-full w-full object-contain p-2"
                        />
                      ) : firstPageThumbs[item.id] ? (
                        <img
                          src={firstPageThumbs[item.id]}
                          alt={item.name}
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <FileSpreadsheet className="w-12 h-12 text-brand-red" />
                      )}
                      <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/75 text-white tabular-nums">
                        {item.pageCount} p.
                      </span>
                    </div>
                    <p
                      className="text-xs font-bold text-neutral-800 dark:text-neutral-100 truncate text-center"
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    <p className="text-[11px] text-neutral-400 text-center mt-0.5 tabular-nums">
                      {item.sizeFormatted}
                    </p>

                    {isReorderable && files.length > 1 && (
                      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            docHistory.setState((prev) => {
                              if (idx <= 0 || idx >= prev.files.length) return prev;
                              const copy = [...prev.files];
                              [copy[idx], copy[idx - 1]] = [
                                copy[idx - 1],
                                copy[idx],
                              ];
                              return { ...prev, files: copy };
                            });
                          }}
                          className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 disabled:opacity-30 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-neutral-400 tabular-nums">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={idx === files.length - 1}
                          onClick={() => {
                            docHistory.setState((prev) => {
                              if (idx < 0 || idx >= prev.files.length - 1) return prev;
                              const copy = [...prev.files];
                              [copy[idx], copy[idx + 1]] = [
                                copy[idx + 1],
                                copy[idx],
                              ];
                              return { ...prev, files: copy };
                            });
                          }}
                          className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 disabled:opacity-30 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
            )}

            {/* 2B: Grille des pages rendues via PDF.js */}
            {THUMBNAIL_TOOLS.has(tool.id) && (
              <div className="max-w-6xl mx-auto">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-white dark:bg-brand-cardDark p-3.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark">
                  <p className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                    {tool.id === 'removepages' &&
                      `Cliquez sur les pages à supprimer (${selectedPages.size} sélectionnée(s)) :`}
                    {tool.id === 'extractpages' &&
                      `Sélectionnez les pages à extraire (${selectedPages.size} sélectionnée(s)) :`}
                    {tool.id === 'organizepages' &&
                      `Réorganisez, dupliquez ou supprimez les pages (${pageOrder.length} pages) :`}
                    {tool.id === 'rotate' &&
                      'Cliquez sur une page pour la faire pivoter individuellement (+90°) :'}
                  </p>
                  <div className="flex items-center gap-3">
                    {tool.id === 'removepages' && (
                      <button
                        type="button"
                        onClick={() =>
                          docHistory.setState((prev) => ({
                            ...prev,
                            selectedPages: [],
                          }))
                        }
                        className="text-xs font-bold text-neutral-500 hover:text-brand-red"
                      >
                        Tout désélectionner
                      </button>
                    )}
                    {tool.id === 'extractpages' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            docHistory.setState((prev) => ({
                              ...prev,
                              selectedPages: pageThumbnails.map((_, idx) => idx),
                            }))
                          }
                          className="text-xs font-bold text-brand-red hover:underline"
                        >
                          Tout sélectionner
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            docHistory.setState((prev) => ({
                              ...prev,
                              selectedPages: [],
                            }))
                          }
                          className="text-xs font-bold text-neutral-500"
                        >
                          Effacer
                        </button>
                      </>
                    )}
                    {tool.id === 'organizepages' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {files.length > 1 && (
                          <select
                            aria-label="Filtrer par fichier"
                            value={orgFileFilter === 'all' ? 'all' : String(orgFileFilter)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOrgFileFilter(val === 'all' ? 'all' : Number(val));
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 max-w-[190px]"
                          >
                            <option value="all">
                              Tous les fichiers ({pageOrder.length} p.)
                            </option>
                            {files.map((f, i) => (
                              <option key={f.id} value={String(i)}>
                                F{i + 1} · {f.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {files.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={sortOrgFilesAlphabetically}
                              title="Trier les fichiers de A à Z"
                              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:border-brand-red text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                            >
                              Trier A→Z
                            </button>
                            <button
                              type="button"
                              onClick={groupOrgPagesByFile}
                              title="Regrouper les pages par fichier"
                              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:border-brand-red text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                            >
                              Grouper
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={reverseOrgPages}
                          title="Inverser l’ordre de toutes les pages"
                          className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:border-brand-red text-xs font-semibold text-neutral-700 dark:text-neutral-200 transition-colors"
                        >
                          Inverser
                        </button>
                        <button
                          type="button"
                          onClick={rotateAllOrgPages}
                          title="Pivoter toutes les pages de 90°"
                          className="px-2.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold transition-colors"
                        >
                          +90° Tout
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOrgFileFilter('all');
                            const resetOrder: PageOrderItem[] = [];
                            files.forEach((f, fIdx) => {
                              for (let p = 0; p < f.pageCount; p++) {
                                resetOrder.push({ fileIndex: fIdx, originalIndex: p, rotation: 0 });
                              }
                            });
                            docHistory.setState((prev) => ({
                              ...prev,
                              pageOrder: resetOrder,
                            }));
                          }}
                          className="text-xs font-bold text-neutral-500 hover:text-brand-red px-1.5"
                        >
                          Réinitialiser
                        </button>
                      </div>
                    )}
                    {tool.id === 'rotate' && (
                      <button
                        type="button"
                        onClick={() => rotateAllPages(90)}
                        className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg"
                      >
                        +90° Tout le document
                      </button>
                    )}
                  </div>
                </div>

                {tool.id === 'organizepages' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {pageOrder.map((entry, idx) => {
                      const fIdx = entry.fileIndex ?? 0;
                      if (orgFileFilter !== 'all' && fIdx !== orgFileFilter) {
                        return null;
                      }
                      const sourceFile = files[fIdx];
                      const thumbUrl = sourceFile
                        ? orgThumbnailsByFile[sourceFile.id]?.[entry.originalIndex]
                        : undefined;
                      const dotColor = ORG_FILE_DOT_COLORS[fIdx % ORG_FILE_DOT_COLORS.length];
                      const isDragging = draggedPageIdx === idx;
                      const isDragOver = dragOverPageIdx === idx && draggedPageIdx !== idx;

                      return (
                        <div
                          key={`${fIdx}-${entry.originalIndex}-${idx}`}
                          draggable
                          onDragStart={(e) => {
                            setDraggedPageIdx(idx);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(idx));
                          }}
                          onDragOver={(e) => {
                            if (Array.from(e.dataTransfer.types || []).includes('Files')) {
                              return;
                            }
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverPageIdx !== idx) {
                              setDragOverPageIdx(idx);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverPageIdx === idx) {
                              setDragOverPageIdx(null);
                            }
                          }}
                          onDrop={(e) => {
                            if (Array.from(e.dataTransfer.types || []).includes('Files')) {
                              return;
                            }
                            e.preventDefault();
                            const rawFrom = e.dataTransfer.getData('text/plain');
                            const from =
                              draggedPageIdx !== null
                                ? draggedPageIdx
                                : rawFrom !== ''
                                ? Number(rawFrom)
                                : NaN;
                            setDraggedPageIdx(null);
                            setDragOverPageIdx(null);
                            if (Number.isInteger(from)) {
                              reorderOrgPage(from, idx);
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedPageIdx(null);
                            setDragOverPageIdx(null);
                          }}
                          className={`bg-white dark:bg-brand-cardDark rounded-2xl p-3 border flex flex-col items-center cursor-grab active:cursor-grabbing transition-all select-none ${
                            isDragOver
                              ? 'border-brand-red ring-2 ring-brand-red/30 scale-[1.02]'
                              : isDragging
                              ? 'opacity-45 border-neutral-300 dark:border-neutral-600 scale-[0.98]'
                              : 'border-neutral-200 dark:border-brand-borderDark hover:border-neutral-400 dark:hover:border-neutral-600'
                          }`}
                        >
                          <div className="w-full flex items-center justify-between gap-1 mb-1.5 text-[11px] text-neutral-400">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">
                              <GripVertical className="w-3.5 h-3.5 text-neutral-400" />
                              #{idx + 1}
                            </span>
                            {files.length > 1 && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                F{fIdx + 1}
                              </span>
                            )}
                          </div>
                          <div className="w-full h-36 bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden flex items-center justify-center mb-2 relative pointer-events-none">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={`${sourceFile?.name || 'PDF'} - Page ${entry.originalIndex + 1}`}
                                style={{ transform: `rotate(${entry.rotation}deg)` }}
                                className="max-h-full max-w-full object-contain transition-transform"
                              />
                            ) : (
                              <span className="text-[11px] text-neutral-400">Aperçu...</span>
                            )}
                          </div>
                          {files.length > 1 && sourceFile && (
                            <span
                              className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 truncate max-w-full mb-0.5"
                              title={sourceFile.name}
                            >
                              {sourceFile.name}
                            </span>
                          )}
                          <span className="text-xs font-bold mb-2 tabular-nums">
                            Page {entry.originalIndex + 1}
                            {entry.rotation ? ` (${entry.rotation}°)` : ''}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveOrgPage(idx, -1)}
                              title="Déplacer avant"
                              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 disabled:opacity-30"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => rotateOrgPage(idx)}
                              title="Pivoter +90°"
                              className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateOrgPage(idx)}
                              title="Dupliquer"
                              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteOrgPage(idx)}
                              title="Supprimer"
                              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === pageOrder.length - 1}
                              onClick={() => moveOrgPage(idx, 1)}
                              title="Déplacer après"
                              className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 disabled:opacity-30"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {pageThumbnails.map((thumb, idx) => {
                      const isSelected = selectedPages.has(idx);
                      const rot = pageRotations[idx] || 0;
                      const borderClass = isSelected
                        ? tool.id === 'removepages'
                          ? 'border-red-600 bg-red-50/70 dark:bg-red-950/30'
                          : 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-brand-cardDark hover:border-neutral-400';

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleSelectedPage(idx)}
                          className={`cursor-pointer rounded-2xl p-3 border-2 transition-all flex flex-col items-center relative text-left ${borderClass}`}
                        >
                          <div className="w-full h-40 bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden flex items-center justify-center mb-2 relative">
                            <img
                              src={thumb}
                              alt={`Page ${idx + 1}`}
                              style={{ transform: `rotate(${rot}deg)` }}
                              className="max-h-full max-w-full object-contain transition-transform"
                            />
                            {isSelected && tool.id === 'removepages' && (
                              <div className="absolute inset-0 bg-red-600/35 flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-white drop-shadow" />
                              </div>
                            )}
                            {isSelected && tool.id === 'extractpages' && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                <Check className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between w-full text-xs font-bold tabular-nums">
                            <span>Page {idx + 1}</span>
                            {tool.id === 'rotate' && (
                              <span className="text-purple-600 dark:text-purple-400">
                                {rot}°
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2C: Éditeur Interactif sur Canvas PDF */}
            {INTERACTIVE_CANVAS_TOOLS.has(tool.id) && (
              <div
                ref={canvasWrapRef}
                className="max-w-5xl mx-auto w-full flex flex-col items-center"
              >
                <div className="w-full bg-white dark:bg-brand-cardDark p-3 rounded-xl border border-neutral-200 dark:border-brand-borderDark mb-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentCanvasPage <= 1}
                      onClick={() =>
                        setCurrentCanvasPage((p) => Math.max(1, p - 1))
                      }
                      aria-label="Page précédente"
                      className="min-w-[40px] min-h-[40px] p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs sm:text-sm font-bold px-2 tabular-nums">
                      Page {currentCanvasPage} / {totalInteractivePages}
                    </span>
                    <button
                      type="button"
                      disabled={currentCanvasPage >= totalInteractivePages}
                      onClick={() =>
                        setCurrentCanvasPage((p) =>
                          Math.min(totalInteractivePages, p + 1)
                        )
                      }
                      aria-label="Page suivante"
                      className="min-w-[40px] min-h-[40px] p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {tool.id === 'sign' &&
                      'Créez votre signature ci-dessous / à droite puis touchez la page'}
                    {tool.id === 'redact' &&
                      'Glissez sur la page pour tracer une zone de caviardage noir opaque'}
                    {tool.id === 'editpdf' &&
                      'Touchez la page pour ajouter du texte ou tracez un surlignage'}
                    {tool.id === 'crop' &&
                      'Ajustez les marges de rognage dans le panneau d’options'}
                    {tool.id === 'pdfforms' &&
                      'Choisissez le type de champ puis touchez la page pour l’ajouter'}
                  </p>
                  {tool.id !== 'crop' && (
                    <div className="flex items-center gap-3">
                      {(annotations[currentCanvasPage]?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            docHistory.setState((prev) => ({
                              ...prev,
                              annotations: {
                                ...prev.annotations,
                                [currentCanvasPage]: (
                                  prev.annotations[currentCanvasPage] || []
                                ).slice(0, -1),
                              },
                            }))
                          }
                          className="text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-brand-red min-h-[36px] px-1"
                        >
                          Annuler le dernier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          docHistory.setState((prev) => ({
                            ...prev,
                            annotations: {
                              ...prev.annotations,
                              [currentCanvasPage]: [],
                            },
                          }))
                        }
                        className="text-xs font-bold text-red-600 hover:underline min-h-[36px] px-1"
                      >
                        Effacer cette page
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative bg-white shadow-2xl border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden select-none max-w-full">
                  <canvas
                    ref={pdfRenderCanvasRef}
                    className="block max-w-full h-auto"
                  />
                  <canvas
                    ref={pdfOverlayCanvasRef}
                    onMouseDown={handleOverlayStart}
                    onMouseMove={handleOverlayMove}
                    onMouseUp={handleOverlayEnd}
                    onMouseLeave={handleOverlayLeave}
                    onTouchStart={handleOverlayStart}
                    onTouchMove={handleOverlayMove}
                    onTouchEnd={handleOverlayEnd}
                    onTouchCancel={handleOverlayCancel}
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  />
                </div>
              </div>
            )}

            {/* 2D: Scanner Webcam */}
            {tool.id === 'scan2pdf' && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-brand-cardDark rounded-2xl p-5 border border-neutral-200 dark:border-brand-borderDark text-center">
                  <div className="relative rounded-xl overflow-hidden bg-black max-h-[420px] flex items-center justify-center mx-auto">
                    {webcamActive ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="max-h-[420px] w-auto"
                      />
                    ) : (
                      <div className="p-8 text-white text-sm">
                        {webcamFailed
                          ? 'Caméra indisponible ou permission refusée. Utilisez le bouton ci-dessous pour importer une photo.'
                          : 'Importez des photos de documents ou activez la caméra pour capturer des pages.'}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    {webcamActive && (
                      <button
                        type="button"
                        onClick={captureWebcamFrame}
                        className="bg-brand-red hover:bg-brand-redHover text-white font-bold px-6 py-3 rounded-xl shadow-md inline-flex items-center gap-2"
                      >
                        <Aperture className="w-5 h-5" />
                        <span>Capturer cette page</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-bold text-sm px-5 py-3 rounded-xl inline-flex items-center gap-2"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>Importer une photo</span>
                    </button>
                  </div>
                </div>
                {scannedImages.length > 0 && (
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {scannedImages.map((url, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-brand-cardDark p-2.5 rounded-xl border border-neutral-200 dark:border-brand-borderDark relative"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            docHistory.setState((prev) => ({
                              ...prev,
                              scannedImages: prev.scannedImages.filter(
                                (_, i) => i !== idx
                              ),
                            }))
                          }
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <img
                          src={url}
                          alt={`Scan ${idx + 1}`}
                          className="h-32 w-full object-contain rounded-lg bg-neutral-100 dark:bg-neutral-800"
                        />
                        <p className="text-xs font-bold text-center mt-1.5 tabular-nums">
                          Scan #{idx + 1}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2E: Éditeur HTML en direct */}
            {tool.id === 'html2pdf' && (
              <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-brand-cardDark rounded-2xl p-4 border border-neutral-200 dark:border-brand-borderDark flex flex-col">
                  <span className="text-xs font-bold uppercase text-neutral-400 mb-2">
                    Code HTML source
                  </span>
                  <textarea
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    rows={16}
                    className="w-full flex-grow font-mono text-xs p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 outline-none focus:border-brand-red"
                  />
                </div>
                <div className="bg-white dark:bg-brand-cardDark rounded-2xl p-4 border border-neutral-200 dark:border-brand-borderDark flex flex-col">
                  <span className="text-xs font-bold uppercase text-neutral-400 mb-2">
                    Aperçu visuel
                  </span>
                  <iframe
                    title="Aperçu HTML"
                    srcDoc={htmlCode}
                    className="w-full flex-grow min-h-[340px] bg-white rounded-xl border border-neutral-200"
                  />
                </div>
              </div>
            )}

            {/* 2F: Comparaison Côte à Côte */}
            {tool.id === 'compare' && (
              <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-brand-cardDark p-4 rounded-2xl border border-neutral-200 dark:border-brand-borderDark">
                    <p className="text-xs font-bold text-brand-red uppercase mb-2 truncate">
                      Document A : {files[0]?.name}
                    </p>
                    <div className="bg-neutral-100 dark:bg-neutral-900 rounded-xl p-2 flex justify-center min-h-[300px]">
                      <canvas
                        ref={compareCanvas1Ref}
                        className="max-w-full h-auto shadow"
                      />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-brand-cardDark p-4 rounded-2xl border border-neutral-200 dark:border-brand-borderDark">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2 truncate">
                      {secondCompareName
                        ? `Document B : ${secondCompareName}`
                        : 'Document B (En attente)'}
                    </p>
                    <div className="bg-neutral-100 dark:bg-neutral-900 rounded-xl p-2 flex flex-col items-center justify-center min-h-[300px]">
                      {!secondPdfJsDoc ? (
                        <button
                          type="button"
                          onClick={() => secondCompareInputRef.current?.click()}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
                        >
                          + Sélectionner le 2ᵉ fichier PDF
                        </button>
                      ) : (
                        <canvas
                          ref={compareCanvas2Ref}
                          className="max-w-full h-auto shadow"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-white dark:bg-brand-cardDark p-5 rounded-2xl border border-neutral-200 dark:border-brand-borderDark">
                  <h4 className="text-sm font-bold mb-2">
                    Analyse comparative du texte :
                  </h4>
                  <div className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1.5 max-h-48 overflow-y-auto font-mono">
                    {!compareDiffLines ? (
                      <span>
                        Chargez un second document PDF pour lancer la comparaison automatique.
                      </span>
                    ) : compareDiffLines.identical ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {compareDiffLines.summary}
                      </span>
                    ) : (
                      <>
                        <p className="font-bold text-amber-600 dark:text-amber-400">
                          {compareDiffLines.summary}
                        </p>
                        {compareDiffLines.removed.map((r, i) => (
                          <div
                            key={`r-${i}`}
                            className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded"
                          >
                            - {r}
                          </div>
                        ))}
                        {compareDiffLines.added.map((a, i) => (
                          <div
                            key={`a-${i}`}
                            className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded"
                          >
                            + {a}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne Latérale Droite : Panneau d'Options */}
          <aside className="w-full lg:col-span-4 lg:sticky lg:top-16 bg-white dark:bg-brand-cardDark border-t lg:border-t-0 lg:border-l border-neutral-200 dark:border-brand-borderDark flex flex-col justify-between z-20 lg:min-h-[calc(100vh-4rem)]">
            <div className="p-4 sm:p-6 overflow-y-auto flex-grow">
              <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 dark:text-white pb-3.5 border-b border-neutral-200 dark:border-brand-borderDark mb-4 sm:mb-5 text-center">
                {tool.title}
              </h2>

              <div className="space-y-4">
                {tool.id === 'merge' && (
                  <>
                    <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-xs">
                      Réorganisez l’ordre des fichiers à gauche avant de lancer la fusion.
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Nom du fichier fusionné
                      </label>
                      <input
                        type="text"
                        value={mergeName}
                        onChange={(e) => setMergeName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                  </>
                )}

                {tool.id === 'split' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Mode de division
                      </label>
                      <select
                        value={splitMode}
                        onChange={(e) =>
                          setSplitMode(e.target.value as 'range' | 'all')
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="range">
                          Plages personnalisées (ex: 1-2, 4)
                        </option>
                        <option value="all">
                          Toutes les pages en fichiers séparés (.ZIP)
                        </option>
                      </select>
                    </div>
                    {splitMode === 'range' && (
                      <div>
                        <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5 tabular-nums">
                          Pages à extraire (Total : {files[0]?.pageCount || 1})
                        </label>
                        <input
                          type="text"
                          value={splitRanges}
                          onChange={(e) => setSplitRanges(e.target.value)}
                          placeholder="ex: 1-3, 5"
                          className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-mono"
                        />
                      </div>
                    )}
                  </>
                )}

                {tool.id === 'removepages' && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 text-xs font-semibold tabular-nums">
                    <strong>{selectedPages.size}</strong> page(s) marquée(s) pour suppression.
                  </div>
                )}

                {tool.id === 'extractpages' && (
                  <>
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 text-xs font-semibold tabular-nums">
                      <strong>{selectedPages.size}</strong> page(s) sélectionnée(s) pour extraction.
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Format de sortie
                      </label>
                      <select
                        value={extractFormat}
                        onChange={(e) =>
                          setExtractFormat(e.target.value as 'single' | 'zip')
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="single">Regrouper dans un seul PDF</option>
                        <option value="zip">Fichiers PDF séparés (.ZIP)</option>
                      </select>
                    </div>
                  </>
                )}

                {tool.id === 'organizepages' && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      Glissez-déposez les miniatures dans la grille pour réorganiser vos pages, ou réordonnez des documents complets ci-dessous (jusqu’à {MAX_ORG_FILES} PDF).
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-neutral-500 tabular-nums">
                          Fichiers chargés ({files.length}/{MAX_ORG_FILES})
                        </span>
                        <button
                          type="button"
                          disabled={files.length >= MAX_ORG_FILES}
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-bold text-brand-red hover:underline disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter PDF</span>
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {files.map((f, fIdx) => {
                          const dotColor = ORG_FILE_DOT_COLORS[fIdx % ORG_FILE_DOT_COLORS.length];
                          return (
                            <div
                              key={f.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`}
                                  title={`Fichier F${fIdx + 1}`}
                                />
                                <div className="min-w-0">
                                  <p
                                    className="font-semibold text-neutral-800 dark:text-neutral-100 truncate"
                                    title={f.name}
                                  >
                                    <span className="font-mono text-[10px] text-neutral-400 mr-1">
                                      F{fIdx + 1}
                                    </span>
                                    {f.name}
                                  </p>
                                  <p className="text-[11px] text-neutral-500 tabular-nums">
                                    {f.pageCount} page{f.pageCount > 1 ? 's' : ''} • {f.sizeFormatted}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {files.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={fIdx === 0}
                                      onClick={() => moveOrgSourceFile(fIdx, -1)}
                                      title="Monter ce PDF"
                                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-25"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={fIdx === files.length - 1}
                                      onClick={() => moveOrgSourceFile(fIdx, 1)}
                                      title="Descendre ce PDF"
                                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-25"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeOrgSourceFile(fIdx)}
                                  title={`Retirer ${f.name}`}
                                  className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {tool.id === 'scan2pdf' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                      Traitement d’image
                    </label>
                    <select
                      value={scanFilter}
                      onChange={(e) =>
                        setScanFilter(e.target.value as 'bw' | 'color')
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                    >
                      <option value="bw">
                        Document Noir & Blanc haute netteté
                      </option>
                      <option value="color">Couleur originale améliorée</option>
                    </select>
                  </div>
                )}

                {tool.id === 'compress' && (() => {
                  const totalBytes = files.reduce(
                    (sum, f) => sum + f.sizeBytes,
                    0
                  );
                  const baseRatio =
                    compressLevel === 'extreme'
                      ? 0.28
                      : compressLevel === 'recommended'
                      ? 0.48
                      : compressLevel === 'low'
                      ? 0.72
                      : 0.88;
                  const qualityFactor =
                    compressLevel === 'lossless'
                      ? 1
                      : Math.max(0.55, Math.min(1.25, compressQuality / 68));
                  const grayFactor = compressGrayscale ? 0.78 : 1;
                  const estBytes = Math.max(
                    1024,
                    Math.round(totalBytes * baseRatio * qualityFactor * grayFactor)
                  );
                  const estRatio = Math.max(
                    5,
                    Math.min(
                      85,
                      Math.round((1 - Math.min(estBytes, totalBytes) / Math.max(1, totalBytes)) * 100)
                    )
                  );

                  return (
                    <div className="space-y-4">
                      {totalBytes > 0 && (
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-600 dark:text-neutral-300">
                              Taille actuelle ({files.length} PDF)
                            </span>
                            <span className="font-extrabold text-neutral-900 dark:text-white tabular-nums">
                              {formatBytes(totalBytes)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">
                              Estimation cible (~-{estRatio}%)
                            </span>
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                              ≈ {formatBytes(Math.min(estBytes, totalBytes))}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-neutral-500">
                          Niveau de compression
                        </label>
                        {(
                          [
                            {
                              val: 'extreme',
                              title: 'Compression Extrême',
                              sub: 'Taille minimale (85 DPI), idéal pour l’envoi rapide.',
                              defaultQuality: 42,
                              isProOnly: true,
                            },
                            {
                              val: 'recommended',
                              title: 'Compression Recommandée',
                              sub: 'Bon équilibre qualité / poids (125 DPI).',
                              defaultQuality: 68,
                              isProOnly: false,
                            },
                            {
                              val: 'low',
                              title: 'Basse Compression',
                              sub: 'Haute netteté préservée (175 DPI).',
                              defaultQuality: 85,
                              isProOnly: false,
                            },
                            {
                              val: 'lossless',
                              title: 'Structurelle (Sans perte)',
                              sub: 'Texte vectoriel intact + flux d’objets compressés.',
                              defaultQuality: 100,
                              isProOnly: false,
                            },
                          ] as const
                        ).map((opt) => {
                          const locked = opt.isProOnly && !isPremiumOrTrial;
                          return (
                            <label
                              key={opt.val}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                compressLevel === opt.val
                                  ? 'border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                                  : locked
                                  ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10 hover:border-amber-400'
                                  : 'border-neutral-200 dark:border-neutral-700 hover:border-emerald-500'
                              }`}
                            >
                              <input
                                type="radio"
                                name="compLevel"
                                checked={compressLevel === opt.val}
                                onChange={() => {
                                  if (locked && checkUserQuota) {
                                    const res = checkUserQuota({
                                      tool,
                                      compressLevel: opt.val,
                                    });
                                    onQuotaBlocked?.(res);
                                    return;
                                  }
                                  setCompressLevel(opt.val);
                                  if (opt.val !== 'lossless') {
                                    setCompressQuality(opt.defaultQuality);
                                  }
                                }}
                                className="mt-1 accent-emerald-600"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    {opt.title}
                                  </p>
                                  {locked && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 text-neutral-900 text-[10px] font-extrabold shrink-0">
                                      <Crown className="w-2.5 h-2.5" />
                                      <Lock className="w-2.5 h-2.5" />
                                      PRO
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-neutral-500">{opt.sub}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {compressLevel !== 'lossless' && (
                        <div className="pt-1 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-600 dark:text-neutral-300">
                              Qualité d’image JPEG
                            </span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {compressQuality}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={25}
                            max={92}
                            value={compressQuality}
                            onChange={(e) =>
                              setCompressQuality(Number(e.target.value))
                            }
                            className="w-full accent-emerald-600"
                          />
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        {compressLevel !== 'lossless' && (
                          <label className="flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={compressGrayscale}
                              onChange={(e) =>
                                setCompressGrayscale(e.target.checked)
                              }
                              className="accent-emerald-600"
                            />
                            <span>Convertir en niveaux de gris (Noir & Blanc)</span>
                          </label>
                        )}
                        <label className="flex items-center gap-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={compressStripMetadata}
                            onChange={(e) =>
                              setCompressStripMetadata(e.target.checked)
                            }
                            className="accent-emerald-600"
                          />
                          <span>Supprimer les métadonnées inutiles (XMP / Auteur)</span>
                        </label>
                      </div>
                    </div>
                  );
                })()}

                {tool.id === 'repair' && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 text-xs leading-relaxed">
                    Le moteur va reconstruire la table XREF, purger les flux invalides et ré-encoder les pages saines.
                  </div>
                )}

                {tool.id === 'ocr' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Langue du document
                      </label>
                      <select
                        value={ocrLang}
                        onChange={(e) => setOcrLang(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="fra">Français</option>
                        <option value="eng">Anglais</option>
                        <option value="spa">Espagnol</option>
                        <option value="ara">Arabe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Format d’export OCR
                      </label>
                      <select
                        value={ocrOutput}
                        onChange={(e) =>
                          setOcrOutput(e.target.value as 'pdf' | 'txt')
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="pdf">
                          PDF consultable avec couche texte
                        </option>
                        <option value="txt">Fichier Texte brut (.TXT)</option>
                      </select>
                    </div>
                  </>
                )}

                {tool.id === 'jpg2pdf' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Orientation
                      </label>
                      <select
                        value={jpgOrient}
                        onChange={(e) =>
                          setJpgOrient(
                            e.target.value as 'portrait' | 'landscape' | 'fit'
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="portrait">Portrait (A4)</option>
                        <option value="landscape">Paysage (A4)</option>
                        <option value="fit">Ajusté à l’image</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Marge
                      </label>
                      <select
                        value={jpgMargin}
                        onChange={(e) => setJpgMargin(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value={0}>Aucune marge</option>
                        <option value={25}>Petite marge</option>
                        <option value={55}>Grande marge</option>
                      </select>
                    </div>
                  </>
                )}

                {tool.id === 'word2pdf' && (
                  <p className="text-xs text-neutral-500">
                    Le texte et les paragraphes de votre document Word (.docx ou .txt) seront extraits et mis en page au format A4.
                  </p>
                )}
                {tool.id === 'ppt2pdf' && (
                  <p className="text-xs text-neutral-500">
                    Chaque diapositive de votre présentation (.pptx) sera convertie en page PDF au format écran large 16:9.
                  </p>
                )}
                {tool.id === 'excel2pdf' && (
                  <p className="text-xs text-neutral-500">
                    Les feuilles et cellules de votre classeur (.xlsx ou .csv) seront rendues sous forme de tableau PDF structuré.
                  </p>
                )}
                {tool.id === 'html2pdf' && (
                  <p className="text-xs text-neutral-500">
                    Modifiez le code HTML à gauche et prévisualisez le rendu avant de générer le PDF.
                  </p>
                )}

                {tool.id === 'pdf2jpg' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                      Qualité de rendu
                    </label>
                    <select
                      value={pdf2jpgScale}
                      onChange={(e) => setPdf2jpgScale(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                    >
                      <option value={1.5}>Standard (150 DPI)</option>
                      <option value={2.5}>Haute qualité (300 DPI)</option>
                    </select>
                  </div>
                )}

                {tool.id === 'pdf2word' && (
                  <p className="text-xs text-neutral-500">
                    Extrait tout le texte structuré page par page et génère un fichier Word (.doc) compatible Microsoft Word et LibreOffice.
                  </p>
                )}
                {tool.id === 'pdf2ppt' && (
                  <p className="text-xs text-neutral-500">
                    Convertit les pages de votre PDF en diapositives de présentation éditables.
                  </p>
                )}
                {tool.id === 'pdf2excel' && (
                  <p className="text-xs text-neutral-500">
                    Analyse les lignes de texte de chaque page pour reconstituer un tableau CSV exploitable dans Excel.
                  </p>
                )}
                {tool.id === 'pdf2pdfa' && (
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                    <strong>Norme ISO 19005-1 (PDF/A-1b)</strong> : Injection des métadonnées d’archivage pérenne et verrouillage de conformité.
                  </div>
                )}

                {tool.id === 'rotate' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => rotateAllPages(90)}
                      className="py-2.5 px-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs"
                    >
                      +90° Droite
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateAllPages(270)}
                      className="py-2.5 px-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs"
                    >
                      -90° Gauche
                    </button>
                  </div>
                )}

                {tool.id === 'pagenumbers' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Position
                      </label>
                      <select
                        value={numPos}
                        onChange={(e) =>
                          setNumPos(
                            e.target.value as
                              | 'bc'
                              | 'br'
                              | 'bl'
                              | 'tc'
                              | 'tr'
                              | 'tl'
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="bc">Bas - Centre</option>
                        <option value="br">Bas - Droite</option>
                        <option value="bl">Bas - Gauche</option>
                        <option value="tc">Haut - Centre</option>
                        <option value="tr">Haut - Droite</option>
                        <option value="tl">Haut - Gauche</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Format
                      </label>
                      <select
                        value={numFmt}
                        onChange={(e) =>
                          setNumFmt(e.target.value as '1' | 'page' | 'total')
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="1">1, 2, 3...</option>
                        <option value="page">Page 1, Page 2...</option>
                        <option value="total">
                          1 / {files[0]?.pageCount || 1}
                        </option>
                      </select>
                    </div>
                  </>
                )}

                {tool.id === 'watermark' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Texte du filigrane
                      </label>
                      <input
                        type="text"
                        value={wmText}
                        onChange={(e) => setWmText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">
                          Couleur
                        </label>
                        <select
                          value={wmColor}
                          onChange={(e) =>
                            setWmColor(
                              e.target.value as 'red' | 'gray' | 'blue'
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs"
                        >
                          <option value="red">Rouge</option>
                          <option value="gray">Gris</option>
                          <option value="blue">Bleu</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">
                          Rotation (°)
                        </label>
                        <input
                          type="number"
                          value={wmAngle}
                          onChange={(e) => setWmAngle(Number(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1 tabular-nums">
                        Opacité ({wmOpacity}%)
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={wmOpacity}
                        onChange={(e) => setWmOpacity(Number(e.target.value))}
                        className="w-full accent-purple-600"
                      />
                    </div>
                  </>
                )}

                {tool.id === 'stampgenerator' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Forme du cachet
                      </label>
                      <select
                        value={stampShape}
                        onChange={(e) => setStampShape(e.target.value as 'circle' | 'rectangle' | 'badge')}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-bold"
                      >
                        <option value="circle">Circulaire (Classique)</option>
                        <option value="rectangle">Rectangulaire</option>
                        <option value="badge">Badge Double Bordure</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Texte En-Tête
                      </label>
                      <input
                        type="text"
                        value={stampTextTop}
                        onChange={(e) => setStampTextTop(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Texte Principal (Centre)
                      </label>
                      <input
                        type="text"
                        value={stampCenterText}
                        onChange={(e) => setStampCenterText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Texte Bas / Date
                      </label>
                      <input
                        type="text"
                        value={stampTextBottom}
                        onChange={(e) => setStampTextBottom(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">
                          Couleur Encre
                        </label>
                        <select
                          value={stampColor}
                          onChange={(e) => setStampColor(e.target.value as 'red' | 'blue' | 'green' | 'black' | 'purple')}
                          className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs"
                        >
                          <option value="red">Rouge</option>
                          <option value="blue">Bleu</option>
                          <option value="green">Vert</option>
                          <option value="black">Noir</option>
                          <option value="purple">Violet</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">
                          Position
                        </label>
                        <select
                          value={stampPosition}
                          onChange={(e) => setStampPosition(e.target.value as 'br' | 'bl' | 'tr' | 'tl' | 'center')}
                          className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs"
                        >
                          <option value="br">Bas - Droite</option>
                          <option value="bl">Bas - Gauche</option>
                          <option value="tr">Haut - Droite</option>
                          <option value="tl">Haut - Gauche</option>
                          <option value="center">Centre</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Pages cibles
                      </label>
                      <select
                        value={stampPageMode}
                        onChange={(e) => setStampPageMode(e.target.value as 'all' | 'first' | 'last')}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="all">Toutes les pages</option>
                        <option value="first">Première page seulement</option>
                        <option value="last">Dernière page seulement</option>
                      </select>
                    </div>
                  </>
                )}

                {tool.id === 'crop' && (
                  <>
                    <p className="text-xs text-neutral-500">
                      Définissez le pourcentage de marge à rogner sur chaque bord :
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ['top', 'Haut (%)'],
                          ['bottom', 'Bas (%)'],
                          ['left', 'Gauche (%)'],
                          ['right', 'Droite (%)'],
                        ] as const
                      ).map(([edge, lbl]) => (
                        <div key={edge}>
                          <label className="block text-xs font-bold mb-1">
                            {lbl}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={cropMargins[edge]}
                            onChange={(e) => {
                              const nextVal = Math.max(
                                0,
                                Math.min(40, Number(e.target.value))
                              );
                              docHistory.setState((prev) => ({
                                ...prev,
                                cropMargins: {
                                  ...prev.cropMargins,
                                  [edge]: nextVal,
                                },
                              }));
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tool.id === 'editpdf' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Outil d’annotation
                      </label>
                      <select
                        value={editMode}
                        onChange={(e) =>
                          setEditMode(e.target.value as 'text' | 'highlight')
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="text">
                          Ajouter du texte (Cliquer sur la page)
                        </option>
                        <option value="highlight">
                          Surligneur jaune (Cliquer-glisser)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Texte à insérer
                      </label>
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">
                          Couleur
                        </label>
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-full h-9 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1">
                          Taille (pt)
                        </label>
                        <input
                          type="number"
                          value={editFontSize}
                          min={8}
                          max={60}
                          onChange={(e) =>
                            setEditFontSize(Number(e.target.value))
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm tabular-nums"
                        />
                      </div>
                    </div>
                  </>
                )}

                {tool.id === 'unlock' && (
                  <>
                    <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-200 text-xs">
                      Supprime les verrous de modification, copie et impression du PDF.
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Mot de passe (si chiffré)
                      </label>
                      <input
                        type="password"
                        value={unlockPwd}
                        onChange={(e) => setUnlockPwd(e.target.value)}
                        placeholder="Optionnel"
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                  </>
                )}

                {tool.id === 'protect' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Définir un mot de passe
                      </label>
                      <input
                        type="password"
                        value={protectPwd}
                        onChange={(e) => setProtectPwd(e.target.value)}
                        placeholder="Saisissez un mot de passe fort"
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={protectStamp}
                        onChange={(e) => setProtectStamp(e.target.checked)}
                        className="accent-sky-600"
                      />
                      <span>Apposer un sceau de protection documentaire</span>
                    </label>
                  </>
                )}

                {tool.id === 'sign' && (
                  <>
                    <SignaturePad
                      onSignatureChange={setSignatureDataUrl}
                      onResetAll={() => {
                        setSignatureDataUrl(null);
                        docHistory.setState((prev) => ({
                          ...prev,
                          annotations: {},
                        }));
                        setSigSize(160);
                        onNotify('Signature et placements réinitialisés.', 'info');
                      }}
                    />
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
                          2. Taille de la signature
                        </label>
                        <span className="text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
                          {sigSize} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={80}
                        max={300}
                        value={sigSize}
                        onChange={(e) => setSigSize(Number(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Petit', size: 110 },
                          { label: 'Moyen', size: 160 },
                          { label: 'Grand', size: 230 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setSigSize(preset.size)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                              sigSize === preset.size
                                ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium leading-relaxed">
                      3. Cliquez n’importe où sur le document à gauche pour placer votre signature (
                      <span className="font-bold tabular-nums">
                        {Object.values(annotations).reduce(
                          (acc, items) => acc + items.length,
                          0
                        )}
                      </span>{' '}
                      placée(s)).
                    </div>
                  </>
                )}

                {tool.id === 'redact' && (
                  <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs leading-relaxed">
                    <strong>Caviardage permanent :</strong> Tracez des rectangles noirs sur les données sensibles à gauche. Elles seront définitivement masquées dans le PDF généré.
                  </div>
                )}

                {tool.id === 'compare' && (
                  <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200 text-xs leading-relaxed">
                    Comparez visuellement les deux documents côte à côte et exportez un rapport PDF des différences détectées.
                  </div>
                )}

                {tool.id === 'pdf2md' && (
                  <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-200 text-xs leading-relaxed">
                    Extrait automatiquement les titres, paragraphes, listes et repères de pages de votre PDF vers un fichier <strong>.md (Markdown)</strong> prêt pour vos notes ou modèles de langage.
                  </div>
                )}

                {tool.id === 'pdfforms' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Type de champ interactif
                      </label>
                      <select
                        value={formFieldType}
                        onChange={(e) =>
                          setFormFieldType(
                            e.target.value as 'form-text' | 'form-check' | 'form-select'
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="form-text">Champ texte</option>
                        <option value="form-check">Case à cocher</option>
                        <option value="form-select">Liste déroulante</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                        Nom technique du champ
                      </label>
                      <input
                        type="text"
                        value={formFieldName}
                        onChange={(e) => setFormFieldName(e.target.value)}
                        placeholder="ex: nom_complet"
                        className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      />
                    </div>
                    {formFieldType === 'form-select' && (
                      <div>
                        <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">
                          Choix (séparés par des virgules)
                        </label>
                        <input
                          type="text"
                          value={formFieldOptions}
                          onChange={(e) => setFormFieldOptions(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                        />
                      </div>
                    )}
                    <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-200 text-xs font-medium tabular-nums">
                      Cliquez sur le document à gauche pour placer vos champs (
                      <strong>
                        {Object.values(annotations).reduce(
                          (acc, items) => acc + items.length,
                          0
                        )}
                      </strong>{' '}
                      champ(s) ajouté(s)).
                    </div>
                  </>
                )}

                {tool.id === 'aisummary' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Style de synthèse
                      </label>
                      <select
                        value={summaryStyle}
                        onChange={(e) =>
                          setSummaryStyle(
                            e.target.value as 'short' | 'bullets' | 'detailed'
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="bullets">Points clés (recommandé)</option>
                        <option value="short">Résumé court (1 paragraphe)</option>
                        <option value="detailed">Synthèse détaillée</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Format du document généré
                      </label>
                      <select
                        value={summaryOutput}
                        onChange={(e) =>
                          setSummaryOutput(e.target.value as 'pdf' | 'txt')
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="pdf">Rapport PDF mis en page</option>
                        <option value="txt">Fichier texte brut (.TXT)</option>
                      </select>
                    </div>
                  </>
                )}

                {tool.id === 'translatepdf' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Langue cible
                      </label>
                      <select
                        value={translateTargetLang}
                        onChange={(e) => setTranslateTargetLang(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="Anglais">Anglais</option>
                        <option value="Français">Français</option>
                        <option value="Espagnol">Espagnol</option>
                        <option value="Allemand">Allemand</option>
                        <option value="Italien">Italien</option>
                        <option value="Portugais">Portugais</option>
                        <option value="Arabe">Arabe</option>
                      </select>
                    </div>
                    <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200 text-xs leading-relaxed">
                      Le texte du document sera traduit automatiquement vers la langue sélectionnée et exporté dans un nouveau PDF.
                    </div>
                  </>
                )}

                {tool.id === 'aiocr' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Langue du document scanné
                      </label>
                      <select
                        value={aiOcrLang}
                        onChange={(e) => setAiOcrLang(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="Automatique">Détection automatique</option>
                        <option value="Français">Français</option>
                        <option value="Anglais">Anglais</option>
                        <option value="Espagnol">Espagnol</option>
                        <option value="Allemand">Allemand</option>
                        <option value="Arabe">Arabe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-neutral-500 mb-1.5">
                        Format du document généré
                      </label>
                      <select
                        value={aiOcrOutput}
                        onChange={(e) =>
                          setAiOcrOutput(
                            e.target.value as 'searchable' | 'editable' | 'txt' | 'md'
                          )
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                      >
                        <option value="searchable">
                          PDF consultable (image + couche texte indexée)
                        </option>
                        <option value="editable">
                          PDF éditable (texte extrait mis en page)
                        </option>
                        <option value="md">Document Markdown (.MD)</option>
                        <option value="txt">Fichier texte brut (.TXT)</option>
                      </select>
                    </div>
                    <div className="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200 text-xs leading-relaxed">
                      L’OCR avancé analyse vos images (JPG, PNG, WebP) ou PDF scannés page par page via l’API Gemini (jusqu’à 15 pages) pour restituer un document consultable et sélectionnable.
                    </div>
                  </>
                )}

                {tool.id === 'workflow' && (
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold uppercase text-neutral-500">
                      Étapes automatisées du flux
                    </label>
                    {(
                      [
                        {
                          id: 'merge',
                          label: '1. Fusionner tous les fichiers',
                          desc: 'Assemble les documents dans l’ordre importé.',
                        },
                        {
                          id: 'rotate90',
                          label: '2. Pivoter les pages (+90°)',
                          desc: 'Applique une rotation horaire sur chaque page.',
                        },
                        {
                          id: 'pagenumbers',
                          label: '3. Ajouter des numéros de page',
                          desc: 'Numérote le bas de chaque page (1 / N).',
                        },
                        {
                          id: 'watermark',
                          label: '4. Apposer un filigrane',
                          desc: 'Ajoute le tampon TRAITÉ en filigrane.',
                        },
                        {
                          id: 'compress',
                          label: '5. Compresser les flux PDF',
                          desc: 'Optimise la taille du document final.',
                        },
                        {
                          id: 'protect',
                          label: '6. Sceau d’intégrité',
                          desc: 'Marque le document comme protégé par le flux.',
                        },
                      ] as { id: WorkflowStepId; label: string; desc: string }[]
                    ).map((step) => {
                      const active = workflowSteps.includes(step.id);
                      return (
                        <label
                          key={step.id}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                            active
                              ? 'border-brand-red bg-red-50/40 dark:bg-red-950/20'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() =>
                              setWorkflowSteps((prev) =>
                                prev.includes(step.id)
                                  ? prev.filter((s) => s !== step.id)
                                  : [...prev, step.id]
                              )
                            }
                            className="mt-0.5 accent-brand-red"
                          />
                          <div>
                            <p className="text-xs font-bold text-neutral-900 dark:text-white">
                              {step.label}
                            </p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {step.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {!effectiveAdFree && getAdSenseSlotId('workspace') && (
                <AdSenseBanner
                  placement="workspace"
                  isAdFree={effectiveAdFree}
                  onUpgradeClick={onOpenPricing}
                  className="mt-5"
                />
              )}
            </div>

            <div className="sticky bottom-0 z-30 lg:static p-3 sm:p-5 border-t border-neutral-200 dark:border-brand-borderDark bg-white/95 dark:bg-brand-cardDark/95 backdrop-blur-md shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.16)] lg:shadow-none">
              <button
                type="button"
                onClick={handleExecute}
                className="w-full min-h-[48px] bg-brand-red hover:bg-brand-redHover text-white font-bold text-base sm:text-lg py-3.5 px-6 rounded-2xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all flex items-center justify-center gap-3"
              >
                <span>{tool.actionLabel}</span>
                <ArrowRightCircle className="w-5 h-5" />
              </button>
            </div>
          </aside>
            </>
          )}
        </motion.div>
      )}

      {/* ÉTAT 3 : TRAITEMENT EN COURS */}
      {stage === 'processing' && (
        <motion.div
          key="stage-processing"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="flex-grow flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="w-full max-w-md bg-white dark:bg-brand-cardDark rounded-3xl p-10 shadow-xl border border-neutral-200 dark:border-brand-borderDark">
            <div className="w-16 h-16 border-4 border-red-200 dark:border-red-900 border-t-brand-red rounded-full animate-spin mx-auto mb-6" />
            <h3 className="text-xl font-extrabold mb-2 text-neutral-900 dark:text-white">
              Traitement en cours...
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              Analyse et conversion du document en cours
            </p>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-brand-red h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs font-bold text-neutral-400 mt-2.5 tabular-nums">
              {progress}%
            </p>
          </div>
        </motion.div>
      )}

      {/* ÉTAT 4 : RÉSULTAT PRÊT */}
      {stage === 'result' && result && (
        <motion.div
          key="stage-result"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="flex-grow flex flex-col items-center justify-center p-3 sm:p-6 text-center"
        >
          <div className="w-full max-w-xl bg-white dark:bg-brand-cardDark rounded-3xl p-5 sm:p-10 shadow-2xl border border-neutral-200 dark:border-brand-borderDark">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-11 h-11" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white mb-2">
              Votre document est prêt !
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 tabular-nums">
              {result.fileName} ({result.sizeFormatted})
            </p>

            {result.statsHtml && (
              <div
                className="mb-6 p-4 rounded-2xl bg-brand-bgLight dark:bg-brand-bgDark border border-neutral-200 dark:border-brand-borderDark text-sm"
                dangerouslySetInnerHTML={{ __html: result.statsHtml }}
              />
            )}

            <a
              href={result.url}
              download={result.fileName}
              className="w-full sm:w-auto bg-brand-red hover:bg-brand-redHover text-white font-bold text-base sm:text-lg px-8 py-4 rounded-2xl shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all inline-flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              <span>{result.btnText}</span>
            </a>

            {(onSendResultViaGmail || onScheduleResultInCalendar) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                {onSendResultViaGmail && (
                  <button
                    type="button"
                    onClick={() =>
                      onSendResultViaGmail({
                        fileName: result.fileName,
                        blob: result.blob,
                        toolTitle: tool.title,
                      })
                    }
                    className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-brand-red text-xs font-bold inline-flex items-center gap-2 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Envoyer via Gmail</span>
                  </button>
                )}
                {onScheduleResultInCalendar && (
                  <button
                    type="button"
                    onClick={() =>
                      onScheduleResultInCalendar({
                        fileName: result.fileName,
                        blob: result.blob,
                        toolTitle: tool.title,
                      })
                    }
                    className="px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center gap-2 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Planifier dans Google Calendar</span>
                  </button>
                )}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-brand-borderDark flex flex-wrap justify-center gap-6 text-sm">
              <button
                type="button"
                onClick={resetWorkspace}
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-red font-bold inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recommencer</span>
              </button>
              <button
                type="button"
                onClick={onGoHome}
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-red font-bold inline-flex items-center gap-1.5"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Tous les outils</span>
              </button>
            </div>
          </div>
          {!effectiveAdFree && getAdSenseSlotId('result') && (
            <AdSenseBanner
              placement="result"
              isAdFree={effectiveAdFree}
              onUpgradeClick={onOpenPricing}
              className="w-full max-w-xl mt-5 text-left"
            />
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </section>
  );
}
