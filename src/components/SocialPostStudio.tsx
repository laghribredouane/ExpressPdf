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
  Film,
  Layers,
  Pause,
  Play,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  PDFEXPRESS_FIVE_POSTS,
  type SocialCampaignPreset,
} from '../data/socialCampaigns';
import type {
  LoadedFile,
  SocialPlatformId,
  SocialSlide,
  SocialThemeId,
} from '../types/pdf';
import { encodeAnimatedGif } from '../utils/animatedGif';
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
  ctx.fillText(authorHandle || 'pdfexpress.ai.studio', w - padX - 24, fMidY);
  ctx.textAlign = 'left';
}

type AnimationStyle = 'carousel_slide' | 'kinetic_pulse' | 'editorial_reveal';

const SLIDE_DURATION_MS = 2200;

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

function renderAnimatedCompositeFrame(
  targetCanvas: HTMLCanvasElement,
  slidesList: SocialSlide[],
  elapsedMs: number,
  platform: PlatformPreset,
  theme: ThemeStyle,
  authorName: string,
  authorHandle: string,
  animStyle: AnimationStyle,
  singleSlideIndex?: number
) {
  const safeList = slidesList.length > 0 ? slidesList : [];
  if (safeList.length === 0) return;

  const w = platform.w;
  const h = platform.h;
  if (targetCanvas.width !== w) targetCanvas.width = w;
  if (targetCanvas.height !== h) targetCanvas.height = h;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  const totalCycleMs =
    typeof singleSlideIndex === 'number'
      ? SLIDE_DURATION_MS
      : safeList.length * SLIDE_DURATION_MS;
  const cycleMs = ((elapsedMs % totalCycleMs) + totalCycleMs) % totalCycleMs;

  const activeIdx =
    typeof singleSlideIndex === 'number'
      ? Math.min(singleSlideIndex, safeList.length - 1)
      : Math.floor(cycleMs / SLIDE_DURATION_MS) % safeList.length;
  const localMs =
    typeof singleSlideIndex === 'number'
      ? cycleMs
      : cycleMs - activeIdx * SLIDE_DURATION_MS;
  const localProgress = Math.max(0, Math.min(1, localMs / SLIDE_DURATION_MS));

  // Offscreen static render for current slide
  const slideCanvasA = document.createElement('canvas');
  renderSlideToCanvas(
    slideCanvasA,
    safeList[activeIdx],
    activeIdx,
    safeList.length,
    platform,
    theme,
    authorName,
    authorHandle
  );

  ctx.clearRect(0, 0, w, h);

  const transitionWindow = 0.18;
  if (
    animStyle === 'carousel_slide' &&
    safeList.length > 1 &&
    localProgress < transitionWindow
  ) {
    const prevIdx = (activeIdx - 1 + safeList.length) % safeList.length;
    const slideCanvasPrev = document.createElement('canvas');
    renderSlideToCanvas(
      slideCanvasPrev,
      safeList[prevIdx],
      prevIdx,
      safeList.length,
      platform,
      theme,
      authorName,
      authorHandle
    );
    const t = easeOutCubic(localProgress / transitionWindow);
    const offset = Math.round((1 - t) * w);
    ctx.save();
    ctx.globalAlpha = 1 - t * 0.35;
    ctx.drawImage(slideCanvasPrev, offset - w, 0, w, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = t;
    ctx.drawImage(slideCanvasA, offset, 0, w, h);
    ctx.restore();
  } else if (animStyle === 'kinetic_pulse') {
    const pulse = 1 + 0.025 * Math.sin(localProgress * Math.PI * 2);
    const dw = w * pulse;
    const dh = h * pulse;
    ctx.drawImage(slideCanvasA, (w - dw) / 2, (h - dh) / 2, dw, dh);

    // Sweeping light sheen
    const sheenX = -w * 0.3 + localProgress * w * 1.6;
    const sheenGrad = ctx.createLinearGradient(sheenX, 0, sheenX + w * 0.28, h);
    sheenGrad.addColorStop(0, 'rgba(255,255,255,0)');
    sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, w, h);
  } else if (animStyle === 'editorial_reveal') {
    const revealT = easeOutCubic(Math.min(1, localProgress / 0.35));
    const slideOffsetY = Math.round((1 - revealT) * 28);
    ctx.fillStyle = theme.bgStart;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = Math.max(0.15, revealT);
    ctx.drawImage(slideCanvasA, 0, slideOffsetY, w, h);
    ctx.restore();
  } else {
    const settleZoom = 1 + 0.012 * Math.sin(localProgress * Math.PI);
    const dw = w * settleZoom;
    const dh = h * settleZoom;
    ctx.drawImage(slideCanvasA, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  // Animated top timeline progress bar across slides
  const barH = w > h ? 8 : 10;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, h - barH, w, barH);
  const overallProgress =
    typeof singleSlideIndex === 'number'
      ? localProgress
      : (activeIdx + localProgress) / safeList.length;
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, h - barH, Math.round(w * overallProgress), barH);
}

