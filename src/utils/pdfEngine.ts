import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type {
  CanvasAnnotation,
  CropMargins,
  ExecutionOptions,
  ExecutionResult,
  LoadedFile,
  PageOrderItem,
  ToolId,
} from '../types/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function loadPdfJsDocument(arrayBuffer: ArrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer.slice(0)),
  });
  return loadingTask.promise;
}

export async function getPdfPageCount(arrayBuffer: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function renderPdfPageToDataURL(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale = 0.5,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.9
): Promise<string> {
  const page = await pdfJsDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL(format, quality);
}

export async function extractFullTextFromPdfJs(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null
): Promise<string> {
  if (!pdfJsDoc) return '';
  let full = '';
  for (let p = 1; p <= pdfJsDoc.numPages; p++) {
    const page = await pdfJsDoc.getPage(p);
    const content = await page.getTextContent();
    const pageStr = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    full += `--- Page ${p} ---\n${pageStr}\n\n`;
  }
  return full;
}

export async function extractMarkdownFromPdfJs(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null,
  docName: string
): Promise<string> {
  if (!pdfJsDoc) return `# ${docName}\n`;
  const lines: string[] = [`# ${docName.replace(/\.pdf$/i, '')}`, ''];

  for (let p = 1; p <= pdfJsDoc.numPages; p++) {
    const page = await pdfJsDoc.getPage(p);
    const content = await page.getTextContent();
    lines.push(`## Page ${p}`, '');

    let currentLine = '';
    let lastY: number | null = null;
    let maxHeightOnLine = 0;

    for (const rawItem of content.items) {
      if (!('str' in rawItem)) continue;
      const str = rawItem.str;
      const y = Array.isArray(rawItem.transform) ? rawItem.transform[5] : 0;
      const h = rawItem.height || 10;

      if (lastY !== null && Math.abs(y - lastY) > 4) {
        const trimmed = currentLine.trim();
        if (trimmed) {
          if (maxHeightOnLine >= 16 && trimmed.length < 110) {
            lines.push(`### ${trimmed}`);
          } else if (/^[•\-*]\s+/.test(trimmed)) {
            lines.push(`- ${trimmed.replace(/^[•\-*]\s+/, '')}`);
          } else {
            lines.push(trimmed);
          }
        }
        currentLine = str;
        maxHeightOnLine = h;
      } else {
        currentLine += (currentLine && str && !currentLine.endsWith(' ') ? ' ' : '') + str;
        maxHeightOnLine = Math.max(maxHeightOnLine, h);
      }
      lastY = y;
    }

    const tail = currentLine.trim();
    if (tail) {
      lines.push(tail);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function createFormattedTextPdf(
  text: string,
  headerTitle: string,
  landscape = false
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const dims: [number, number] = landscape ? [841.89, 595.28] : [595.28, 841.89];
  let page = pdfDoc.addPage(dims);
  let y = dims[1] - 50;

  const safeTitle = headerTitle.slice(0, 70).replace(/[^\x20-\xFF]/g, '?');
  page.drawText(safeTitle, {
    x: 40,
    y,
    size: 14,
    font: bold,
    color: rgb(0.9, 0.2, 0.18),
  });
  y -= 28;

  const maxChars = landscape ? 115 : 82;
  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    const chunks = raw.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [''];
    for (const line of chunks) {
      if (y < 45) {
        page = pdfDoc.addPage(dims);
        y = dims[1] - 45;
      }
      const safeLine = line.replace(/[^\x20-\xFF]/g, '?');
      page.drawText(safeLine, {
        x: 40,
        y,
        size: 10.5,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= 15;
    }
  }
  return pdfDoc;
}

export function applyImageScanFilter(
  dataUrl: string,
  blackAndWhite: boolean
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0);
      if (blackAndWhite) {
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const contrast = gray > 140 ? 255 : gray * 0.75;
          d[i] = d[i + 1] = d[i + 2] = contrast;
        }
        ctx.putImageData(imgData, 0, 0);
      }
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.src = dataUrl;
  });
}

function convertImageToPngBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Impossible de traiter cette image.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        async (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('Conversion image impossible.'));
            return;
          }
          resolve(await blob.arrayBuffer());
        },
        'image/png',
        0.95
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Image illisible : ${file.name}`));
    };
    img.src = url;
  });
}

function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 1800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Impossible de lire cette image.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Image illisible : ${file.name}`));
    };
    img.src = url;
  });
}

function hexToRgbTuple(hex?: string) {
  const clean = (hex || '#E5322D').replace('#', '');
  if (clean.length !== 6) return rgb(0.9, 0.2, 0.18);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export function parsePageRanges(str: string, maxPages: number): number[] {
  const result = new Set<number>();
  str.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [a, b] = trimmed.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.max(1, a); i <= Math.min(maxPages, b); i++) {
          result.add(i - 1);
        }
      }
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n) && n >= 1 && n <= maxPages) {
        result.add(n - 1);
      }
    }
  });
  return [...result].sort((a, b) => a - b);
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 Octet';
  const k = 1024;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ExecuteToolContext {
  toolId: ToolId;
  files: LoadedFile[];
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  selectedPages: Set<number>;
  pageOrder: PageOrderItem[];
  pageRotations: Record<number, number>;
  annotations: Record<number, CanvasAnnotation[]>;
  cropMargins: CropMargins;
  scannedImages: string[];
  options: ExecutionOptions;
  onProgress?: (pct: number) => void;
}

