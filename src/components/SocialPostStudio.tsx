import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Layers,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  LoadedFile,
  SocialPlatformId,
  SocialSlide,
  SocialThemeId,
} from '../types/pdf';
import { extractFullTextFromPdfJs, formatBytes } from '../utils/pdfEngine';

interface SocialPostStudioProps {
  loadedFile: LoadedFile | null;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onExportRecorded: (fileName: string, sizeFormatted: string) => void;
}

interface PlatformPreset {
  id: SocialPlatformId;
  label: string;
  network: string;
  w: number;
  h: number;
  ratioLabel: string;
}

const PLATFORMS: PlatformPreset[] = [
  {
    id: 'linkedin_carousel',
    label: 'LinkedIn Carrousel PDF',
    network: 'LinkedIn',
    w: 1080,
    h: 1350,
    ratioLabel: '4:5 (1080×1350)',
  },
  {
    id: 'linkedin_post',
    label: 'LinkedIn Post Carré',
    network: 'LinkedIn',
    w: 1080,
    h: 1080,
    ratioLabel: '1:1 (1080×1080)',
  },
  {
    id: 'instagram_square',
    label: 'Instagram Post',
    network: 'Instagram',
    w: 1080,
    h: 1080,
    ratioLabel: '1:1 (1080×1080)',
  },
  {
    id: 'instagram_story',
    label: 'Story / TikTok / Reels',
    network: 'Instagram & TikTok',
    w: 1080,
    h: 1920,
    ratioLabel: '9:16 (1080×1920)',
  },
  {
    id: 'x_post',
    label: 'X (Twitter) Paysage',
    network: 'X (Twitter)',
    w: 1200,
    h: 675,
    ratioLabel: '16:9 (1200×675)',
  },
  {
    id: 'facebook_post',
    label: 'Facebook Partage',
    network: 'Facebook',
    w: 1200,
    h: 630,
    ratioLabel: '1.91:1 (1200×630)',
  },
];

interface ThemeStyle {
  id: SocialThemeId;
  label: string;
  bgStart: string;
  bgEnd: string;
  accent: string;
  titleColor: string;
  bodyColor: string;
  badgeBg: string;
  badgeText: string;
  cardBorder: string;
  footerBg: string;
  swatch: string;
}

const THEMES: Record<SocialThemeId, ThemeStyle> = {
  brand_red: {
    id: 'brand_red',
    label: 'PDFExpress Rouge',
    bgStart: '#FFFFFF',
    bgEnd: '#FFF5F5',
    accent: '#E5322D',
    titleColor: '#111827',
    bodyColor: '#4B5563',
    badgeBg: '#FEE2E2',
    badgeText: '#B91C1C',
    cardBorder: '#FECACA',
    footerBg: '#F9FAFB',
    swatch: 'bg-[#E5322D]',
  },
  midnight: {
    id: 'midnight',
    label: 'Minuit Pro',
    bgStart: '#0F172A',
    bgEnd: '#1E293B',
    accent: '#F43F5E',
    titleColor: '#F8FAFC',
    bodyColor: '#CBD5E1',
    badgeBg: 'rgba(244,63,94,0.18)',
    badgeText: '#FDA4AF',
    cardBorder: 'rgba(255,255,255,0.12)',
    footerBg: 'rgba(15,23,42,0.55)',
    swatch: 'bg-slate-900',
  },
  emerald: {
    id: 'emerald',
    label: 'Émeraude Tech',
    bgStart: '#064E3B',
    bgEnd: '#022C22',
    accent: '#34D399',
    titleColor: '#ECFDF5',
    bodyColor: '#A7F3D0',
    badgeBg: 'rgba(52,211,153,0.18)',
    badgeText: '#6EE7B7',
    cardBorder: 'rgba(167,243,208,0.2)',
    footerBg: 'rgba(2,44,34,0.65)',
    swatch: 'bg-emerald-700',
  },
  amber_gold: {
    id: 'amber_gold',
    label: 'Ambre Premium',
    bgStart: '#1C1917',
    bgEnd: '#292524',
    accent: '#FBBF24',
    titleColor: '#FAFAF9',
    bodyColor: '#D6D3D1',
    badgeBg: 'rgba(251,191,36,0.2)',
    badgeText: '#FDE68A',
    cardBorder: 'rgba(251,191,36,0.25)',
    footerBg: 'rgba(28,25,23,0.7)',
    swatch: 'bg-amber-400',
  },
  ocean: {
    id: 'ocean',
    label: 'Océan Corporate',
    bgStart: '#1E3A8A',
    bgEnd: '#0369A1',
    accent: '#38BDF8',
    titleColor: '#FFFFFF',
    bodyColor: '#E0F2FE',
    badgeBg: 'rgba(56,189,248,0.2)',
    badgeText: '#BAE6FD',
    cardBorder: 'rgba(255,255,255,0.18)',
    footerBg: 'rgba(15,23,42,0.35)',
    swatch: 'bg-blue-700',
  },
  paper: {
    id: 'paper',
    label: 'Éditorial Papier',
    bgStart: '#FAF7F2',
    bgEnd: '#F3EDE2',
    accent: '#111827',
    titleColor: '#1C1917',
    bodyColor: '#57534E',
    badgeBg: '#E7E5E4',
    badgeText: '#1C1917',
    cardBorder: '#D6D3D1',
    footerBg: '#EFEAE0',
    swatch: 'bg-stone-300',
  },
};

