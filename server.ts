import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '35mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function localExtractiveSummary(text: string, style: string): string {
  const clean = text.replace(/--- Page \d+ ---/g, '').trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const count = style === 'short' ? 4 : style === 'bullets' ? 6 : 9;
  const picked = sentences.slice(0, count);
  if (picked.length === 0) {
    return clean.slice(0, 800) || 'Aucun texte exploitable détecté dans ce document PDF.';
  }
  if (style === 'bullets') {
    return picked.map((s) => `• ${s}`).join('\n\n');
  }
  return picked.join(' ');
}

app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { text, style = 'bullets', lang = 'fr' } = req.body as {
      text?: string;
      style?: 'short' | 'bullets' | 'detailed';
      lang?: string;
    };

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Aucun texte extrait du PDF à résumer.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        summary: localExtractiveSummary(text, style),
        mode: 'local',
      });
      return;
    }

    const stylePrompt =
      style === 'short'
        ? 'Fais un résumé très concis en un paragraphe court (4 à 5 phrases).'
        : style === 'bullets'
        ? 'Présente un résumé structuré avec un titre suivi de 5 à 8 points clés clairs (puces).'
        : 'Rédige une synthèse détaillée et structurée par sections couvrant tous les points importants.';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `${stylePrompt}\n\nLangue de sortie : ${lang === 'en' ? 'Anglais' : lang === 'es' ? 'Espagnol' : 'Français'}.\n\nContenu du document PDF :\n${text.slice(0, 30000)}`,
      config: {
        systemInstruction:
          'Tu es un assistant spécialisé dans la synthèse fidèle et structurée de documents PDF professionnels.',
      },
    });

    res.json({
      summary: response.text || localExtractiveSummary(text, style),
      mode: 'ai',
    });
  } catch (err) {
    console.error('Summarize error:', err);
    const { text = '', style = 'bullets' } = (req.body || {}) as {
      text?: string;
      style?: string;
    };
    res.json({
      summary: localExtractiveSummary(text, style),
      mode: 'local',
    });
  }
});