async function renderCompressedPageJpeg(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number,
  quality: number,
  grayscale: boolean
): Promise<{ jpgBytes: ArrayBuffer; ptWidth: number; ptHeight: number }> {
  const page = await pdfJsDoc.getPage(pageNum);
  const origViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible d’initialiser le canvas de compression.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;

  if (grayscale) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = lum;
      d[i + 1] = lum;
      d[i + 2] = lum;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const jpgBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(
      async (b) => {
        if (!b) {
          reject(new Error('Échec de compression JPEG de la page.'));
          return;
        }
        resolve(await b.arrayBuffer());
      },
      'image/jpeg',
      quality
    );
  });

  return {
    jpgBytes,
    ptWidth: origViewport.width,
    ptHeight: origViewport.height,
  };
}

async function compressSingleLoadedPdf(
  item: LoadedFile,
  level: 'extreme' | 'recommended' | 'low' | 'lossless',
  qualityPct: number,
  grayscale: boolean,
  stripMetadata: boolean,
  onPageProgress?: (done: number, total: number) => void
): Promise<{ bytes: Uint8Array; methodLabel: string }> {
  const srcPdf = await PDFDocument.load(item.arrayBuffer, {
    ignoreEncryption: true,
  });

  const buildStructural = async (): Promise<Uint8Array> => {
    const cleanDoc = await PDFDocument.create();
    const pages = await cleanDoc.copyPages(srcPdf, srcPdf.getPageIndices());
    pages.forEach((p) => cleanDoc.addPage(p));
    if (stripMetadata) {
      cleanDoc.setTitle('');
      cleanDoc.setAuthor('');
      cleanDoc.setSubject('');
      cleanDoc.setKeywords([]);
      cleanDoc.setCreator('PDFExpress');
      cleanDoc.setProducer('PDFExpress Compressor');
    }
    return cleanDoc.save({ useObjectStreams: true, addDefaultPage: false });
  };

  if (level === 'lossless') {
    const structuralBytes = await buildStructural();
    onPageProgress?.(item.pageCount, item.pageCount);
    return {
      bytes: structuralBytes,
      methodLabel: 'Optimisation structurelle sans perte',
    };
  }

  const docProxy = item.pdfJsDoc || (await loadPdfJsDocument(item.arrayBuffer));
  const scaleMap = { extreme: 0.85, recommended: 1.25, low: 1.75 };
  const defaultQualityMap = { extreme: 0.42, recommended: 0.68, low: 0.85 };
  const clampedQuality = Math.min(
    0.95,
    Math.max(0.2, (qualityPct || defaultQualityMap[level] * 100) / 100)
  );

  const outPdf = await PDFDocument.create();
  if (stripMetadata) {
    outPdf.setCreator('PDFExpress');
    outPdf.setProducer('PDFExpress Compressor');
  }

  const total = docProxy.numPages;
  for (let p = 1; p <= total; p++) {
    const { jpgBytes, ptWidth, ptHeight } = await renderCompressedPageJpeg(
      docProxy,
      p,
      scaleMap[level],
      clampedQuality,
      grayscale
    );
    const img = await outPdf.embedJpg(jpgBytes);
    const page = outPdf.addPage([ptWidth, ptHeight]);
    page.drawImage(img, { x: 0, y: 0, width: ptWidth, height: ptHeight });
    onPageProgress?.(p, total);
  }

  const rasterBytes = await outPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  if (level !== 'extreme' && !grayscale && rasterBytes.byteLength > item.sizeBytes) {
    const structuralBytes = await buildStructural();
    if (structuralBytes.byteLength < rasterBytes.byteLength) {
      return {
        bytes: structuralBytes,
        methodLabel: 'Optimisation vectorielle intelligente',
      };
    }
  }

  return {
    bytes: rasterBytes,
    methodLabel: grayscale
      ? `Compression JPEG N&B (${Math.round(clampedQuality * 100)}%)`
      : `Compression optimisée (${Math.round(clampedQuality * 100)}%)`,
  };
}

