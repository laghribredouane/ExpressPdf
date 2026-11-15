import type { CategoryId, ToolDefinition, ToolId } from '../types/pdf';

export type StudioLang = 'fr' | 'en' | 'ar';

export function normalizeLang(lang?: string): StudioLang {
  if (lang === 'en' || lang === 'ar') return lang;
  return 'fr';
}

export const STUDIO_TOOL_IDS: ToolId[] = [
  'img_bg_remove',
  'img_compress',
  'ocr_extract',
];

export function isStudioToolId(id: ToolId | string | null | undefined): boolean {
  return id === 'img_bg_remove' || id === 'img_compress' || id === 'ocr_extract';
}

interface ToolI18nEntry {
  title: string;
  desc: string;
  catLabel: string;
  btnText: string;
  actionLabel: string;
}

const TOOL_I18N: Partial<Record<ToolId, Record<StudioLang, ToolI18nEntry>>> = {
  img_bg_remove: {
    fr: {
      title: 'Suppresseur d’arrière-plan IA',
      desc: 'Supprimez automatiquement le fond de vos photos en local avec l’IA et remplacez-le par une couleur, un dégradé ou de la transparence.',
      catLabel: 'Studio Image & OCR',
      btnText: 'Sélectionner une image (JPG, PNG, WebP)',
      actionLabel: 'Supprimer l’arrière-plan',
    },
    en: {
      title: 'AI Background Remover',
      desc: 'Remove photo backgrounds locally in your browser with AI and switch between transparent, solid colors, or clean gradients.',
      catLabel: 'Image & OCR Studio',
      btnText: 'Select Image (JPG, PNG, WebP)',
      actionLabel: 'Remove Background',
    },
    ar: {
      title: 'إزالة الخلفية بالذكاء الاصطناعي',
      desc: 'أزل خلفية الصور محلياً في متصفحك بالذكاء الاصطناعي واستبدلها بخلفية شفافة أو لون خالص أو تدرج أنيق.',
      catLabel: 'استوديو الصور و OCR',
      btnText: 'اختر صورة (JPG, PNG, WebP)',
      actionLabel: 'إزالة الخلفية',
    },
  },
  img_compress: {
    fr: {
      title: 'Compresseur & Convertisseur d’Images',
      desc: 'Réduisez le poids de vos images jusqu’à 85 % sans perte visible, comparez Avant/Après et convertissez en WebP, JPEG ou PNG.',
      catLabel: 'Studio Image & OCR',
      btnText: 'Sélectionner des images',
      actionLabel: 'Compresser l’image',
    },
    en: {
      title: 'Smart Image Compressor',
      desc: 'Shrink image sizes up to 85% with a live Before/After split slider, optional resize, and conversion to WebP, JPEG, or PNG.',
      catLabel: 'Image & OCR Studio',
      btnText: 'Select Images',
      actionLabel: 'Compress Image',
    },
    ar: {
      title: 'ضغط وتحويل الصور الذكي',
      desc: 'قلّص حجم الصور حتى 85% مع مقارنة تفاعلية قبل وبعد وتحويل الصيغ إلى WebP أو JPEG أو PNG.',
      catLabel: 'استوديو الصور و OCR',
      btnText: 'اختر صوراً',
      actionLabel: 'ضغط الصورة',
    },
  },
  ocr_extract: {
    fr: {
      title: 'Extracteur OCR Multilingue',
      desc: 'Extrayez le texte arabe, français ou anglais depuis vos photos et PDF scannés, puis exportez en .TXT ou PDF indexable.',
      catLabel: 'Studio Image & OCR',
      btnText: 'Sélectionner image ou PDF scanné',
      actionLabel: 'Extraire le texte (OCR)',
    },
    en: {
      title: 'Multilingual OCR Extractor',
      desc: 'Extract Arabic, French, and English text from photos or scanned PDFs locally, and export as .TXT or Searchable PDF.',
      catLabel: 'Image & OCR Studio',
      btnText: 'Select Image or Scanned PDF',
      actionLabel: 'Extract Text (OCR)',
    },
    ar: {
      title: 'استخراج النصوص (OCR) متعدد اللغات',
      desc: 'استخرج النصوص العربية والفرنسية والإنجليزية من الصور أو ملفات PDF الممسوحة ضوئياً وصدّرها كـ TXT أو PDF قابل للبحث.',
      catLabel: 'استوديو الصور و OCR',
      btnText: 'اختر صورة أو ملف PDF ممسوحاً',
      actionLabel: 'استخراج النص (OCR)',
    },
  },
};

