import express from 'express';
import fs from 'fs';
import http from 'http';
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

app.get('/ads.txt', (_req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send('google.com, pub-7807016100432800, DIRECT, f08c47fec0942fa0\n');
});

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

app.post('/api/ai/chat', async (req, res) => {
  try {
    const {
      message,
      history = [],
      documentContext = '',
      documentName = '',
      pageCount = 0,
      actionType = 'qa',
    } = (req.body || {}) as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      documentContext?: string;
      documentName?: string;
      pageCount?: number;
      actionType?: 'qa' | 'summary' | 'translation';
    };

    const userMessage = typeof message === 'string' ? message.trim() : '';
    if (!userMessage) {
      res.status(400).json({ error: 'Veuillez saisir un message pour l’assistant.' });
      return;
    }

    const trimmedDoc = typeof documentContext === 'string' ? documentContext.trim() : '';
    const ai = getGeminiClient();

    if (!ai) {
      if (actionType === 'summary' && trimmedDoc) {
        res.json({
          reply: localExtractiveSummary(trimmedDoc, 'bullets'),
          mode: 'local',
        });
        return;
      }
      res.status(503).json({
        error:
          'L’assistant conversationnel Gemini nécessite une clé GEMINI_API_KEY configurée dans les secrets du projet.',
      });
      return;
    }

    const docSnippet = trimmedDoc.slice(0, 30000);
    const hasDoc = docSnippet.length > 0;

    const systemInstruction = hasDoc
      ? [
          'Tu es l’assistant IA officiel de PDFExpress, expert en analyse, synthèse, traduction et questions-réponses sur les documents PDF.',
          `Document PDF actuellement analysé : "${documentName || 'Document.pdf'}"${pageCount > 0 ? ` (${pageCount} page(s))` : ''}.`,
          'Règles impératives :',
          '- Appuie-toi strictement sur le contenu du document fourni ci-dessous pour répondre aux questions, résumer ou traduire.',
          '- Cite les numéros de page (ex. Page 2) lorsque cela aide l’utilisateur à retrouver l’information.',
          '- Si une information demandée est absente du document, dis-le clairement sans l’inventer.',
          '- Formate tes réponses en Markdown clair et structuré (titres courts, listes à puces, éléments clés en gras).',
          '- Réponds dans la langue de la demande de l’utilisateur (par défaut en français).',
          '',
          '--- CONTENU EXTRAIT DU DOCUMENT PDF ---',
          docSnippet,
          trimmedDoc.length > 30000
            ? '\n[Note : le texte du document a été tronqué aux 30 000 premiers caractères.]'
            : '',
        ].join('\n')
      : [
          'Tu es l’assistant IA officiel de PDFExpress (suite de 35+ outils PDF gratuits et locaux).',
          'Aucun document PDF n’est actuellement chargé dans le chat.',
          'Réponds de façon claire, concise et structurée en Markdown.',
          'Si l’utilisateur te pose une question sur un document spécifique, invite-le aimablement à charger un fichier PDF directement dans le bandeau supérieur de cette fenêtre de chat ou via n’importe quel outil PDFExpress.',
        ].join('\n');

    const sanitizedHistory = Array.isArray(history)
      ? history
          .filter(
            (item) =>
              item &&
              (item.role === 'user' || item.role === 'assistant') &&
              typeof item.content === 'string' &&
              item.content.trim().length > 0
          )
          .slice(-12)
          .map((item) => ({
            role: item.role === 'assistant' ? ('model' as const) : ('user' as const),
            parts: [{ text: item.content.slice(0, 6000) }],
          }))
      : [];

    // Ensure history starts with a user turn if non-empty
    while (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
      sanitizedHistory.shift();
    }

    const chat = ai.chats.create({
      model: 'gemini-4-hydrogen',
      history: sanitizedHistory,
      config: {
        systemInstruction,
      },
    });

    const response = await chat.sendMessage({ message: userMessage });
    const reply = (response.text || '').trim();

    if (!reply) {
      res.status(502).json({
        error: 'L’assistant n’a renvoyé aucune réponse. Veuillez réessayer.',
      });
      return;
    }

    res.json({
      reply,
      mode: 'ai',
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erreur lors de la communication avec l’assistant IA Gemini.',
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

const EXPECTED_ADSENSE_CLIENT_ID = 'ca-pub-7807016100432800';
const EXPECTED_ADSENSE_PUB_ID = 'pub-7807016100432800';
const EXPECTED_ADS_TXT_LINE = `google.com, ${EXPECTED_ADSENSE_PUB_ID}, DIRECT, f08c47fec0942fa0`;
const CANONICAL_PUBLIC_ORIGIN = 'https://pdfexpress.ai.studio';

function getBaseUrl(req: express.Request): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader)
      ?.split(',')[0]
      ?.trim() ||
    req.protocol ||
    'https';
  const hostHeader = req.headers['x-forwarded-host'] || req.get('host');
  const host =
    (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)
      ?.split(',')[0]
      ?.trim() || '';

  // Prioritize custom public domain (e.g. pdfexpress.ai.studio) over default .run.app APP_URL
  if (host && !host.endsWith('.run.app') && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL' && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }

  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  return CANONICAL_PUBLIC_ORIGIN;
}

interface AdSenseEndpointProbe {
  path: string;
  url: string;
  ok: boolean;
  status: number;
  redirectedTo302: boolean;
  locationHeader: string | null;
  contentType: string;
  cacheControl: string;
  latencyMs: number;
  snippet: string;
  error?: string;
}

interface AdSenseTargetReport {
  baseUrl: string;
  checkedAt: string;
  overallStatus: 'pass' | 'warn' | 'fail';
  detectedPublisherIds: string[];
  detectedMetaClientId: string | null;
  detectedScriptClientId: string | null;
  detectedCanonicalUrl: string | null;
  adsTxtMatchesExpected: boolean;
  hasNo302Redirect: boolean;
  headMetaValid: boolean;
  headScriptValid: boolean;
  canonicalMatchesTarget: boolean;
  robotsAllowRoot: boolean;
  probes: {
    home: AdSenseEndpointProbe;
    adsTxt: AdSenseEndpointProbe;
    robotsTxt: AdSenseEndpointProbe;
    sitemapXml: AdSenseEndpointProbe;
  };
}

function isAllowedAdSenseVerifyHost(hostname: string, req: express.Request): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'pdfexpress.ai.studio' || lower === 'localhost' || lower === '127.0.0.1') {
    return true;
  }
  const reqHostHeader = req.headers['x-forwarded-host'] || req.get('host');
  const reqHost = (Array.isArray(reqHostHeader) ? reqHostHeader[0] : reqHostHeader || '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
  if (reqHost && lower === reqHost) {
    return true;
  }
  if (lower.endsWith('.run.app') && (lower.includes('pdfexpress') || lower.includes('ais-'))) {
    return true;
  }
  return false;
}

async function probeEndpoint(baseUrl: string, endpointPath: string): Promise<AdSenseEndpointProbe & { fullBody: string }> {
  const url = `${baseUrl}${endpointPath}`;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,text/plain,application/xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });

    const locationHeader = response.headers.get('location');
    const contentType = response.headers.get('content-type') || '';
    const cacheControl = response.headers.get('cache-control') || '';
    const rawText = await response.text();
    const trimmedBody = rawText.slice(0, 60000);

    return {
      path: endpointPath,
      url,
      ok: response.status === 200,
      status: response.status,
      redirectedTo302: response.status >= 300 && response.status < 400,
      locationHeader,
      contentType,
      cacheControl,
      latencyMs: Date.now() - startedAt,
      snippet: trimmedBody.slice(0, 320),
      fullBody: trimmedBody,
    };
  } catch (err) {
    return {
      path: endpointPath,
      url,
      ok: false,
      status: 0,
      redirectedTo302: false,
      locationHeader: null,
      contentType: '',
      cacheControl: '',
      latencyMs: Date.now() - startedAt,
      snippet: '',
      fullBody: '',
      error: err instanceof Error ? err.message : 'Erreur réseau lors du test HTTP.',
    };
  }
}