function createSlidesFromPreset(preset: SocialCampaignPreset): SocialSlide[] {
  return preset.slides.map((s) => ({
    id: crypto.randomUUID(),
    badge: s.badge,
    title: s.title,
    body: s.body,
    cta: s.cta,
  }));
}

export function SocialPostStudio({
  loadedFile,
  onNotify,
  onExportRecorded,
}: SocialPostStudioProps) {
  const initialCampaign = PDFEXPRESS_FIVE_POSTS[0];
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    initialCampaign.id
  );
  const [platformId, setPlatformId] = useState<SocialPlatformId>(
    initialCampaign.platformId
  );
  const [themeId, setThemeId] = useState<SocialThemeId>(initialCampaign.themeId);
  const [topic, setTopic] = useState(initialCampaign.topic);
  const [tone, setTone] = useState(initialCampaign.tone);
  const [authorName, setAuthorName] = useState('PDFExpress');
  const [authorHandle, setAuthorHandle] = useState('pdfexpress.ai.studio');
  const [slides, setSlides] = useState<SocialSlide[]>(() =>
    createSlidesFromPreset(initialCampaign)
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [caption, setCaption] = useState(initialCampaign.adCopy);
  const [hashtagsText, setHashtagsText] = useState(initialCampaign.hashtags);
  const [animStyle, setAnimStyle] = useState<AnimationStyle>('carousel_slide');
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatusLabel, setExportStatusLabel] = useState<string | null>(
    null
  );
  const [copiedCaption, setCopiedCaption] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoGeneratedForFileRef = useRef<string | null>(null);

  const platform =
    PLATFORMS.find((p) => p.id === platformId) || PLATFORMS[0];
  const theme = THEMES[themeId];
  const safeSlideIndex = Math.min(activeSlideIndex, Math.max(0, slides.length - 1));
  const currentSlide = slides[safeSlideIndex] || slides[0];

  const applyCampaignPreset = useCallback(
    (preset: SocialCampaignPreset) => {
      setSelectedCampaignId(preset.id);
      setPlatformId(preset.platformId);
      setThemeId(preset.themeId);
      setTopic(preset.topic);
      setTone(preset.tone);
      setSlides(createSlidesFromPreset(preset));
      setActiveSlideIndex(0);
      setCaption(preset.adCopy);
      setHashtagsText(preset.hashtags);
      setIsPlayingAnimation(true);
      onNotify(
        `${preset.number} (${preset.networkLabel}) chargé avec Ad Copy et visuel animé.`,
        'success'
      );
    },
    [onNotify]
  );

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

  // Animate or draw static preview canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !currentSlide) return;

    if (!isPlayingAnimation) {
      renderSlideToCanvas(
        canvas,
        currentSlide,
        safeSlideIndex,
        slides.length,
        platform,
        theme,
        authorName,
        authorHandle
      );
      return;
    }

    let rafId = 0;
    const startTime = performance.now() - safeSlideIndex * SLIDE_DURATION_MS;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      renderAnimatedCompositeFrame(
        canvas,
        slides,
        elapsed,
        platform,
        theme,
        authorName,
        authorHandle,
        animStyle
      );
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    isPlayingAnimation,
    animStyle,
    currentSlide,
    safeSlideIndex,
    slides,
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

  const buildAnimatedGifBlob = async (
    targetSlides: SocialSlide[],
    targetPlatform: PlatformPreset,
    targetTheme: ThemeStyle,
    targetAnimStyle: AnimationStyle
  ): Promise<Blob> => {
    const maxDim = 540;
    const scale = Math.min(1, maxDim / Math.max(targetPlatform.w, targetPlatform.h));
    const gifW = Math.max(240, Math.round(targetPlatform.w * scale));
    const gifH = Math.max(240, Math.round(targetPlatform.h * scale));

    const hdCanvas = document.createElement('canvas');
    const gifCanvas = document.createElement('canvas');
    gifCanvas.width = gifW;
    gifCanvas.height = gifH;
    const gifCtx = gifCanvas.getContext('2d', { willReadFrequently: true });
    if (!gifCtx) {
      throw new Error('Contexte Canvas indisponible pour l’encodage GIF.');
    }

    const fps = 10;
    const delayMs = Math.round(1000 / fps);
    const totalMs = Math.max(1, targetSlides.length) * SLIDE_DURATION_MS;
    const frameCount = Math.max(12, Math.round((totalMs / 1000) * fps));
    const frames: Array<{ rgba: Uint8ClampedArray; delayMs: number }> = [];

    for (let i = 0; i < frameCount; i++) {
      const elapsed = i * delayMs;
      renderAnimatedCompositeFrame(
        hdCanvas,
        targetSlides,
        elapsed,
        targetPlatform,
        targetTheme,
        authorName,
        authorHandle,
        targetAnimStyle
      );
      gifCtx.clearRect(0, 0, gifW, gifH);
      gifCtx.drawImage(hdCanvas, 0, 0, gifW, gifH);
      const imageData = gifCtx.getImageData(0, 0, gifW, gifH);
      frames.push({
        rgba: imageData.data,
        delayMs,
      });
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return encodeAnimatedGif(gifW, gifH, frames);
  };

  const handleDownloadAnimatedGif = async () => {
    setIsExporting(true);
    setExportStatusLabel('Encodage de l’image animée (.GIF)...');
    try {
      const gifBlob = await buildAnimatedGifBlob(
        slides,
        platform,
        theme,
        animStyle
      );
      const fileName = `post_anime_${platform.id}.gif`;
      triggerDownload(gifBlob, fileName);
      onNotify(
        `Image animée GIF téléchargée (${formatBytes(gifBlob.size)}).`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Erreur export GIF animé.',
        'error'
      );
    } finally {
      setIsExporting(false);
      setExportStatusLabel(null);
    }
  };

  const handleDownloadAnimatedWebm = async () => {
    if (
      typeof MediaRecorder === 'undefined' ||
      typeof HTMLCanvasElement.prototype.captureStream !== 'function'
    ) {
      onNotify(
        'Export vidéo WebM non supporté par ce navigateur — utilisez l’export GIF animé.',
        'error'
      );
      return;
    }

    setIsExporting(true);
    setExportStatusLabel('Enregistrement vidéo animée (.WEBM)...');
    try {
      const recCanvas = document.createElement('canvas');
      recCanvas.width = platform.w;
      recCanvas.height = platform.h;
      const stream = recCanvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3_500_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const donePromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      const totalMs = Math.max(1, slides.length) * SLIDE_DURATION_MS;
      const start = performance.now();
      recorder.start();

      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          const elapsed = now - start;
          renderAnimatedCompositeFrame(
            recCanvas,
            slides,
            elapsed,
            platform,
            theme,
            authorName,
            authorHandle,
            animStyle
          );
          if (elapsed < totalMs) {
            window.requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        window.requestAnimationFrame(step);
      });

      recorder.stop();
      const webmBlob = await donePromise;
      const fileName = `video_sociale_${platform.id}.webm`;
      triggerDownload(webmBlob, fileName);
      onNotify(
        `Vidéo animée téléchargée (${formatBytes(webmBlob.size)}).`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Erreur lors de l’export vidéo WebM.',
        'error'
      );
    } finally {
      setIsExporting(false);
      setExportStatusLabel(null);
    }
  };

  const handleDownloadAllFivePostsPack = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const allCopyLines: string[] = [];

      for (let idx = 0; idx < PDFEXPRESS_FIVE_POSTS.length; idx++) {
        const preset = PDFEXPRESS_FIVE_POSTS[idx];
        setExportStatusLabel(
          `Génération ${preset.number}/05 (${preset.networkLabel})...`
        );
        const presetPlatform =
          PLATFORMS.find((p) => p.id === preset.platformId) || PLATFORMS[0];
        const presetTheme = THEMES[preset.themeId] || THEMES.brand_red;
        const presetSlides = createSlidesFromPreset(preset);

        const gifBlob = await buildAnimatedGifBlob(
          presetSlides,
          presetPlatform,
          presetTheme,
          'carousel_slide'
        );

        const folderName = `${String(idx + 1).padStart(2, '0')}_${preset.networkLabel
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')}`;
        zip.file(`${folderName}/visuel_anime.gif`, gifBlob);

        const copyContent = [
          `=== ${preset.number} · ${preset.networkLabel} (${presetPlatform.ratioLabel}) ===`,
          `Objectif : ${preset.objective}`,
          `Titre : ${preset.campaignTitle}`,
          '',
          '--- AD COPY ---',
          preset.adCopy,
          '',
          preset.hashtags,
        ].join('\n');

        zip.file(`${folderName}/adcopy.txt`, copyContent);
        allCopyLines.push(copyContent, '\n' + '='.repeat(50) + '\n');
      }

      zip.file('TOUS_LES_5_POSTS_ADCOPY.txt', allCopyLines.join('\n'));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fileName = 'pack_5_posts_pdfexpress_animes.zip';
      triggerDownload(zipBlob, fileName);
      onNotify(
        'Pack complet des 5 posts (5 images animées GIF + Ad Copy) téléchargé !',
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Erreur lors de la création du pack des 5 posts.',
        'error'
      );
    } finally {
      setIsExporting(false);
      setExportStatusLabel(null);
    }
  };

  const handleDownloadAllZip = async () => {
    setIsExporting(true);
    setExportStatusLabel('Création de l’archive ZIP...');
    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const blob = await renderSlideBlob(i);
        zip.file(`slide_${String(i + 1).padStart(2, '0')}.png`, blob);
      }
      const gifBlob = await buildAnimatedGifBlob(
        slides,
        platform,
        theme,
        animStyle
      );
      zip.file(`visuel_anime_${platform.id}.gif`, gifBlob);
      const fullPostText = `${caption}\n\n${hashtagsText}`.trim();
      zip.file('texte_du_post.txt', fullPostText);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fileName = `pack_social_${platform.id}.zip`;
      triggerDownload(zipBlob, fileName);
      onNotify(
        `Pack de ${slides.length} PNG + GIF animé + Ad Copy téléchargé.`,
        'success'
      );
    } catch {
      onNotify('Erreur lors de la création de l’archive ZIP.', 'error');
    } finally {
      setIsExporting(false);
      setExportStatusLabel(null);
    }
  };

  const handleDownloadCarouselPdf = async () => {
    setIsExporting(true);
    setExportStatusLabel('Génération du carrousel PDF...');
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
      setExportStatusLabel(null);
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
      {/* Colonne Gauche : 5 Campagnes prêtes, Générateur & Aperçu Animé */}
      <div className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto bg-brand-bgLight dark:bg-brand-bgDark space-y-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {/* 5 Posts officiels prêts à publier pour PDFExpress */}
          <div className="bg-white dark:bg-brand-cardDark rounded-2xl p-4 sm:p-5 border border-neutral-200 dark:border-brand-borderDark space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                  5 Campagnes PDFExpress prêtes à publier (Ad Copy + Image animée)
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Sélectionnez l’un des 5 posts pour prévisualiser son animation et copier son texte, ou exportez le pack complet.
                </p>
              </div>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleDownloadAllFivePostsPack()}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-brand-red dark:hover:bg-brand-red dark:hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Télécharger les 5 posts (GIF + Ad Copy .ZIP)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {PDFEXPRESS_FIVE_POSTS.map((preset) => {
                const isSelected = selectedCampaignId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyCampaignPreset(preset)}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'border-brand-red bg-red-50/60 dark:bg-red-950/30'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                      <span
                        className={`font-bold ${
                          isSelected
                            ? 'text-brand-red'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {preset.number}
                      </span>
                      <span className="text-neutral-500 dark:text-neutral-400 truncate">
                        {preset.networkLabel}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-neutral-900 dark:text-white leading-snug line-clamp-2">
                      {preset.campaignTitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

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

          {/* Barre navigation des slides + Contrôle d'animation + Aperçu Canvas */}
          <div className="bg-white dark:bg-brand-cardDark rounded-3xl p-4 sm:p-6 border border-neutral-200 dark:border-brand-borderDark">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlayingAnimation((p) => !p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isPlayingAnimation
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {isPlayingAnimation ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isPlayingAnimation ? 'Animation active' : 'Lire l’animation'}
                  </span>
                </button>

                <select
                  value={animStyle}
                  onChange={(e) => setAnimStyle(e.target.value as AnimationStyle)}
                  aria-label="Style d'animation"
                  className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs font-semibold"
                >
                  <option value="carousel_slide">Glissement carrousel</option>
                  <option value="kinetic_pulse">Zoom &amp; reflet lumineux</option>
                  <option value="editorial_reveal">Révélation éditoriale</option>
                </select>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeSlideIndex === 0}
                    onClick={() => {
                      setIsPlayingAnimation(false);
                      setActiveSlideIndex((i) => Math.max(0, i - 1));
                    }}
                    aria-label="Slide précédente"
                    className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-35"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs sm:text-sm font-extrabold px-1.5 tabular-nums">
                    Slide {safeSlideIndex + 1} / {slides.length}
                  </span>
                  <button
                    type="button"
                    disabled={safeSlideIndex >= slides.length - 1}
                    onClick={() => {
                      setIsPlayingAnimation(false);
                      setActiveSlideIndex((i) =>
                        Math.min(slides.length - 1, i + 1)
                      );
                    }}
                    aria-label="Slide suivante"
                    className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-35"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="hidden sm:inline-block text-[11px] font-semibold text-neutral-400">
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
          {exportStatusLabel && (
            <p className="text-[11px] font-mono font-semibold text-brand-red text-center">
              {exportStatusLabel}
            </p>
          )}

          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleDownloadAnimatedGif()}
            className="w-full py-3 px-4 rounded-xl bg-brand-red hover:bg-brand-redHover text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-red-500/20 cursor-pointer"
          >
            <Film className="w-4 h-4" />
            <span>
              Exporter Image animée (.GIF — {slides.length} slide
              {slides.length > 1 ? 's' : ''})
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleDownloadAnimatedWebm()}
              className="py-2.5 px-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Vidéo .WEBM</span>
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleDownloadCarouselPdf()}
              className="py-2.5 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Carrousel PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleDownloadCurrentPng()}
              className="py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-brand-red text-neutral-700 dark:text-neutral-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Slide PNG</span>
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleNativeShare()}
              className="py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-brand-red text-neutral-700 dark:text-neutral-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Partager</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleDownloadAllZip()}
            className="w-full py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-brand-red text-neutral-700 dark:text-neutral-200 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tout télécharger (GIF + PNG + Ad Copy .ZIP)</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