const QUICK_IDEAS = [
  {
    label: '5 astuces PDF pro',
    topic: '5 astuces pour compresser, signer et sécuriser vos PDF en moins de 2 minutes',
    tone: 'Éducatif',
  },
  {
    label: 'Lancement Premium',
    topic: 'Nouvelle offre PDFExpress Premium accessible par virement bancaire en MAD, USD et EUR',
    tone: 'Annonce',
  },
  {
    label: 'OCR IA & Productivité',
    topic: 'Comment transformer vos documents scannés en texte exploitable grâce à l’OCR IA',
    tone: 'Professionnel',
  },
];

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function renderSlideToCanvas(
  canvas: HTMLCanvasElement,
  slide: SocialSlide,
  slideIdx: number,
  totalSlides: number,
  platform: PlatformPreset,
  theme: ThemeStyle,
  authorName: string,
  authorHandle: string
) {
  const w = platform.w;
  const h = platform.h;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isWide = w > h;
  const padX = Math.round(w * 0.08);
  const padY = Math.round(h * (isWide ? 0.1 : 0.075));

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, theme.bgStart);
  grad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle decorative accent circles
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(w * 0.92, h * 0.12, Math.min(w, h) * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.08, h * 0.88, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Top accent bar
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, w, isWide ? 10 : 14);

  // Top row: badge + slide counter
  const topY = padY;
  const badgeFontSize = isWide ? 20 : 24;
  ctx.font = `800 ${badgeFontSize}px Inter, system-ui, sans-serif`;
  const badgeLabel = (slide.badge || 'PDFEXPRESS').toUpperCase();
  const badgeTextW = ctx.measureText(badgeLabel).width;
  const badgePadX = 22;
  const badgeH = badgeFontSize + 24;

  ctx.fillStyle = theme.badgeBg;
  drawRoundedRect(ctx, padX, topY, badgeTextW + badgePadX * 2, badgeH, 999);
  ctx.fill();

  ctx.fillStyle = theme.badgeText;
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeLabel, padX + badgePadX, topY + badgeH / 2 + 1);

  if (totalSlides > 1) {
    const counterLabel = `${String(slideIdx + 1).padStart(2, '0')} / ${String(
      totalSlides
    ).padStart(2, '0')}`;
    ctx.font = `800 ${badgeFontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'right';
    ctx.fillText(counterLabel, w - padX, topY + badgeH / 2 + 1);
    ctx.textAlign = 'left';
  }

  // Content area (title + body + CTA pill)
  const contentWidth = w - padX * 2;
  const titleFontSize = isWide ? 48 : h > 1600 ? 64 : 58;
  const bodyFontSize = isWide ? 27 : h > 1600 ? 34 : 32;

  ctx.font = `900 ${titleFontSize}px Inter, system-ui, sans-serif`;
  const titleLines = wrapCanvasLines(ctx, slide.title || '', contentWidth).slice(0, 5);
  ctx.font = `500 ${bodyFontSize}px Inter, system-ui, sans-serif`;
  const bodyLines = wrapCanvasLines(ctx, slide.body || '', contentWidth).slice(0, 7);

  const titleLineH = Math.round(titleFontSize * 1.18);
  const bodyLineH = Math.round(bodyFontSize * 1.42);
  const footerHeight = isWide ? 78 : 96;
  const availableTop = topY + badgeH + (isWide ? 24 : 44);
  const availableBottom = h - padY - footerHeight - 20;
  const totalBlockH =
    titleLines.length * titleLineH +
    (bodyLines.length > 0 ? 24 + bodyLines.length * bodyLineH : 0) +
    (slide.cta ? 76 : 0);

  let cursorY = Math.max(
    availableTop,
    availableTop + (availableBottom - availableTop - totalBlockH) * 0.35
  );

  // Draw Title
  ctx.font = `900 ${titleFontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = theme.titleColor;
  ctx.textBaseline = 'top';
  for (const line of titleLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += titleLineH;
  }

  // Accent divider bar
  cursorY += isWide ? 10 : 18;
  ctx.fillStyle = theme.accent;
  drawRoundedRect(ctx, padX, cursorY, 76, 6, 3);
  ctx.fill();
  cursorY += isWide ? 18 : 28;

  // Draw Body
  ctx.font = `500 ${bodyFontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = theme.bodyColor;
  for (const line of bodyLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += bodyLineH;
  }

  // Draw CTA if present
  if (slide.cta.trim()) {
    cursorY += isWide ? 18 : 30;
    const ctaSize = isWide ? 22 : 25;
    ctx.font = `800 ${ctaSize}px Inter, system-ui, sans-serif`;
    const ctaW = Math.min(contentWidth, ctx.measureText(slide.cta).width + 52);
    const ctaH = ctaSize + 28;
    ctx.fillStyle = theme.accent;
    drawRoundedRect(ctx, padX, cursorY, ctaW, ctaH, 16);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(slide.cta, padX + 26, cursorY + ctaH / 2 + 1);
  }

  // Footer bar
  const footerY = h - padY - footerHeight + 16;
  ctx.fillStyle = theme.footerBg;
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, padX, footerY, contentWidth, footerHeight - 16, 18);
  ctx.fill();
  ctx.stroke();

  ctx.textBaseline = 'middle';
  const fMidY = footerY + (footerHeight - 16) / 2;
  ctx.font = `800 ${isWide ? 20 : 24}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = theme.titleColor;
  ctx.fillText(authorName || 'PDFExpress', padX + 24, fMidY);

  ctx.font = `600 ${isWide ? 18 : 22}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = theme.bodyColor;
  ctx.textAlign = 'right';
  ctx.fillText(authorHandle || '@pdfexpress', w - padX - 24, fMidY);
  ctx.textAlign = 'left';
}

export function SocialPostStudio({
  loadedFile,
  onNotify,
  onExportRecorded,
}: SocialPostStudioProps) {
  const [platformId, setPlatformId] =
    useState<SocialPlatformId>('linkedin_carousel');
  const [themeId, setThemeId] = useState<SocialThemeId>('brand_red');
  const [topic, setTopic] = useState(
    '5 astuces pour optimiser, signer et sécuriser vos PDF en 2 minutes'
  );
  const [tone, setTone] = useState('Professionnel');
  const [authorName, setAuthorName] = useState('PDFExpress');
  const [authorHandle, setAuthorHandle] = useState('@pdfexpress');
  const [slides, setSlides] = useState<SocialSlide[]>([
    {
      id: crypto.randomUUID(),
      badge: 'GUIDE PRATIQUE',
      title: 'Maîtrisez vos PDF sans effort',
      body: 'Découvrez comment compresser, fusionner, signer et convertir vos documents directement depuis votre navigateur.',
      cta: 'Faites défiler →',
    },
    {
      id: crypto.randomUUID(),
      badge: 'ASTUCE 01',
      title: 'Compressez sans perdre en netteté',
      body: 'Réduisez jusqu’à 70% le poids de vos rapports avant envoi par e-mail ou archivage.',
      cta: 'Slide 02 / 03',
    },
    {
      id: crypto.randomUUID(),
      badge: 'À RETENIR',
      title: 'Partagez et signez en 1 clic',
      body: 'Mémorisez votre signature électronique et automatisez vos flux documentaires.',
      cta: 'Enregistrez ce post',
    },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [caption, setCaption] = useState(
    '🚀 Vos documents PDF vous font perdre du temps ?\n\nVoici 3 réflexes simples pour gagner en efficacité au quotidien sans installer de logiciel lourd.\n\n👉 Enregistrez ce carrousel pour votre prochaine présentation !'
  );
  const [hashtagsText, setHashtagsText] = useState(
    '#Productivité #PDFExpress #OutilsPro #Workflow #Digital'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoGeneratedForFileRef = useRef<string | null>(null);

  const platform =
    PLATFORMS.find((p) => p.id === platformId) || PLATFORMS[0];
  const theme = THEMES[themeId];
  const safeSlideIndex = Math.min(activeSlideIndex, Math.max(0, slides.length - 1));
  const currentSlide = slides[safeSlideIndex] || slides[0];

  const handleGeneratePost = useCallback(
    async (customTopic?: string, customTone?: string) => {
      setIsGenerating(true);
      try {
        let sourceText = '';
        if (loadedFile?.pdfJsDoc) {
          sourceText = await extractFullTextFromPdfJs(loadedFile.pdfJsDoc);
        }

        const chosenTopic = (customTopic ?? topic).trim();
        const chosenTone = customTone ?? tone;
        if (!chosenTopic && !sourceText.trim()) {
          onNotify(
            'Saisissez un sujet ou importez un fichier PDF pour générer le post.',
            'error'
          );
          return;
        }

        const res = await fetch('/api/ai/social-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: chosenTopic || loadedFile?.name || 'Document PDF',
            sourceText,
            platform: platform.label,
            tone: chosenTone,
            slideCount:
              platformId === 'x_post' || platformId === 'facebook_post' ? 1 : 4,
          }),
        });

        const data = (await res.json()) as {
          caption?: string;
          hashtags?: string[];
          slides?: Array<{
            badge: string;
            title: string;
            body: string;
            cta: string;
          }>;
          error?: string;
        };

        if (!res.ok || !data.slides || data.slides.length === 0) {
          throw new Error(data.error || 'Génération impossible.');
        }

        setSlides(
          data.slides.map((s) => ({
            id: crypto.randomUUID(),
            badge: s.badge || 'PDFEXPRESS',
            title: s.title || '',
            body: s.body || '',
            cta: s.cta || '',
          }))
        );
        setActiveSlideIndex(0);
        if (data.caption) setCaption(data.caption);
        if (Array.isArray(data.hashtags)) {
          setHashtagsText(data.hashtags.join(' '));
        }
        onNotify('Post et visuels générés avec succès !', 'success');
      } catch (err) {
        onNotify(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la génération du post.',
          'error'
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [loadedFile, onNotify, platform.label, platformId, tone, topic]
  );

  // Auto-generate draft once when a PDF source is loaded
  useEffect(() => {
    if (!loadedFile?.id || !loadedFile.pdfJsDoc) return;
    if (autoGeneratedForFileRef.current === loadedFile.id) return;
    autoGeneratedForFileRef.current = loadedFile.id;
    const cleanName = loadedFile.name.replace(/\.pdf$/i, '');
    setTopic(`Les points clés du document : ${cleanName}`);
    void handleGeneratePost(`Les points clés du document : ${cleanName}`, tone);
  }, [loadedFile, handleGeneratePost, tone]);

  // Redraw preview canvas on every edit
  useEffect(() => {
    if (!previewCanvasRef.current || !currentSlide) return;
    renderSlideToCanvas(
      previewCanvasRef.current,
      currentSlide,
      safeSlideIndex,
      slides.length,
      platform,
      theme,
      authorName,
      authorHandle
    );
  }, [
    currentSlide,
    safeSlideIndex,
    slides.length,
    platform,
    theme,
    authorName,
    authorHandle,
  ]);

  const updateCurrentSlide = (patch: Partial<SocialSlide>) => {
    setSlides((prev) =>
      prev.map((s, idx) => (idx === safeSlideIndex ? { ...s, ...patch } : s))
    );
  };

  const renderSlideBlob = (slideIdx: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const offscreen = document.createElement('canvas');
      renderSlideToCanvas(
        offscreen,
        slides[slideIdx],
        slideIdx,
        slides.length,
        platform,
        theme,
        authorName,
        authorHandle
      );
      offscreen.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Impossible de générer l’image PNG.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onExportRecorded(fileName, formatBytes(blob.size));
  };

  const handleDownloadCurrentPng = async () => {
    setIsExporting(true);
    try {
      const blob = await renderSlideBlob(safeSlideIndex);
      const fileName = `post_${platform.id}_slide_${safeSlideIndex + 1}.png`;
      triggerDownload(blob, fileName);
      onNotify(`Image PNG téléchargée (${platform.ratioLabel}).`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Erreur export PNG.',
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAllZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const blob = await renderSlideBlob(i);
        zip.file(`slide_${String(i + 1).padStart(2, '0')}.png`, blob);
      }
      const fullPostText = `${caption}\n\n${hashtagsText}`.trim();
      zip.file('texte_du_post.txt', fullPostText);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fileName = `pack_social_${platform.id}.zip`;
      triggerDownload(zipBlob, fileName);
      onNotify(`Pack de ${slides.length} visuels + texte téléchargé.`, 'success');
    } catch {
      onNotify('Erreur lors de la création de l’archive ZIP.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCarouselPdf = async () => {
    setIsExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.setTitle(`Carrousel Social - ${platform.network}`);
      pdfDoc.setCreator('PDFExpress Social Studio');

      for (let i = 0; i < slides.length; i++) {
        const pngBlob = await renderSlideBlob(i);
        const pngBytes = await pngBlob.arrayBuffer();
        const img = await pdfDoc.embedPng(pngBytes);
        const page = pdfDoc.addPage([platform.w, platform.h]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: platform.w,
          height: platform.h,
        });
      }

      const bytes = await pdfDoc.save();
      const pdfBlob = new Blob([new Uint8Array(bytes)], {
        type: 'application/pdf',
      });
      const fileName = `carrousel_${platform.id}_${slides.length}p.pdf`;
      triggerDownload(pdfBlob, fileName);
      onNotify(
        `Carrousel PDF (${slides.length} page(s)) prêt pour LinkedIn !`,
        'success'
      );
    } catch {
      onNotify('Erreur lors de la création du carrousel PDF.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const fullCaption = useMemo(
    () => [caption.trim(), hashtagsText.trim()].filter(Boolean).join('\n\n'),
    [caption, hashtagsText]
  );

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(fullCaption);
      setCopiedCaption(true);
      onNotify('Texte et hashtags copiés dans le presse-papiers.', 'success');
      setTimeout(() => setCopiedCaption(false), 1800);
    } catch {
      onNotify('Copie automatique impossible dans ce navigateur.', 'error');
    }
  };

  const handleNativeShare = async () => {
    try {
      const blob = await renderSlideBlob(safeSlideIndex);
      const file = new File([blob], `post_${platform.id}.png`, {
        type: 'image/png',
      });
      if (
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: currentSlide.title || 'Post PDFExpress',
          text: fullCaption,
          files: [file],
        });
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: currentSlide.title || 'Post PDFExpress',
          text: fullCaption,
        });
        return;
      }
      await handleCopyCaption();
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        await handleCopyCaption();
      }
    }
  };

  return (
    <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
      {/* Colonne Gauche : Générateur & Aperçu Visuel HD */}
      <div className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto bg-brand-bgLight dark:bg-brand-bgDark space-y-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {/* Barre de génération IA / Sujet */}
          <div className="bg-white dark:bg-brand-cardDark rounded-2xl p-4 sm:p-5 border border-neutral-200 dark:border-brand-borderDark space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
                  {loadedFile
                    ? `Source PDF : ${loadedFile.name} (${loadedFile.pageCount} p.)`
                    : 'Sujet ou idée de publication'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_IDEAS.map((idea) => (
                  <button
                    key={idea.label}
                    type="button"
                    onClick={() => {
                      setTopic(idea.topic);
                      setTone(idea.tone);
                      void handleGeneratePost(idea.topic, idea.tone);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-pink-50 dark:hover:bg-pink-950/40 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 hover:text-pink-600 transition-colors"
                  >
                    {idea.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: 5 raisons de convertir vos contrats en PDF/A..."
                className="flex-grow px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-sm outline-none focus:border-pink-600"
              />
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                aria-label="Ton de la publication"
                className="px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-bold"
              >
                <option value="Professionnel">Ton Professionnel</option>
                <option value="Dynamique">Ton Dynamique</option>
                <option value="Éducatif">Ton Éducatif</option>
                <option value="Annonce">Annonce / Lancement</option>
              </select>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void handleGeneratePost()}
                className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isGenerating ? 'Génération...' : 'Générer le post'}
                </span>
              </button>
            </div>
          </div>

          {/* Barre navigation des slides + Aperçu Canvas */}
          <div className="bg-white dark:bg-brand-cardDark rounded-3xl p-4 sm:p-6 border border-neutral-200 dark:border-brand-borderDark">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeSlideIndex === 0}
                  onClick={() =>
                    setActiveSlideIndex((i) => Math.max(0, i - 1))
                  }
                  aria-label="Slide précédente"
                  className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-35"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs sm:text-sm font-extrabold px-2 tabular-nums">
                  Slide {safeSlideIndex + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  disabled={safeSlideIndex >= slides.length - 1}
                  onClick={() =>
                    setActiveSlideIndex((i) =>
                      Math.min(slides.length - 1, i + 1)
                    )
                  }
                  aria-label="Slide suivante"
                  className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-35"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="hidden sm:inline-block text-[11px] font-semibold text-neutral-400 ml-2">
                  {platform.ratioLabel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {slides.length < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextSlide: SocialSlide = {
                        id: crypto.randomUUID(),
                        badge: `ÉTAPE 0${slides.length + 1}`,
                        title: 'Nouveau point clé à partager',
                        body: 'Ajoutez ici votre explication courte et directe pour votre audience.',
                        cta: 'Suivant →',
                      };
                      setSlides((prev) => [...prev, nextSlide]);
                      setActiveSlideIndex(slides.length);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter slide</span>
                  </button>
                )}
                {slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlides((prev) =>
                        prev.filter((_, i) => i !== safeSlideIndex)
                      );
                      setActiveSlideIndex((i) => Math.max(0, i - 1));
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 hover:bg-red-100 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-center items-center bg-neutral-100/90 dark:bg-neutral-900/70 rounded-2xl p-4 sm:p-6">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-[520px] w-auto h-auto rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800"
              />
            </div>

            {/* Texte / Légende prêt(e) à copier */}
            <div className="mt-5 pt-5 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">
                  Texte & hashtags d’accompagnement ({platform.network})
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCaption()}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  {copiedCaption ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedCaption ? 'Copié !' : 'Copier le texte'}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                aria-label="Texte du post social"
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs sm:text-sm outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={hashtagsText}
                onChange={(e) => setHashtagsText(e.target.value)}
                aria-label="Hashtags"
                placeholder="#Productivité #PDFExpress..."
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold text-pink-600 dark:text-pink-400 outline-none focus:border-pink-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Colonne Latérale Droite : Format, Thème, Édition de la slide & Exports */}
      <aside className="w-full lg:w-[390px] shrink-0 bg-white dark:bg-brand-cardDark border-t lg:border-t-0 lg:border-l border-neutral-200 dark:border-brand-borderDark flex flex-col justify-between">
        <div className="p-6 overflow-y-auto space-y-5 flex-grow">
          <div>
            <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">
              1. Réseau & Format visuel
            </label>
            <select
              value={platformId}
              onChange={(e) =>
                setPlatformId(e.target.value as SocialPlatformId)
              }
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-semibold"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.ratioLabel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">
              2. Thème graphique
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.values(THEMES) as ThemeStyle[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                    themeId === t.id
                      ? 'border-2 border-pink-600 bg-pink-50/40 dark:bg-pink-950/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full shrink-0 border border-black/10 ${t.swatch}`}
                  />
                  <span className="text-[11px] font-bold truncate">
                    {t.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {currentSlide && (
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <p className="text-xs font-bold uppercase text-neutral-500">
                3. Contenu de la slide {safeSlideIndex + 1}
              </p>
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Badge / Surtitre
                </label>
                <input
                  type="text"
                  value={currentSlide.badge}
                  onChange={(e) =>
                    updateCurrentSlide({ badge: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Titre principal
                </label>
                <input
                  type="text"
                  value={currentSlide.title}
                  onChange={(e) =>
                    updateCurrentSlide({ title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Texte de la carte
                </label>
                <textarea
                  rows={3}
                  value={currentSlide.body}
                  onChange={(e) => updateCurrentSlide({ body: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                  Bouton / Appel à l’action
                </label>
                <input
                  type="text"
                  value={currentSlide.cta}
                  onChange={(e) => updateCurrentSlide({ cta: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                    Marque / Auteur
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-400 mb-1">
                    Handle / Site
                  </label>
                  <input
                    type="text"
                    value={authorHandle}
                    onChange={(e) => setAuthorHandle(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'export & partage */}
        <div className="p-5 border-t border-neutral-200 dark:border-brand-borderDark bg-neutral-50 dark:bg-neutral-900/50 space-y-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleDownloadCarouselPdf()}
            className="w-full py-3 px-4 rounded-xl bg-brand-red hover:bg-brand-redHover text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-red-500/20"
          >
            <FileText className="w-4 h-4" />
            <span>
              Exporter en Carrousel PDF ({slides.length} page{slides.length > 1 ? 's' : ''})
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleDownloadCurrentPng()}
              className="py-2.5 px-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Image PNG</span>
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleNativeShare()}
              className="py-2.5 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Partager</span>
            </button>
          </div>

          {slides.length > 1 && (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleDownloadAllZip()}
              className="w-full py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-brand-red text-neutral-700 dark:text-neutral-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tout télécharger (Images + Texte .ZIP)</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