export function getLocalizedToolMeta(
  tool: ToolDefinition,
  lang?: string
): ToolI18nEntry {
  const l = normalizeLang(lang);
  const entry = TOOL_I18N[tool.id]?.[l];
  if (entry) return entry;
  return {
    title: tool.title,
    desc: tool.desc,
    catLabel: tool.catLabel,
    btnText: tool.btnText,
    actionLabel: tool.actionLabel,
  };
}

export function getCategoryLabel(id: CategoryId, fallback: string, lang?: string): string {
  const l = normalizeLang(lang);
  if (id === 'studio_image') {
    if (l === 'en') return 'Image & OCR Studio';
    if (l === 'ar') return 'استوديو الصور و OCR';
    return 'Studio Image & OCR';
  }
  if (id === 'all') {
    if (l === 'en') return 'All';
    if (l === 'ar') return 'الكل';
  }
  return fallback;
}

export const STUDIO_COPY = {
  fr: {
    studioName: 'Studio Image & OCR',
    studioTagline: 'Suite locale de retouche, compression & reconnaissance de texte',
    privacyBadge: '100 % Privé : Traité localement sur votre appareil',
    backHome: 'Retour aux outils',
    tabBgRemove: 'Suppresseur Fond IA',
    tabCompress: 'Compresseur Images',
    tabOcr: 'OCR Multilingue',
    tabImgToPdf: 'Images → PDF',
    remainingTasks: (rem: number, lim: number) => `${rem}/${lim} tâches restantes aujourd’hui`,
    unlimitedPlan: 'Accès illimité actif',
    hero: {
      dropzoneTitle: 'Glissez-déposez vos images ou PDF ici',
      dropzoneSub: 'JPG, PNG, WebP ou PDF — Routage intelligent instantané sur votre appareil',
      chooseFiles: 'Choisir des fichiers',
      selectedReady: (count: number) =>
        count === 1 ? '1 image prête — Choisissez une action :' : `${count} images prêtes — Choisissez une action :`,
      actionRemoveBg: 'Supprimer l’arrière-plan',
      actionCompress: 'Compresser l’image',
      actionOcr: 'Extraire le texte (OCR)',
      actionToPdf: 'Convertir en PDF',
      clearSelection: 'Annuler',
      studioBannerTitle: 'Nouveau : Studio Image & OCR 100 % Local',
      studioBannerDesc:
        'Détourage IA sans serveur, compression WebP/JPEG avec comparateur Avant/Après et OCR Arabe / Français / Anglais.',
    },
    bg: {
      title: 'Suppresseur d’arrière-plan IA',
      subtitle: 'Détourage précis par réseau neuronal ONNX/WASM directement dans votre navigateur.',
      dropTitle: 'Déposez une image JPG, PNG ou WebP',
      dropHint: 'Glissez votre photo ici ou cliquez pour parcourir',
      loadingModel: 'Chargement du modèle IA local...',
      inferring: 'Suppression de l’arrière-plan en cours...',
      networkErrorTitle: 'Impossible de télécharger le modèle IA',
      networkErrorDesc:
        'Vérifiez votre connexion Internet lors du premier chargement du modèle WASM, puis réessayez.',
      retry: 'Réessayer',
      replaceImage: 'Changer d’image',
      bgLabel: 'Arrière-plan de remplacement',
      bgTransparent: 'Transparent',
      bgWhite: 'Blanc',
      bgBlack: 'Noir',
      bgCustom: 'Couleur',
      bgGradientCoral: 'Corail',
      bgGradientOcean: 'Océan',
      bgGradientEmerald: 'Émeraude',
      bgGradientSlate: 'Nuit',
      downloadPng: 'Télécharger PNG',
      sendToPdf: 'Envoyer vers Image → PDF',
      originalLabel: 'Original',
      resultLabel: 'Détouré',
      showOriginal: 'Voir l’original',
      showResult: 'Voir le résultat',
      batchNote: 'Le traitement multiple nécessite Premium. Mode fichier unique activé.',
      successToast: 'Arrière-plan supprimé localement !',
      downloadToast: 'Image PNG téléchargée !',
    },
    compress: {
      title: 'Compresseur & Convertisseur d’Images',
      subtitle: 'Optimisez le poids et convertissez vers WebP, JPEG ou PNG avec aperçu Avant/Après instantané.',
      dropTitle: 'Déposez une ou plusieurs images (JPG, PNG, WebP)',
      dropHint: 'Fichier unique gratuit · Traitement par lot ZIP réservé à Premium',
      batchBadge: 'Lot ZIP (Premium)',
      batchLockedMsg: 'Le traitement par lot multi-images est réservé aux membres Premium ou Essai 7j.',
      qualityLabel: 'Qualité',
      formatLabel: 'Format de sortie',
      resizeToggle: 'Redimensionner (largeur/hauteur max)',
      maxDimLabel: 'Dimension max (px)',
      applyBtn: 'Appliquer / Recompresser',
      compressing: 'Compression locale en cours...',
      originalSize: 'Original',
      compressedSize: 'Compressé',
      savedLabel: 'Économisé',
      beforeLabel: 'Avant',
      afterLabel: 'Après',
      sliderHint: 'Faites glisser la poignée pour comparer',
      downloadSingle: 'Télécharger l’image',
      downloadZip: 'Tout télécharger (.ZIP)',
      addMoreFiles: 'Ajouter d’autres images',
      clearFiles: 'Réinitialiser',
      singleSuccessToast: 'Image compressée avec succès !',
      batchSuccessToast: (n: number) => `${n} images compressées localement !`,
    },
    ocr: {
      title: 'Extracteur OCR Multilingue',
      subtitle: 'Reconnaissance optique de caractères Arabe, Français et Anglais sur images et PDF scannés.',
      dropTitle: 'Déposez une image ou un PDF scanné',
      dropHint: 'Formats acceptés : JPG, PNG, WebP ou PDF',
      langLabel: 'Langue du document',
      langs: {
        ara: 'Arabe (العربية)',
        fra: 'Français',
        eng: 'Anglais (English)',
        'ara+fra+eng': 'Multilingue (AR + FR + EN)',
      },
      startBtn: 'Lancer l’extraction OCR',
      rerunning: 'Extraction en cours...',
      preparingPdf: (p: number, total: number) => `Rendu de la page PDF ${p}/${total}...`,
      loadingLangData: 'Téléchargement des données de langue Tesseract...',
      recognizingPage: (p: number, total: number) =>
        total > 1 ? `Reconnaissance page ${p} sur ${total}...` : 'Reconnaissance du texte en cours...',
      networkErrorTitle: 'Erreur lors du chargement OCR',
      networkErrorDesc:
        'Impossible de récupérer les données de langue OCR depuis le CDN. Vérifiez votre connexion et réessayez.',
      retry: 'Réessayer l’OCR',
      outputLabel: 'Texte extrait (modifiable)',
      outputPlaceholder: 'Le texte reconnu apparaîtra ici...',
      copyText: 'Copier le texte',
      copiedToast: 'Texte copié dans le presse-papier !',
      downloadTxt: 'Télécharger .TXT',
      exportSearchablePdf: 'Exporter en PDF indexable',
      exportingPdf: 'Génération du PDF indexable...',
      searchablePdfToast: 'PDF indexable généré avec succès !',
      saveToGoogleDocs: 'Enregistrer dans Google Docs',
      changeFile: 'Nouveau document',
      pageCountInfo: (n: number) => (n === 1 ? '1 page analysée' : `${n} pages analysées`),
      noTextWarning: 'Aucun texte lisible détecté. Essayez une autre langue ou une image plus nette.',
    },
  },
  en: {
    studioName: 'Image & OCR Studio',
    studioTagline: '100% client-side image editing, compression & text recognition',
    privacyBadge: '100% Private: Processed locally on your device',
    backHome: 'Back to all tools',
    tabBgRemove: 'AI Background Remover',
    tabCompress: 'Image Compressor',
    tabOcr: 'Multilingual OCR',
    tabImgToPdf: 'Image → PDF',
    remainingTasks: (rem: number, lim: number) => `${rem}/${lim} tasks remaining today`,
    unlimitedPlan: 'Unlimited access active',
    hero: {
      dropzoneTitle: 'Drop your images or PDFs right here',
      dropzoneSub: 'JPG, PNG, WebP or PDF — Instant smart routing on your device',
      chooseFiles: 'Select Files',
      selectedReady: (count: number) =>
        count === 1 ? '1 image ready — Choose an action:' : `${count} images ready — Choose an action:`,
      actionRemoveBg: 'Remove Background',
      actionCompress: 'Compress Image',
      actionOcr: 'Extract Text (OCR)',
      actionToPdf: 'Convert to PDF',
      clearSelection: 'Cancel',
      studioBannerTitle: 'New: 100% Local Image & OCR Studio',
      studioBannerDesc:
        'Browser AI background removal, WebP/JPEG/PNG compression with Before/After slider, and Arabic / French / English OCR.',
    },
    bg: {
      title: 'AI Background Remover',
      subtitle: 'Accurate ONNX/WASM neural segmentation running entirely inside your browser.',
      dropTitle: 'Drop a JPG, PNG, or WebP image',
      dropHint: 'Drag your photo here or click to browse',
      loadingModel: 'Fetching local AI model...',
      inferring: 'Removing background locally...',
      networkErrorTitle: 'Could not load AI model',
      networkErrorDesc:
        'Please check your internet connection for the initial WASM model download, then try again.',
      retry: 'Retry',
      replaceImage: 'Change Image',
      bgLabel: 'Replacement Background',
      bgTransparent: 'Transparent',
      bgWhite: 'White',
      bgBlack: 'Black',
      bgCustom: 'Custom',
      bgGradientCoral: 'Coral',
      bgGradientOcean: 'Ocean',
      bgGradientEmerald: 'Emerald',
      bgGradientSlate: 'Midnight',
      downloadPng: 'Download PNG',
      sendToPdf: 'Send to Image-to-PDF',
      originalLabel: 'Original',
      resultLabel: 'Cutout',
      showOriginal: 'Show Original',
      showResult: 'Show Result',
      batchNote: 'Batch processing requires Premium. Switched to single-image mode.',
      successToast: 'Background removed locally!',
      downloadToast: 'PNG image downloaded!',
    },
    compress: {
      title: 'Smart Image Compressor & Converter',
      subtitle: 'Shrink file size and convert to WebP, JPEG, or PNG with a live Before/After split slider.',
      dropTitle: 'Drop one or more images (JPG, PNG, WebP)',
      dropHint: 'Single image free · Multi-image ZIP batch requires Premium',
      batchBadge: 'ZIP Batch (Premium)',
      batchLockedMsg: 'Batch multi-image compression is reserved for Premium or 7-day Trial users.',
      qualityLabel: 'Quality',
      formatLabel: 'Output Format',
      resizeToggle: 'Resize (Max Width / Height)',
      maxDimLabel: 'Max dimension (px)',
      applyBtn: 'Apply / Compress',
      compressing: 'Compressing locally...',
      originalSize: 'Original',
      compressedSize: 'Compressed',
      savedLabel: 'Saved',
      beforeLabel: 'Before',
      afterLabel: 'After',
      sliderHint: 'Drag slider handle to compare',
      downloadSingle: 'Download Image',
      downloadZip: 'Download All (.ZIP)',
      addMoreFiles: 'Add More Images',
      clearFiles: 'Reset',
      singleSuccessToast: 'Image compressed successfully!',
      batchSuccessToast: (n: number) => `${n} images compressed locally!`,
    },
    ocr: {
      title: 'Smart Multilingual OCR Extractor',
      subtitle: 'Extract Arabic, French, and English text from images or scanned PDFs in a Web Worker.',
      dropTitle: 'Drop an image or scanned PDF',
      dropHint: 'Supported formats: JPG, PNG, WebP, or PDF',
      langLabel: 'Document Language',
      langs: {
        ara: 'Arabic (العربية)',
        fra: 'French (Français)',
        eng: 'English',
        'ara+fra+eng': 'Multi-language (AR + FR + EN)',
      },
      startBtn: 'Start OCR Extraction',
      rerunning: 'Extracting text...',
      preparingPdf: (p: number, total: number) => `Rendering PDF page ${p}/${total}...`,
      loadingLangData: 'Loading Tesseract language data...',
      recognizingPage: (p: number, total: number) =>
        total > 1 ? `Recognizing page ${p} of ${total}...` : 'Recognizing text...',
      networkErrorTitle: 'OCR Model Load Error',
      networkErrorDesc:
        'Could not fetch OCR language data from CDN. Check your network connection and retry.',
      retry: 'Retry OCR',
      outputLabel: 'Extracted Text (Editable)',
      outputPlaceholder: 'Recognized text will appear here...',
      copyText: 'Copy Text',
      copiedToast: 'Text copied to clipboard!',
      downloadTxt: 'Download .TXT',
      exportSearchablePdf: 'Export as Searchable PDF',
      exportingPdf: 'Building searchable PDF...',
      searchablePdfToast: 'Searchable PDF exported!',
      saveToGoogleDocs: 'Save to Google Docs',
      changeFile: 'New Document',
      pageCountInfo: (n: number) => (n === 1 ? '1 page processed' : `${n} pages processed`),
      noTextWarning: 'No readable text detected. Try another language or a clearer scan.',
    },
  },
  ar: {
    studioName: 'استوديو الصور و OCR',
    studioTagline: 'تعديل الصور وضغطها واستخراج النصوص محلياً بالكامل',
    privacyBadge: 'خصوصية 100%: تتم المعالجة محلياً على جهازك',
    backHome: 'العودة إلى الأدوات',
    tabBgRemove: 'إزالة الخلفية بالذكاء',
    tabCompress: 'ضغط الصور الذكي',
    tabOcr: 'استخراج النصوص OCR',
    tabImgToPdf: 'صور ← PDF',
    remainingTasks: (rem: number, lim: number) => `متبقي ${rem} من ${lim} مهام اليوم`,
    unlimitedPlan: 'وصول غير محدود مفعّل',
    hero: {
      dropzoneTitle: 'اسحب وأفلت الصور أو ملفات PDF هنا',
      dropzoneSub: 'JPG, PNG, WebP أو PDF — توجيه ذكي فوري على جهازك',
      chooseFiles: 'اختيار الملفات',
      selectedReady: (count: number) =>
        count === 1 ? 'صورة واحدة جاهزة — اختر الإجراء:' : `${count} صور جاهزة — اختر الإجراء:`,
      actionRemoveBg: 'إزالة الخلفية',
      actionCompress: 'ضغط الصورة',
      actionOcr: 'استخراج النص (OCR)',
      actionToPdf: 'تحويل إلى PDF',
      clearSelection: 'إلغاء',
      studioBannerTitle: 'جديد: استوديو الصور و OCR المحلي بالكامل',
      studioBannerDesc:
        'إزالة الخلفية بالذكاء الاصطناعي في المتصفح، وضغط WebP/JPEG بمؤشر مقارنة، واستخراج النصوص العربية والفرنسية والإنجليزية.',
    },
    bg: {
      title: 'إزالة الخلفية بالذكاء الاصطناعي',
      subtitle: 'عزل دقيق للعناصر بتقنية ONNX/WASM محلياً داخل المتصفح دون رفع أي صورة.',
      dropTitle: 'أفلت صورة بصيغة JPG أو PNG أو WebP',
      dropHint: 'اسحب الصورة إلى هنا أو انقر للاختيار',
      loadingModel: 'جارٍ تحميل نموذج الذكاء الاصطناعي المحلي...',
      inferring: 'جارٍ إزالة الخلفية...',
      networkErrorTitle: 'تعذّر تحميل نموذج الذكاء الاصطناعي',
      networkErrorDesc:
        'يرجى التحقق من اتصالك بالإنترنت أثناء التنزيل الأول للنموذج، ثم المحاولة مجدداً.',
      retry: 'إعادة المحاولة',
      replaceImage: 'تغيير الصورة',
      bgLabel: 'استبدال الخلفية',
      bgTransparent: 'شفاف',
      bgWhite: 'أبيض',
      bgBlack: 'أسود',
      bgCustom: 'لون مخصص',
      bgGradientCoral: 'مرجاني',
      bgGradientOcean: 'محيطي',
      bgGradientEmerald: 'زمردي',
      bgGradientSlate: 'ليلي',
      downloadPng: 'تنزيل PNG',
      sendToPdf: 'إرسال إلى محول الصور إلى PDF',
      originalLabel: 'الأصلية',
      resultLabel: 'المعزولة',
      showOriginal: 'عرض الأصلية',
      showResult: 'عرض النتيجة',
      batchNote: 'معالجة عدة صور معاً تتطلب باقة Premium. تم اعتماد صورة واحدة.',
      successToast: 'تمت إزالة الخلفية محلياً!',
      downloadToast: 'تم تنزيل صورة PNG!',
    },
    compress: {
      title: 'ضغط وتحويل الصور الذكي',
      subtitle: 'قلّص حجم الصورة وحوّلها إلى WebP أو JPEG أو PNG مع شريط مقارنة تفاعلي قبل وبعد.',
      dropTitle: 'أفلت صورة أو أكثر (JPG, PNG, WebP)',
      dropHint: 'صورة واحدة مجانية · المعالجة الجماعية ZIP متاحة لباقة Premium',
      batchBadge: 'حزمة ZIP (Premium)',
      batchLockedMsg: 'الضغط الجماعي لعدة صور مخصّص لمشتركي Premium أو التجربة المجانية 7 أيام.',
      qualityLabel: 'الجودة',
      formatLabel: 'صيغة الإخراج',
      resizeToggle: 'تغيير الأبعاد (الحد الأقصى للعرض/الارتفاع)',
      maxDimLabel: 'الحد الأقصى (بكسل)',
      applyBtn: 'تطبيق / إعادة الضغط',
      compressing: 'جارٍ الضغط محلياً...',
      originalSize: 'الأصلي',
      compressedSize: 'بعد الضغط',
      savedLabel: 'نسبة التوفير',
      beforeLabel: 'قبل',
      afterLabel: 'بعد',
      sliderHint: 'اسحب المقبض للمقارنة',
      downloadSingle: 'تنزيل الصورة',
      downloadZip: 'تنزيل الكل (.ZIP)',
      addMoreFiles: 'إضافة المزيد من الصور',
      clearFiles: 'إعادة تعيين',
      singleSuccessToast: 'تم ضغط الصورة بنجاح!',
      batchSuccessToast: (n: number) => `تم ضغط ${n} صور محلياً!`,
    },
    ocr: {
      title: 'استخراج النصوص (OCR) متعدد اللغات',
      subtitle: 'تعرّف بصري على النصوص العربية والفرنسية والإنجليزية من الصور وملفات PDF الممسوحة.',
      dropTitle: 'أفلت صورة أو ملف PDF ممسوحاً ضوئياً',
      dropHint: 'الصيغ المدعومة: JPG, PNG, WebP أو PDF',
      langLabel: 'لغة المستند',
      langs: {
        ara: 'العربية (Arabic)',
        fra: 'الفرنسية (Français)',
        eng: 'الإنجليزية (English)',
        'ara+fra+eng': 'متعدد اللغات (AR + FR + EN)',
      },
      startBtn: 'بدء استخراج النص',
      rerunning: 'جارٍ الاستخراج...',
      preparingPdf: (p: number, total: number) => `تحضير صفحة PDF رقم ${p} من ${total}...`,
      loadingLangData: 'جارٍ تحميل حزمة اللغة...',
      recognizingPage: (p: number, total: number) =>
        total > 1 ? `قراءة الصفحة ${p} من ${total}...` : 'جارٍ التعرّف على النص...',
      networkErrorTitle: 'تعذّر تحميل بيانات اللغة',
      networkErrorDesc:
        'تعذّر جلب حزمة لغة OCR من الخادم. يرجى التحقق من الاتصال والمحاولة مجدداً.',
      retry: 'إعادة المحاولة',
      outputLabel: 'النص المستخرج (قابل للتعديل)',
      outputPlaceholder: 'سيظهر النص المستخرج هنا...',
      copyText: 'نسخ النص',
      copiedToast: 'تم نسخ النص إلى الحافظة!',
      downloadTxt: 'تنزيل .TXT',
      exportSearchablePdf: 'تصدير كـ PDF قابل للبحث',
      exportingPdf: 'جارٍ إنشاء ملف PDF القابل للبحث...',
      searchablePdfToast: 'تم تصدير ملف PDF القابل للبحث!',
      saveToGoogleDocs: 'حفظ في مستندات Google Docs',
      changeFile: 'مستند جديد',
      pageCountInfo: (n: number) => (n === 1 ? 'تمت معالجة صفحة واحدة' : `تمت معالجة ${n} صفحات`),
      noTextWarning: 'لم يتم اكتشاف نص واضح. جرّب لغة أخرى أو صورة أوضح.',
    },
  },
} as const;