app.post('/api/ai/translate', async (req, res) => {
  try {
    const { text, targetLang = 'Français' } = req.body as {
      text?: string;
      targetLang?: string;
    };

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Aucun texte extrait du PDF à traduire.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'La traduction automatique nécessite une clé GEMINI_API_KEY configurée dans les secrets du projet.',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Traduis fidèlement le texte suivant en ${targetLang}, en préservant les titres, paragraphes et la numérotation des pages :\n\n${text.slice(0, 30000)}`,
      config: {
        systemInstruction:
          'Tu es un traducteur professionnel de documents PDF. Conserve la structure, le ton et la mise en forme du texte source.',
      },
    });

    res.json({
      translatedText: response.text || '',
    });
  } catch (err) {
    console.error('Translate error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erreur lors de la traduction du document.',
    });
  }
});

app.post('/api/ai/ocr', async (req, res) => {
  try {
    const { pages = [], lang = 'Automatique' } = req.body as {
      pages?: Array<{ pageIndex: number; mimeType: string; data: string }>;
      lang?: string;
    };

    if (!Array.isArray(pages) || pages.length === 0) {
      res.status(400).json({
        error: 'Aucune image ou page PDF fournie pour la reconnaissance OCR.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'L’OCR avancé par IA nécessite une clé GEMINI_API_KEY configurée dans les secrets du projet.',
      });
      return;
    }

    const cappedPages = pages.slice(0, 15);
    const results: Array<{ pageIndex: number; text: string }> = [];

    for (const page of cappedPages) {
      const langInstruction =
        lang && lang !== 'Automatique'
          ? `La langue principale attendue est : ${lang}.`
          : 'Détecte automatiquement la langue du document.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: page.mimeType || 'image/jpeg',
                data: page.data,
              },
            },
            {
              text: `Effectue une reconnaissance optique de caractères (OCR) fidèle et complète de cette page. ${langInstruction} Restitue uniquement le texte lisible structuré par paragraphes, titres et tableaux simples en texte brut sans commentaires ajoutés.`,
            },
          ],
        },
        config: {
          systemInstruction:
            'Tu es un moteur OCR professionnel haute précision. Extrais tout le texte visible de l’image dans l’ordre naturel de lecture, sans inventer de contenu et sans balises superflues.',
        },
      });

      results.push({
        pageIndex: page.pageIndex,
        text: (response.text || '').trim(),
      });
    }

    const fullText = results
      .map((r) => `--- Page ${r.pageIndex + 1} ---\n${r.text}`)
      .join('\n\n');

    res.json({
      pages: results,
      fullText,
      mode: 'ai',
    });
  } catch (err) {
    console.error('OCR AI error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erreur lors de la reconnaissance optique par IA.',
    });
  }
});

function buildLocalSocialFallback(
  topic: string,
  platformLabel: string,
  tone: string,
  slideCount: number
) {
  const cleanTopic = topic.trim() || 'Gagner du temps avec vos documents PDF';
  const slides = Array.from({ length: Math.max(1, Math.min(6, slideCount)) }, (_, idx) => {
    if (idx === 0) {
      return {
        badge: platformLabel.toUpperCase(),
        title: cleanTopic.slice(0, 72),
        body: 'Découvrez les points clés, astuces concrètes et bonnes pratiques à appliquer dès aujourd’hui.',
        cta: slideCount > 1 ? 'Faites défiler →' : 'En savoir plus',
      };
    }
    if (idx === slideCount - 1) {
      return {
        badge: 'À RETENIR',
        title: 'Passez à l’action dès maintenant',
        body: 'Centralisez, compressez, signez et partagez vos documents en quelques secondes directement depuis votre navigateur.',
        cta: 'Enregistrez & partagez ce post',
      };
    }
    return {
      badge: `ÉTAPE 0${idx}`,
      title: `Point essentiel #${idx} sur ${cleanTopic.slice(0, 38)}`,
      body: 'Optimisez votre flux documentaire : gagnez en clarté, réduisez les allers-retours et sécurisez vos fichiers.',
      cta: `Slide ${idx + 1}/${slideCount}`,
    };
  });

  const toneIntro =
    tone === 'Dynamique'
      ? '🚀 Prêt(e) à transformer votre quotidien ?'
      : tone === 'Éducatif'
      ? '💡 Guide pratique à garder sous la main :'
      : tone === 'Annonce'
      ? '✨ Nouveauté importante à découvrir :'
      : '📌 Focus professionnel du jour :';

  return {
    caption: `${toneIntro}\n\n${cleanTopic}\n\nVoici l’essentiel résumé de manière claire et actionnable pour votre équipe et votre réseau.\n\n👉 Dites-nous en commentaire quel conseil vous appliquez déjà !`,
    hashtags: ['#Productivité', '#PDFExpress', '#Digital', '#AstucesPro', '#Workflow'],
    slides,
    mode: 'local' as const,
  };
}