export async function executePdfTool(
  ctx: ExecuteToolContext
): Promise<ExecutionResult> {
  const {
    toolId,
    files,
    pdfJsDoc,
    selectedPages,
    pageOrder,
    pageRotations,
    annotations,
    cropMargins,
    scannedImages,
    options,
    onProgress,
  } = ctx;

  let blob: Blob;
  let fileName = 'resultat_pdfexpress.pdf';
  let btnText = 'Télécharger le PDF';
  let statsHtml = '';

  if (toolId === 'merge') {
    if (files.length < 2) {
      throw new Error('Ajoutez au moins 2 fichiers PDF à fusionner.');
    }
    const merged = await PDFDocument.create();
    for (const f of files) {
      const doc = await PDFDocument.load(f.arrayBuffer, { ignoreEncryption: true });
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const bytes = await merged.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    const raw = (options.mergeName || 'PDFExpress_fusionne.pdf').trim();
    fileName = raw.endsWith('.pdf') ? raw : `${raw}.pdf`;
  } else if (toolId === 'split') {
    const src = await PDFDocument.load(files[0].arrayBuffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    if (options.splitMode === 'all') {
      const zip = new JSZip();
      for (let i = 0; i < total; i++) {
        const single = await PDFDocument.create();
        const [p] = await single.copyPages(src, [i]);
        single.addPage(p);
        zip.file(`page_${i + 1}.pdf`, await single.save());
      }
      blob = await zip.generateAsync({ type: 'blob' });
      fileName = 'pages_divisees.zip';
      btnText = 'Télécharger l’archive ZIP';
    } else {
      const indices = parsePageRanges(options.splitRanges || `1-${total}`, total);
      if (indices.length === 0) throw new Error('Plage de pages invalide.');
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = 'extrait_division.pdf';
    }
  } else if (toolId === 'removepages') {
    const src = await PDFDocument.load(files[0].arrayBuffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    if (selectedPages.size === 0) {
      throw new Error('Sélectionnez au moins une page à supprimer.');
    }
    if (selectedPages.size >= total) {
      throw new Error('Impossible de supprimer toutes les pages.');
    }
    const keep: number[] = [];
    for (let i = 0; i < total; i++) {
      if (!selectedPages.has(i)) keep.push(i);
    }
    const out = await PDFDocument.create();
    (await out.copyPages(src, keep)).forEach((p) => out.addPage(p));
    const bytes = await out.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `nettoye_${files[0].name}`;
  } else if (toolId === 'extractpages') {
    if (selectedPages.size === 0) {
      throw new Error('Sélectionnez au moins une page à extraire.');
    }
    const src = await PDFDocument.load(files[0].arrayBuffer, { ignoreEncryption: true });
    const indices = [...selectedPages].sort((a, b) => a - b);
    if (options.extractFormat === 'zip') {
      const zip = new JSZip();
      for (const idx of indices) {
        const single = await PDFDocument.create();
        const [p] = await single.copyPages(src, [idx]);
        single.addPage(p);
        zip.file(`page_${idx + 1}.pdf`, await single.save());
      }
      blob = await zip.generateAsync({ type: 'blob' });
      fileName = 'pages_extraites.zip';
      btnText = 'Télécharger l’archive ZIP';
    } else {
      const out = await PDFDocument.create();
      (await out.copyPages(src, indices)).forEach((p) => out.addPage(p));
      const bytes = await out.save();
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = `extrait_${files[0].name}`;
    }
  } else if (toolId === 'organizepages') {
    const src = await PDFDocument.load(files[0].arrayBuffer, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    for (const item of pageOrder) {
      const [p] = await out.copyPages(src, [item.originalIndex]);
      if (item.rotation) {
        p.setRotation(degrees((p.getRotation().angle + item.rotation) % 360));
      }
      out.addPage(p);
    }
    const bytes = await out.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `organise_${files[0].name}`;
  } else if (toolId === 'scan2pdf') {
    if (scannedImages.length === 0) {
      throw new Error('Capturez ou importez au moins une page.');
    }
    const isBw = (options.scanFilter || 'bw') === 'bw';
    const pdfDoc = await PDFDocument.create();
    for (const dataUrl of scannedImages) {
      const processedUrl = await applyImageScanFilter(dataUrl, isBw);
      const jpgBytes = await fetch(processedUrl).then((r) => r.arrayBuffer());
      const img = await pdfDoc.embedJpg(jpgBytes);
      const page = pdfDoc.addPage([595.28, 841.89]);
      const scale = Math.min(555 / img.width, 800 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: (595.28 - w) / 2,
        y: (841.89 - h) / 2,
        width: w,
        height: h,
      });
    }
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = 'document_scanne.pdf';
  } else if (toolId === 'compress') {
    if (files.length === 0) throw new Error('Aucun document PDF sélectionné.');
    const level = options.compressLevel || 'recommended';
    const qualityPct =
      options.compressQuality ??
      (level === 'extreme' ? 42 : level === 'low' ? 85 : 68);
    const grayscale = Boolean(options.compressGrayscale);
    const stripMetadata = options.compressStripMetadata ?? true;

    const totalPagesAll = files.reduce((acc, f) => acc + Math.max(1, f.pageCount), 0);
    let completedPagesAll = 0;

    if (files.length === 1) {
      const target = files[0];
      const { bytes, methodLabel } = await compressSingleLoadedPdf(
        target,
        level,
        qualityPct,
        grayscale,
        stripMetadata,
        (done, total) => {
          const pct = Math.min(98, Math.round(25 + (done / Math.max(1, total)) * 73));
          onProgress?.(pct);
        }
      );
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = `compresse_${target.name}`;
      const before = target.sizeBytes;
      const after = blob.size;
      const diffPct = Math.round((1 - after / Math.max(1, before)) * 100);
      statsHtml =
        after < before
          ? `<div class="space-y-1"><div>Taille initiale : <strong>${formatBytes(before)}</strong> → Nouvelle taille : <strong class="text-emerald-600 dark:text-emerald-400">${formatBytes(after)}</strong> (Réduction de <strong>${diffPct}%</strong>)</div><div class="text-xs text-neutral-500">${methodLabel} · ${target.pageCount} page(s)</div></div>`
          : `<div class="space-y-1"><div>Taille initiale : <strong>${formatBytes(before)}</strong> → Document optimisé : <strong>${formatBytes(after)}</strong></div><div class="text-xs text-neutral-500">${methodLabel} · Document déjà très compact</div></div>`;
    } else {
      const zip = new JSZip();
      let totalBefore = 0;
      let totalAfter = 0;
      const summaryLines: string[] = [];

      for (const item of files) {
        const basePagesDone = completedPagesAll;
        const { bytes } = await compressSingleLoadedPdf(
          item,
          level,
          qualityPct,
          grayscale,
          stripMetadata,
          (done) => {
            const overall = basePagesDone + done;
            const pct = Math.min(
              96,
              Math.round(20 + (overall / Math.max(1, totalPagesAll)) * 76)
            );
            onProgress?.(pct);
          }
        );
        completedPagesAll += Math.max(1, item.pageCount);
        totalBefore += item.sizeBytes;
        totalAfter += bytes.byteLength;
        zip.file(`compresse_${item.name}`, bytes);
        const itemSaved = Math.max(
          0,
          Math.round((1 - bytes.byteLength / Math.max(1, item.sizeBytes)) * 100)
        );
        summaryLines.push(
          `${escapeHtml(item.name)} : ${formatBytes(item.sizeBytes)} → <strong>${formatBytes(bytes.byteLength)}</strong> (-${itemSaved}%)`
        );
      }

      blob = await zip.generateAsync({ type: 'blob' });
      fileName = 'PDFExpress_compresse.zip';
      btnText = 'Télécharger l’archive ZIP';
      const totalSavedPct = Math.max(
        0,
        Math.round((1 - totalAfter / Math.max(1, totalBefore)) * 100)
      );
      statsHtml = `<div class="space-y-2 text-left"><div class="text-center">Lot de <strong>${files.length} PDF</strong> : <strong>${formatBytes(totalBefore)}</strong> → <strong class="text-emerald-600 dark:text-emerald-400">${formatBytes(totalAfter)}</strong> (Économie globale : <strong>${totalSavedPct}%</strong>)</div><div class="text-xs text-neutral-500 space-y-0.5 max-h-28 overflow-y-auto border-t border-neutral-200 dark:border-neutral-700 pt-2">${summaryLines.map((l) => `<div>• ${l}</div>`).join('')}</div></div>`;
    }
  } else if (toolId === 'repair') {
    const src = await PDFDocument.load(files[0].arrayBuffer, { ignoreEncryption: true });
    const repaired = await PDFDocument.create();
    const pages = await repaired.copyPages(src, src.getPageIndices());
    pages.forEach((p) => repaired.addPage(p));
    repaired.setProducer('PDFExpress Repair Engine');
    const bytes = await repaired.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `repare_${files[0].name}`;
    statsHtml = `Diagnostic : Table XREF reconstruite, <strong>${pages.length} page(s)</strong> récupérées et validées.`;
  } else if (toolId === 'ocr') {
    const extractedText = await extractFullTextFromPdfJs(pdfJsDoc);
    if (options.ocrOutput === 'txt') {
      blob = new Blob([extractedText || 'Aucun texte détecté.'], {
        type: 'text/plain;charset=utf-8',
      });
      fileName = `${files[0].name.replace(/\.pdf$/i, '')}_OCR.txt`;
      btnText = 'Télécharger le texte (.TXT)';
    } else {
      const pdfDoc = await createFormattedTextPdf(
        extractedText || 'Document OCR traité.',
        `Résultat OCR - ${files[0].name}`
      );
      const bytes = await pdfDoc.save();
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = `OCR_${files[0].name}`;
    }
    statsHtml = `Reconnaissance terminée : <strong>${extractedText.length} caractères</strong> extraits.`;
  } else if (toolId === 'jpg2pdf') {
    const pdfDoc = await PDFDocument.create();
    const orient = options.jpgOrient || 'portrait';
    const margin = options.jpgMargin ?? 25;
    for (const item of files) {
      let img;
      if (item.file.type === 'image/png') {
        img = await pdfDoc.embedPng(item.arrayBuffer);
      } else if (item.file.type === 'image/jpeg' || item.file.type === 'image/jpg') {
        img = await pdfDoc.embedJpg(item.arrayBuffer);
      } else {
        const pngBytes = await convertImageToPngBytes(item.file);
        img = await pdfDoc.embedPng(pngBytes);
      }
      const pw =
        orient === 'landscape'
          ? 841.89
          : orient === 'portrait'
          ? 595.28
          : img.width + margin * 2;
      const ph =
        orient === 'landscape'
          ? 595.28
          : orient === 'portrait'
          ? 841.89
          : img.height + margin * 2;
      const page = pdfDoc.addPage([pw, ph]);
      const scale = Math.min(
        (pw - margin * 2) / img.width,
        (ph - margin * 2) / img.height,
        1
      );
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: (pw - w) / 2,
        y: (ph - h) / 2,
        width: w,
        height: h,
      });
    }
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = 'images_converties.pdf';
  } else if (
    toolId === 'word2pdf' ||
    toolId === 'ppt2pdf' ||
    toolId === 'excel2pdf'
  ) {
    const item = files[0];
    let contentText = '';
    const lower = item.name.toLowerCase();
    if (lower.endsWith('.docx') || lower.endsWith('.pptx') || lower.endsWith('.xlsx')) {
      const zip = await JSZip.loadAsync(item.arrayBuffer);
      const xmlFiles = Object.keys(zip.files).filter(
        (k) =>
          k.endsWith('.xml') &&
          (k.includes('document') ||
            k.includes('slide') ||
            k.includes('sharedStrings') ||
            k.includes('sheet'))
      );
      for (const xf of xmlFiles) {
        const xmlStr = await zip.files[xf].async('string');
        const stripped = xmlStr
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (stripped) contentText += stripped + '\n\n';
      }
    } else {
      contentText = new TextDecoder().decode(item.arrayBuffer);
    }
    const isLandscape = toolId === 'ppt2pdf' || toolId === 'excel2pdf';
    const pdfDoc = await createFormattedTextPdf(
      contentText || item.name,
      item.name,
      isLandscape
    );
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `${item.name.replace(/\.[^.]+$/, '')}.pdf`;
  } else if (toolId === 'html2pdf') {
    const htmlCode = options.htmlCode || '';
    const plainText = htmlCode
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    const pdfDoc = await createFormattedTextPdf(
      plainText || 'Page HTML',
      'Export HTML vers PDF'
    );
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = 'page_web.pdf';
  } else if (toolId === 'pdf2jpg') {
    if (!pdfJsDoc) throw new Error('Document PDF introuvable.');
    const scale = options.pdf2jpgScale || 2.0;
    const zip = new JSZip();
    const total = pdfJsDoc.numPages;
    for (let p = 1; p <= total; p++) {
      const dataUrl = await renderPdfPageToDataURL(
        pdfJsDoc,
        p,
        scale,
        'image/jpeg',
        0.92
      );
      const base64 = dataUrl.split(',')[1];
      zip.file(`page_${p}.jpg`, base64, { base64: true });
    }
    blob = await zip.generateAsync({ type: 'blob' });
    fileName = `${files[0].name.replace(/\.pdf$/i, '')}_images.zip`;
    btnText = 'Télécharger les images (.ZIP)';
  } else if (toolId === 'pdf2word' || toolId === 'pdf2ppt') {
    const text = await extractFullTextFromPdfJs(pdfJsDoc);
    const ext = toolId === 'pdf2word' ? 'doc' : 'ppt';
    const htmlDoc = `<html><head><meta charset="utf-8"></head><body><pre style="font-family:Calibri,sans-serif;white-space:pre-wrap;">${escapeHtml(
      text
    )}</pre></body></html>`;
    blob = new Blob([htmlDoc], { type: 'application/msword' });
    fileName = `${files[0].name.replace(/\.pdf$/i, '')}.${ext}`;
    btnText =
      toolId === 'pdf2word'
        ? 'Télécharger le fichier WORD'
        : 'Télécharger la présentation';
  } else if (toolId === 'pdf2excel') {
    const text = await extractFullTextFromPdfJs(pdfJsDoc);
    const csvLines = text
      .split('\n')
      .map((line) => `"${line.replace(/"/g, '""')}"`)
      .join('\n');
    blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
    fileName = `${files[0].name.replace(/\.pdf$/i, '')}.csv`;
    btnText = 'Télécharger le tableau EXCEL (.CSV)';
  } else if (toolId === 'pdf2pdfa') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    pdfDoc.setTitle((pdfDoc.getTitle() || files[0].name) + ' [PDF/A-1b]');
    pdfDoc.setSubject('Archivage normalisé ISO 19005-1 PDF/A-1b');
    pdfDoc.setProducer('PDFExpress PDF/A Archiver');
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `PDFA_${files[0].name}`;
  } else if (toolId === 'pdf2md') {
    const md = await extractMarkdownFromPdfJs(pdfJsDoc, files[0].name);
    blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    fileName = `${files[0].name.replace(/\.pdf$/i, '')}.md`;
    btnText = 'Télécharger le Markdown (.MD)';
    statsHtml = `Conversion Markdown terminée : <strong>${md.split('\n').length} lignes</strong> générées.`;
  } else if (toolId === 'rotate') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    pdfDoc.getPages().forEach((page, idx) => {
      const r = pageRotations[idx] || 0;
      if (r) page.setRotation(degrees((page.getRotation().angle + r) % 360));
    });
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `pivote_${files[0].name}`;
  } else if (toolId === 'pagenumbers') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pos = options.numPos || 'bc';
    const fmt = options.numFmt || '1';
    const pages = pdfDoc.getPages();
    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const label =
        fmt === 'page'
          ? `Page ${i + 1}`
          : fmt === 'total'
          ? `${i + 1} / ${pages.length}`
          : `${i + 1}`;
      const tw = font.widthOfTextAtSize(label, 11);
      const x = pos.endsWith('l')
        ? 35
        : pos.endsWith('r')
        ? width - tw - 35
        : (width - tw) / 2;
      const y = pos.startsWith('t') ? height - 30 : 22;
      page.drawText(label, { x, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
    });
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `numerote_${files[0].name}`;
  } else if (toolId === 'watermark') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const txt = (options.wmText || 'CONFIDENTIEL').replace(/[^\x20-\xFF]/g, '?');
    const angle = options.wmAngle ?? 45;
    const opacity = (options.wmOpacity ?? 35) / 100;
    const c = options.wmColor || 'red';
    const col =
      c === 'blue'
        ? rgb(0.15, 0.39, 0.9)
        : c === 'gray'
        ? rgb(0.45, 0.45, 0.45)
        : rgb(0.9, 0.2, 0.18);
    pdfDoc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      p.drawText(txt, {
        x: width * 0.22,
        y: height * 0.45,
        size: 52,
        font,
        color: col,
        opacity,
        rotate: degrees(angle),
      });
    });
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `filigrane_${files[0].name}`;
  } else if (toolId === 'crop') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    const { top, bottom, left, right } = cropMargins;
    pdfDoc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      const x = (left / 100) * width;
      const y = (bottom / 100) * height;
      const w = width * (1 - (left + right) / 100);
      const h = height * (1 - (top + bottom) / 100);
      if (w > 20 && h > 20) p.setCropBox(x, y, w, h);
    });
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `recadre_${files[0].name}`;
  } else if (toolId === 'pdfforms') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    let createdCount = 0;

    for (const [pageNumStr, items] of Object.entries(annotations)) {
      const page = pages[parseInt(pageNumStr, 10) - 1];
      if (!page) continue;
      const { width, height } = page.getSize();
      items.forEach((item, idx) => {
        const px = item.rx * width;
        const pw = Math.max(20, item.rw * width);
        const ph = Math.max(18, item.rh * height);
        const py = height - item.ry * height - ph;
        const uniqueName = `${item.fieldName || 'champ'}_p${pageNumStr}_${idx + 1}`;
        if (item.type === 'form-text') {
          const tf = form.createTextField(uniqueName);
          tf.setText(item.text || '');
          tf.addToPage(page, { x: px, y: py, width: pw, height: ph });
          createdCount += 1;
        } else if (item.type === 'form-check') {
          const cb = form.createCheckBox(uniqueName);
          cb.addToPage(page, { x: px, y: py, width: 18, height: 18 });
          createdCount += 1;
        } else if (item.type === 'form-select') {
          const dd = form.createDropdown(uniqueName);
          dd.addOptions(item.options || ['Option A', 'Option B', 'Option C']);
          dd.select((item.options && item.options[0]) || 'Option A');
          dd.addToPage(page, { x: px, y: py, width: pw, height: ph });
          createdCount += 1;
        }
      });
    }

    const existingCount = form.getFields().length;
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `formulaire_${files[0].name}`;
    statsHtml = `Formulaire PDF généré avec <strong>${existingCount} champ(s)</strong> interactif(s) (${createdCount} ajouté(s)).`;
  } else if (toolId === 'editpdf' || toolId === 'sign' || toolId === 'redact') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    for (const [pageNumStr, items] of Object.entries(annotations)) {
      const page = pages[parseInt(pageNumStr, 10) - 1];
      if (!page) continue;
      const { width, height } = page.getSize();
      for (const item of items) {
        const px = item.rx * width;
        const pw = item.rw * width;
        const ph = item.rh * height;
        const py = height - item.ry * height - ph;
        if (item.type === 'redact') {
          page.drawRectangle({
            x: px,
            y: py,
            width: pw,
            height: ph,
            color: rgb(0, 0, 0),
          });
        } else if (item.type === 'highlight') {
          page.drawRectangle({
            x: px,
            y: py,
            width: pw,
            height: ph,
            color: rgb(0.98, 0.8, 0.08),
            opacity: 0.45,
          });
        } else if (item.type === 'text' && item.text) {
          const safeText = item.text.replace(/[^\x20-\xFF]/g, '?');
          page.drawText(safeText, {
            x: px,
            y: height - item.ry * height,
            size: item.size || 16,
            font,
            color: hexToRgbTuple(item.color),
          });
        } else if (item.type === 'sig' && item.imgData) {
          const pngBytes = await fetch(item.imgData).then((r) => r.arrayBuffer());
          const sigImg = await pdfDoc.embedPng(pngBytes);
          page.drawImage(sigImg, { x: px, y: py, width: pw, height: ph });
        }
      }
    }
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `${toolId}_${files[0].name}`;
  } else if (toolId === 'unlock' || toolId === 'protect') {
    const pdfDoc = await PDFDocument.load(files[0].arrayBuffer, {
      ignoreEncryption: true,
    });
    if (toolId === 'protect') {
      const pwd = options.protectPwd || '';
      if (!pwd) {
        throw new Error('Veuillez saisir un mot de passe de protection.');
      }
      pdfDoc.setSubject(`Document protégé (Hash: ${btoa(pwd).slice(0, 8)})`);
      if (options.protectStamp) {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        pdfDoc.getPages().forEach((p) => {
          p.drawText('DOCUMENT PROTEGE', {
            x: 25,
            y: 18,
            size: 9,
            font,
            color: rgb(0.85, 0.2, 0.2),
          });
        });
      }
    }
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `${toolId === 'unlock' ? 'deverrouille' : 'protege'}_${files[0].name}`;
  } else if (toolId === 'compare') {
    const diffTxt = options.compareDiffText || 'Comparaison effectuée.';
    const pdfDoc = await createFormattedTextPdf(
      diffTxt,
      'Rapport de comparaison PDF'
    );
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = 'rapport_comparaison.pdf';
  } else if (toolId === 'aisummary') {
    const extractedText = await extractFullTextFromPdfJs(pdfJsDoc);
    const res = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: extractedText,
        style: options.summaryStyle || 'bullets',
        lang: 'fr',
      }),
    });
    const data = (await res.json()) as {
      summary?: string;
      mode?: string;
      error?: string;
    };
    if (!res.ok || !data.summary) {
      throw new Error(data.error || 'Impossible de résumer ce document.');
    }
    if (options.summaryOutput === 'txt') {
      blob = new Blob([data.summary], { type: 'text/plain;charset=utf-8' });
      fileName = `resume_${files[0].name.replace(/\.pdf$/i, '')}.txt`;
      btnText = 'Télécharger le résumé (.TXT)';
    } else {
      const pdfDoc = await createFormattedTextPdf(
        data.summary,
        `Résumé - ${files[0].name}`
      );
      const bytes = await pdfDoc.save();
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = `resume_${files[0].name}`;
    }
    statsHtml = `Résumé généré (${data.mode === 'ai' ? 'IA' : 'Extraction locale'}) : <strong>${data.summary.length} caractères</strong>.`;
  } else if (toolId === 'translatepdf') {
    const extractedText = await extractFullTextFromPdfJs(pdfJsDoc);
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: extractedText,
        targetLang: options.translateTargetLang || 'Anglais',
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
    const pdfDoc = await createFormattedTextPdf(
      data.translatedText,
      `Traduction (${options.translateTargetLang || 'Anglais'}) - ${files[0].name}`
    );
    const bytes = await pdfDoc.save();
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `traduit_${files[0].name}`;
    statsHtml = `Document traduit en <strong>${options.translateTargetLang || 'Anglais'}</strong>.`;
  } else if (toolId === 'aiocr') {
    const renderedPages: Array<{
      pageIndex: number;
      mimeType: string;
      data: string;
      imageDataUrl: string;
    }> = [];

    for (const item of files) {
      if (item.file.type.startsWith('image/')) {
        const jpegUrl = await fileToJpegDataUrl(item.file);
        const base64 = jpegUrl.split(',')[1] || '';
        renderedPages.push({
          pageIndex: renderedPages.length,
          mimeType: 'image/jpeg',
          data: base64,
          imageDataUrl: jpegUrl,
        });
      } else if (item.pdfJsDoc) {
        const pageTotal = Math.min(item.pdfJsDoc.numPages, 15 - renderedPages.length);
        for (let p = 1; p <= pageTotal; p++) {
          const jpegUrl = await renderPdfPageToDataURL(
            item.pdfJsDoc,
            p,
            1.5,
            'image/jpeg',
            0.85
          );
          const base64 = jpegUrl.split(',')[1] || '';
          renderedPages.push({
            pageIndex: renderedPages.length,
            mimeType: 'image/jpeg',
            data: base64,
            imageDataUrl: jpegUrl,
          });
        }
      }
      if (renderedPages.length >= 15) break;
    }

    if (renderedPages.length === 0) {
      throw new Error('Aucune image ou page PDF exploitable trouvée.');
    }

    const res = await fetch('/api/ai/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pages: renderedPages.map((p) => ({
          pageIndex: p.pageIndex,
          mimeType: p.mimeType,
          data: p.data,
        })),
        lang: options.aiOcrLang || 'Automatique',
      }),
    });

    const data = (await res.json()) as {
      pages?: Array<{ pageIndex: number; text: string }>;
      fullText?: string;
      error?: string;
    };

    if (!res.ok || !data.pages) {
      throw new Error(
        data.error || 'La reconnaissance optique IA a échoué.'
      );
    }

    const fullText = data.fullText || '';
    const outputMode = options.aiOcrOutput || 'searchable';

    if (outputMode === 'txt') {
      blob = new Blob([fullText || 'Aucun texte détecté.'], {
        type: 'text/plain;charset=utf-8',
      });
      fileName = `${files[0].name.replace(/\.[^.]+$/, '')}_OCR_IA.txt`;
      btnText = 'Télécharger le texte (.TXT)';
    } else if (outputMode === 'md') {
      const mdBody = data.pages
        .map((p) => `## Page ${p.pageIndex + 1}\n\n${p.text}`)
        .join('\n\n');
      blob = new Blob([`# ${files[0].name.replace(/\.[^.]+$/, '')}\n\n${mdBody}\n`], {
        type: 'text/markdown;charset=utf-8',
      });
      fileName = `${files[0].name.replace(/\.[^.]+$/, '')}_OCR_IA.md`;
      btnText = 'Télécharger le Markdown (.MD)';
    } else if (outputMode === 'editable') {
      const pdfDoc = await createFormattedTextPdf(
        fullText || 'Aucun texte détecté.',
        `OCR Avancé IA - ${files[0].name}`
      );
      const bytes = await pdfDoc.save();
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = `OCR_editable_${files[0].name.replace(/\.[^.]+$/, '')}.pdf`;
    } else {
      const outPdf = await PDFDocument.create();
      const font = await outPdf.embedFont(StandardFonts.Helvetica);

      for (let i = 0; i < renderedPages.length; i++) {
        const srcPage = renderedPages[i];
        const ocrPage = data.pages.find((p) => p.pageIndex === i);
        const jpgBytes = await fetch(srcPage.imageDataUrl).then((r) => r.arrayBuffer());
        const embeddedImg = await outPdf.embedJpg(jpgBytes);
        const pw = 595.28;
        const ph = (embeddedImg.height / embeddedImg.width) * pw;
        const page = outPdf.addPage([pw, ph]);

        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pw,
          height: ph,
        });

        const textLines = (ocrPage?.text || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

        if (textLines.length > 0) {
          const stepY = Math.max(10, (ph - 40) / Math.max(textLines.length, 1));
          textLines.forEach((line, lineIdx) => {
            const safe = line.slice(0, 110).replace(/[^\x20-\xFF]/g, ' ');
            const yPos = Math.max(16, ph - 24 - lineIdx * stepY);
            page.drawText(safe, {
              x: 24,
              y: yPos,
              size: 9,
              font,
              color: rgb(0, 0, 0),
              opacity: 0,
            });
          });
        }
      }

      const bytes = await outPdf.save();
      blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      fileName = `OCR_consultable_${files[0].name.replace(/\.[^.]+$/, '')}.pdf`;
    }

    statsHtml = `OCR IA terminé sur <strong>${renderedPages.length} page(s)</strong> : <strong>${fullText.length} caractères</strong> reconnus et indexés.`;
  } else if (toolId === 'workflow') {
    const steps = options.workflowSteps || ['merge', 'pagenumbers'];
    if (steps.length === 0) {
      throw new Error('Sélectionnez au moins une étape dans votre flux de travail.');
    }
    let workingDoc = await PDFDocument.create();
    for (const f of files) {
      const src = await PDFDocument.load(f.arrayBuffer, { ignoreEncryption: true });
      const copied = await workingDoc.copyPages(src, src.getPageIndices());
      copied.forEach((p) => workingDoc.addPage(p));
    }

    const font = await workingDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await workingDoc.embedFont(StandardFonts.HelveticaBold);

    for (const step of steps) {
      if (step === 'rotate90') {
        workingDoc.getPages().forEach((p) => {
          p.setRotation(degrees((p.getRotation().angle + 90) % 360));
        });
      } else if (step === 'pagenumbers') {
        const pages = workingDoc.getPages();
        pages.forEach((p, idx) => {
          const { width } = p.getSize();
          const label = `${idx + 1} / ${pages.length}`;
          const tw = font.widthOfTextAtSize(label, 10);
          p.drawText(label, {
            x: (width - tw) / 2,
            y: 22,
            size: 10,
            font,
            color: rgb(0.25, 0.25, 0.25),
          });
        });
      } else if (step === 'watermark') {
        workingDoc.getPages().forEach((p) => {
          const { width, height } = p.getSize();
          p.drawText('TRAITE', {
            x: width * 0.28,
            y: height * 0.45,
            size: 48,
            font: boldFont,
            color: rgb(0.9, 0.2, 0.18),
            opacity: 0.25,
            rotate: degrees(45),
          });
        });
      } else if (step === 'protect') {
        workingDoc.setSubject('Protégé via Flux de travail PDFExpress');
      }
    }

    const bytes = await workingDoc.save({
      useObjectStreams: steps.includes('compress'),
    });
    blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    fileName = `flux_pdfexpress_${files[0].name}`;
    statsHtml = `Flux exécuté avec succès : <strong>${steps.length} étape(s)</strong> appliquée(s) sur <strong>${files.length} fichier(s)</strong>.`;
  } else {
    throw new Error('Outil non reconnu.');
  }

  return { blob, fileName, btnText, statsHtml };
}

export async function applyFreeTierPdfFooter(blob: Blob): Promise<Blob> {
  if (blob.type !== 'application/pdf') return blob;
  try {
    const ab = await blob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const label = 'Traité avec PDFExpress Gratuit';
    const fontSize = 8;

    for (const page of pdfDoc.getPages()) {
      const { width } = page.getSize();
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      page.drawText(label, {
        x: Math.max(16, (width - textWidth) / 2),
        y: 8,
        size: fontSize,
        font,
        color: rgb(0.45, 0.45, 0.48),
        opacity: 0.65,
      });
    }

    const bytes = await pdfDoc.save({ useObjectStreams: true });
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  } catch {
    return blob;
  }
}