async function inspectAdSenseTarget(baseUrl: string): Promise<AdSenseTargetReport> {
  const [homeRaw, adsTxtRaw, robotsRaw, sitemapRaw] = await Promise.all([
    probeEndpoint(baseUrl, '/'),
    probeEndpoint(baseUrl, '/ads.txt'),
    probeEndpoint(baseUrl, '/robots.txt'),
    probeEndpoint(baseUrl, '/sitemap.xml'),
  ]);

  const homeHtml = homeRaw.fullBody;
  const adsTxtBody = adsTxtRaw.fullBody.trim();
  const robotsBody = robotsRaw.fullBody;

  const metaMatch = homeHtml.match(
    /<meta[^>]+name=["']google-adsense-account["'][^>]+content=["']([^"']+)["']/i
  );
  const scriptMatch = homeHtml.match(
    /<script[^>]+src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=([^"'&]+)[^>]*>/i
  );
  const canonicalMatch = homeHtml.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  );

  const pubMatches = new Set<string>();
  for (const m of `${homeHtml}\n${adsTxtBody}`.matchAll(/ca-pub-\d{10,20}|pub-\d{10,20}/g)) {
    pubMatches.add(m[0]);
  }

  const detectedMetaClientId = metaMatch?.[1] || null;
  const detectedScriptClientId = scriptMatch?.[1] || null;
  const detectedCanonicalUrl = canonicalMatch?.[1] || null;

  const adsTxtMatchesExpected =
    adsTxtRaw.status === 200 &&
    adsTxtRaw.contentType.toLowerCase().includes('text/plain') &&
    adsTxtBody.includes(EXPECTED_ADS_TXT_LINE);

  const hasNo302Redirect =
    !homeRaw.redirectedTo302 &&
    !adsTxtRaw.redirectedTo302 &&
    homeRaw.status === 200 &&
    adsTxtRaw.status === 200;

  const headMetaValid = detectedMetaClientId === EXPECTED_ADSENSE_CLIENT_ID;
  const headScriptValid = detectedScriptClientId === EXPECTED_ADSENSE_CLIENT_ID;

  let canonicalMatchesTarget = false;
  if (detectedCanonicalUrl) {
    try {
      const targetHost = new URL(baseUrl).hostname.toLowerCase();
      const canonicalHost = new URL(detectedCanonicalUrl).hostname.toLowerCase();
      canonicalMatchesTarget =
        canonicalHost === targetHost ||
        (targetHost === '127.0.0.1' && canonicalHost === 'pdfexpress.ai.studio');
    } catch {
      canonicalMatchesTarget = false;
    }
  }

  const robotsAllowRoot =
    robotsRaw.status === 200 &&
    /Allow:\s*\//i.test(robotsBody) &&
    !/Disallow:\s*\/\s*$/im.test(robotsBody);

  let overallStatus: 'pass' | 'warn' | 'fail' = 'pass';
  if (!hasNo302Redirect || !adsTxtMatchesExpected || !headMetaValid || !headScriptValid) {
    overallStatus = 'fail';
  } else if (!canonicalMatchesTarget || !robotsAllowRoot || !sitemapRaw.ok) {
    overallStatus = 'warn';
  }

  const stripBody = <T extends AdSenseEndpointProbe & { fullBody?: string }>({
    fullBody: _ignored,
    ...rest
  }: T): AdSenseEndpointProbe => rest;

  return {
    baseUrl,
    checkedAt: new Date().toISOString(),
    overallStatus,
    detectedPublisherIds: Array.from(pubMatches),
    detectedMetaClientId,
    detectedScriptClientId,
    detectedCanonicalUrl,
    adsTxtMatchesExpected,
    hasNo302Redirect,
    headMetaValid,
    headScriptValid,
    canonicalMatchesTarget,
    robotsAllowRoot,
    probes: {
      home: stripBody(homeRaw),
      adsTxt: stripBody(adsTxtRaw),
      robotsTxt: stripBody(robotsRaw),
      sitemapXml: stripBody(sitemapRaw),
    },
  };
}

app.post('/api/admin/adsense-verify', async (req, res) => {
  try {
    const rawTarget =
      typeof (req.body as { targetUrl?: unknown })?.targetUrl === 'string'
        ? (req.body as { targetUrl: string }).targetUrl.trim()
        : CANONICAL_PUBLIC_ORIGIN;

    const normalizedUrl = /^https?:\/\//i.test(rawTarget)
      ? rawTarget
      : `https://${rawTarget}`;

    let parsedTarget: URL;
    try {
      parsedTarget = new URL(normalizedUrl);
    } catch {
      res.status(400).json({ error: 'URL cible invalide.' });
      return;
    }

    if (
      (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') ||
      !isAllowedAdSenseVerifyHost(parsedTarget.hostname, req)
    ) {
      res.status(400).json({
        error:
          'Hôte non autorisé pour le diagnostic. Utilisez pdfexpress.ai.studio ou l’hôte courant.',
      });
      return;
    }

    const cleanTargetBase = `${parsedTarget.protocol}//${parsedTarget.host}`;
    const localBase = `http://127.0.0.1:${PORT}`;

    const [remoteReport, localReport] = await Promise.all([
      inspectAdSenseTarget(cleanTargetBase),
      inspectAdSenseTarget(localBase),
    ]);

    res.json({
      expectedClientId: EXPECTED_ADSENSE_CLIENT_ID,
      expectedPubId: EXPECTED_ADSENSE_PUB_ID,
      expectedAdsTxtLine: EXPECTED_ADS_TXT_LINE,
      remote: remoteReport,
      local: localReport,
    });
  } catch (err) {
    console.error('AdSense verify error:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erreur lors de la vérification Google AdSense.',
    });
  }
});

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
    { loc: `${baseUrl}/about`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${baseUrl}/contact`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${baseUrl}/faq`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${baseUrl}/confidentialite`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/conditions`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/cookies`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/securite`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${baseUrl}/accessibilite`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${baseUrl}/mentions-legales`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${baseUrl}/plan-du-site`, changefreq: 'weekly', priority: '0.6' },
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
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PDFExpress server running on http://localhost:${PORT}`);
  });
}

startServer();