app.post('/api/ai/social-post', async (req, res) => {
  const {
    topic = '',
    sourceText = '',
    platform = 'LinkedIn',
    tone = 'Professionnel',
    slideCount = 4,
  } = (req.body || {}) as {
    topic?: string;
    sourceText?: string;
    platform?: string;
    tone?: string;
    slideCount?: number;
  };

  const requestedSlides = Math.max(1, Math.min(6, Number(slideCount) || 4));
  const combinedInput = [topic.trim(), sourceText.trim().slice(0, 12000)]
    .filter(Boolean)
    .join('\n\nContenu source PDF :\n');

  if (!combinedInput) {
    res.status(400).json({
      error: 'Indiquez un sujet ou chargez un document PDF pour générer le post.',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json(
      buildLocalSocialFallback(
        topic || sourceText.slice(0, 70),
        platform,
        tone,
        requestedSlides
      )
    );
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Génère un post prêt à publier pour ${platform} sur le ton "${tone}" avec exactement ${requestedSlides} slide(s) visuelle(s).\n\nSujet / Contexte :\n${combinedInput}`,
      config: {
        systemInstruction:
          'Tu es un expert social media francophone. Produis un texte accrocheur, des hashtags pertinents (sans doublons) et des slides courtes, percutantes et faciles à lire sur mobile.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: {
              type: Type.STRING,
              description: 'Texte complet du post social avec accroche, corps structuré et appel à l’action.',
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Liste de 4 à 6 hashtags commençant par #.',
            },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  badge: { type: Type.STRING },
                  title: { type: Type.STRING },
                  body: { type: Type.STRING },
                  cta: { type: Type.STRING },
                },
              },
              description: 'Liste des slides visuelles du post ou carrousel.',
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim()) as {
      caption?: string;
      hashtags?: string[];
      slides?: Array<{ badge?: string; title?: string; body?: string; cta?: string }>;
    };

    if (!parsed.caption || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      res.json(
        buildLocalSocialFallback(
          topic || sourceText.slice(0, 70),
          platform,
          tone,
          requestedSlides
        )
      );
      return;
    }

    res.json({
      caption: parsed.caption,
      hashtags: (parsed.hashtags || ['#Productivité', '#PDF']).slice(0, 6),
      slides: parsed.slides.slice(0, 6).map((s, idx) => ({
        badge: (s.badge || `SLIDE ${idx + 1}`).slice(0, 28),
        title: (s.title || 'Titre du visuel').slice(0, 90),
        body: (s.body || '').slice(0, 240),
        cta: (s.cta || '').slice(0, 48),
      })),
      mode: 'ai',
    });
  } catch (err) {
    console.error('Social post AI error:', err);
    res.json(
      buildLocalSocialFallback(
        topic || sourceText.slice(0, 70),
        platform,
        tone,
        requestedSlides
      )
    );
  }
});

const guestQuotaMap = new Map<string, { dateKey: string; count: number }>();

function getClientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd)
    ? fwd[0]
    : typeof fwd === 'string'
    ? fwd.split(',')[0]
    : req.socket?.remoteAddress || 'unknown';
  return String(raw || 'unknown').trim().slice(0, 64);
}

app.get('/api/device/client-info', (req, res) => {
  res.json({
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
  });
});

app.post('/api/quota/guest/status', (req, res) => {
  const { deviceFingerprint = '' } = (req.body || {}) as {
    deviceFingerprint?: string;
  };
  const today = new Date().toISOString().slice(0, 10);
  const ip = getClientIp(req);
  const keyFp = deviceFingerprint
    ? `fp:${deviceFingerprint.slice(0, 80)}`
    : `ip:${ip}`;
  const entry = guestQuotaMap.get(keyFp);
  const count = entry && entry.dateKey === today ? entry.count : 0;
  res.json({ count, limit: 2, dateKey: today });
});

app.post('/api/quota/guest/consume', (req, res) => {
  const { deviceFingerprint = '' } = (req.body || {}) as {
    deviceFingerprint?: string;
  };
  const today = new Date().toISOString().slice(0, 10);
  const ip = getClientIp(req);
  const keyFp = deviceFingerprint
    ? `fp:${deviceFingerprint.slice(0, 80)}`
    : `ip:${ip}`;

  if (guestQuotaMap.size > 5000) {
    for (const [k, v] of guestQuotaMap.entries()) {
      if (v.dateKey !== today) guestQuotaMap.delete(k);
    }
  }

  const existing = guestQuotaMap.get(keyFp);
  const nextCount =
    existing && existing.dateKey === today ? existing.count + 1 : 1;
  guestQuotaMap.set(keyFp, { dateKey: today, count: nextCount });
  res.json({ count: nextCount, limit: 2, dateKey: today });
});

const bankTransfers: Array<Record<string, unknown>> = [];

app.post('/api/billing/bank-transfer', (req, res) => {
  const {
    reference,
    planId,
    planLabel,
    cycle,
    currency,
    amount,
    formattedAmount,
    payerName,
    payerEmail,
    bankOrigin,
    transferDate,
  } = (req.body || {}) as Record<string, unknown>;

  if (
    typeof payerName !== 'string' ||
    !payerName.trim() ||
    typeof payerEmail !== 'string' ||
    !payerEmail.includes('@') ||
    typeof reference !== 'string' ||
    !reference.trim() ||
    (currency !== 'MAD' && currency !== 'USD' && currency !== 'EUR')
  ) {
    res.status(400).json({
      error:
        'Veuillez renseigner un nom valide, une adresse e-mail, une devise (MAD, USD ou EUR) et une référence de virement.',
    });
    return;
  }

  const record = {
    reference: reference.trim(),
    planId: planId === 'premium_team' ? 'premium_team' : 'premium_pro',
    planLabel: typeof planLabel === 'string' ? planLabel : 'Premium Pro',
    cycle: cycle === 'annual' ? 'annual' : 'monthly',
    currency,
    amount: Number(amount) || 0,
    formattedAmount:
      typeof formattedAmount === 'string' ? formattedAmount : `${amount} ${currency}`,
    payerName: payerName.trim(),
    payerEmail: payerEmail.trim(),
    bankOrigin: typeof bankOrigin === 'string' ? bankOrigin.trim() : '',
    transferDate:
      typeof transferDate === 'string' && transferDate
        ? transferDate
        : new Date().toISOString().slice(0, 10),
    status: 'pending_verification' as const,
    createdAt: Date.now(),
  };

  bankTransfers.unshift(record);
  if (bankTransfers.length > 100) bankTransfers.pop();

  res.json({ ok: true, submission: record });
});

const FALLBACK_TOOL_IDS = [
  'merge',
  'split',
  'removepages',
  'extractpages',
  'organizepages',
  'scan2pdf',
  'compress',
  'repair',
  'ocr',
  'jpg2pdf',
  'word2pdf',
  'ppt2pdf',
  'excel2pdf',
  'html2pdf',
  'pdf2jpg',
  'pdf2word',
  'pdf2ppt',
  'pdf2excel',
  'pdf2pdfa',
  'pdf2md',
  'rotate',
  'pagenumbers',
  'watermark',
  'crop',
  'editpdf',
  'pdfforms',
  'unlock',
  'protect',
  'sign',
  'redact',
  'compare',
  'aisummary',
  'translatepdf',
  'aiocr',
  'socialpost',
  'workflow',
];

function getDynamicToolIds(): string[] {
  try {
    const toolsFilePath = path.resolve(__dirname, 'src/data/tools.ts');
    const source = fs.readFileSync(toolsFilePath, 'utf-8');
    const toolsSection = source.split('export const TOOLS')[1] || source;
    const matches = [...toolsSection.matchAll(/^\s*id:\s*'([a-z0-9_-]+)'/gm)];
    const extracted = matches.map((m) => m[1]);
    if (extracted.length > 0) {
      return [...new Set(extracted)];
    }
  } catch {
    // Fallback to static list when src is absent in minimal prod image
  }
  return FALLBACK_TOOL_IDS;
}

function getBaseUrl(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader)?.split(',')[0]?.trim() ||
    req.protocol ||
    'https';
  const hostHeader = req.headers['x-forwarded-host'] || req.get('host');
  const host =
    (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.split(',')[0]?.trim() ||
    `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type('text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /admin',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const lastmod = new Date().toISOString().slice(0, 10);
  const toolIds = getDynamicToolIds();

  const entries = [
    { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${baseUrl}/tarifs`, changefreq: 'weekly', priority: '0.8' },
    ...toolIds.map((id) => ({
      loc: `${baseUrl}/?tool=${encodeURIComponent(id)}`,
      changefreq: 'weekly',
      priority: '0.9',
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
    ),
    '</urlset>',
  ].join('\n');

  res.type('application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800');
  res.send(xml);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDFExpress server running on http://localhost:${PORT}`);
  });
}

startServer();
