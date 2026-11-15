import type { CategoryId, SiteInfoPage, ToolId } from '../types/pdf';

export type FooterAction =
  | { type: 'home' }
  | { type: 'tool'; toolId: ToolId }
  | { type: 'category'; categoryId: CategoryId }
  | { type: 'info'; pageId: string }
  | { type: 'scroll'; elementId: string }
  | { type: 'premium' }
  | { type: 'pricing' };

export interface FooterLinkItem {
  label: string;
  action: FooterAction;
}

export interface FooterColumn {
  heading: string;
  links: FooterLinkItem[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'PRODUIT',
    links: [
      { label: 'Accueil', action: { type: 'home' } },
      { label: 'Catalogue des outils (35)', action: { type: 'scroll', elementId: 'tools-catalog' } },
      { label: 'Fonctionnalités', action: { type: 'info', pageId: 'features' } },
      { label: 'Tarification (MAD / USD / EUR)', action: { type: 'pricing' } },
      { label: 'Offre Premium', action: { type: 'premium' } },
      { label: 'FAQ', action: { type: 'info', pageId: 'faq' } },
    ],
  },
  {
    heading: 'SOLUTIONS',
    links: [
      { label: 'Travaillez à votre façon', action: { type: 'info', pageId: 'solutions_workflow' } },
      { label: 'Entreprise', action: { type: 'info', pageId: 'solutions_business' } },
      { label: 'Éducation', action: { type: 'info', pageId: 'solutions_education' } },
      { label: 'Créer un flux de travail', action: { type: 'tool', toolId: 'workflow' } },
      { label: 'Intelligence PDF (IA)', action: { type: 'category', categoryId: 'intelligence' } },
      { label: 'Convertir des PDF', action: { type: 'category', categoryId: 'convertir' } },
    ],
  },
  {
    heading: 'ENTREPRISE',
    links: [
      { label: 'À propos de nous', action: { type: 'info', pageId: 'about' } },
      { label: 'Contactez-nous', action: { type: 'info', pageId: 'contact' } },
      { label: 'Blog & Guides', action: { type: 'info', pageId: 'blog' } },
      { label: 'Presse', action: { type: 'info', pageId: 'press' } },
      { label: 'Nouveautés', action: { type: 'info', pageId: 'changelog' } },
      { label: 'Plan du site', action: { type: 'info', pageId: 'sitemap' } },
    ],
  },
  {
    heading: 'RESSOURCES',
    links: [
      { label: 'PDFExpress Bureau', action: { type: 'info', pageId: 'desktop' } },
      { label: 'PDFExpress Mobile', action: { type: 'info', pageId: 'mobile' } },
      { label: 'Signature électronique', action: { type: 'tool', toolId: 'sign' } },
      { label: 'Formulaires PDF', action: { type: 'tool', toolId: 'pdfforms' } },
      { label: 'API Développeurs', action: { type: 'info', pageId: 'api' } },
      { label: 'Édition d’images', action: { type: 'scroll', elementId: 'image-editing' } },
    ],
  },
  {
    heading: 'JURIDIQUE',
    links: [
      { label: 'Confiance & Conformité', action: { type: 'info', pageId: 'legal_compliance' } },
      { label: 'Sécurité des données', action: { type: 'info', pageId: 'security' } },
      { label: 'Politique de confidentialité', action: { type: 'info', pageId: 'privacy' } },
      { label: 'Conditions générales', action: { type: 'info', pageId: 'terms' } },
      { label: 'Cookies', action: { type: 'info', pageId: 'cookies' } },
      { label: 'Accessibilité', action: { type: 'info', pageId: 'accessibility' } },
    ],
  },
];

export const FOOTER_QUICK_CATEGORIES: { label: string; categoryId: CategoryId }[] = [
  { label: 'Tous les outils', categoryId: 'all' },
  { label: 'Studio Image & OCR', categoryId: 'studio_image' },
  { label: 'Flux de travail', categoryId: 'workflow' },
  { label: 'Organiser PDF', categoryId: 'organiser' },
  { label: 'Optimiser le PDF', categoryId: 'optimiser' },
  { label: 'Convertir PDF', categoryId: 'convertir' },
  { label: 'Modifier PDF', categoryId: 'modifier' },
  { label: 'Sécurité PDF', categoryId: 'securite' },
  { label: 'Intelligence PDF', categoryId: 'intelligence' },
];

export const FOOTER_POPULAR_TOOLS: { label: string; toolId: ToolId }[] = [
  { label: 'Fusionner PDF', toolId: 'merge' },
  { label: 'Diviser PDF', toolId: 'split' },
  { label: 'Compresser PDF', toolId: 'compress' },
  { label: 'Signer PDF', toolId: 'sign' },
  { label: 'OCR PDF', toolId: 'ocr' },
  { label: 'OCR Avancé (IA)', toolId: 'aiocr' },
  { label: 'Formulaires PDF', toolId: 'pdfforms' },
  { label: 'Résumé par IA', toolId: 'aisummary' },
  { label: 'Traduire le PDF', toolId: 'translatepdf' },
  { label: 'PDF en Markdown', toolId: 'pdf2md' },
  { label: 'Posts Réseaux Sociaux', toolId: 'socialpost' },
];

export const STORE_PLATFORMS = [
  { id: 'google-play', label: 'Google Play', sub: 'Disponible sur', pageId: 'mobile' },
  { id: 'app-store', label: 'App Store', sub: 'Télécharger dans', pageId: 'mobile' },
  { id: 'mac-store', label: 'Mac App Store', sub: 'Télécharger dans', pageId: 'desktop' },
  { id: 'ms-store', label: 'Microsoft Store', sub: 'Obtenir sur', pageId: 'desktop' },
] as const;

export const SITE_INFO_PAGES: Record<string, SiteInfoPage> = {
  features: {
    id: 'features',
    section: 'Produit',
    title: 'Toutes les fonctionnalités PDFExpress',
    subtitle:
      'Une boîte à outils complète de 34 utilitaires exécutés directement dans votre navigateur sans téléversement de vos documents confidentiels.',
    highlights: [
      'Manipulation binaire instantanée (fusion, division, rotation, recadrage, numérotation).',
      'Signature manuscrite ou tapée avec mémorisation locale et aperçu en temps réel.',
      'Formulaires interactifs, censure permanente, OCR et comparaison côte à côte.',
      'Flux de travail automatisés enchaînant plusieurs traitements en une seule passe.',
    ],
    ctaLabel: 'Créer un flux de travail',
    ctaToolId: 'workflow',
  },
  pricing: {
    id: 'pricing',
    section: 'Produit',
    title: 'Formules & Tarification transparente',
    subtitle:
      'Tous les outils essentiels de PDFExpress sont accessibles gratuitement directement dans votre navigateur.',
    highlights: [
      'Gratuit : accès illimité aux 34 outils locaux sans création de compte.',
      'Premium : traitement par lots étendu, flux de travail enregistrés et fonctionnalités IA dédiées.',
      'Entreprise : déploiement dédié, intégration API et support prioritaire.',
    ],
    ctaLabel: 'Essayer l’outil Fusionner PDF',
    ctaToolId: 'merge',
  },
  faq: {
    id: 'faq',
    section: 'Produit',
    title: 'Questions fréquentes (FAQ)',
    subtitle: 'Tout savoir sur le fonctionnement local et la confidentialité de PDFExpress.',
    highlights: [
      'Mes fichiers sont-ils envoyés sur Internet ? Non : les opérations PDF s’exécutent localement en mémoire vive.',
      'Puis-je signer un contrat et conserver ma signature ? Oui, l’outil Signer PDF mémorise votre dernière signature dans localStorage.',
      'Quels formats sont pris en charge ? PDF, JPG, PNG, WebP, DOCX, PPTX, XLSX, CSV, HTML et Markdown.',
    ],
    ctaLabel: 'Ouvrir Signer PDF',
    ctaToolId: 'sign',
  },
  desktop: {
    id: 'desktop',
    section: 'Ressources',
    title: 'Travaillez hors ligne avec PDFExpress Bureau',
    subtitle:
      'Éditez et gérez vos documents PDF par lots localement, même sans connexion Internet et sans limite de taille.',
    highlights: [
      'Compatible Windows et macOS pour le traitement haute performance.',
      'Moteur hors ligne natif : vos documents juridiques et financiers restent sur votre poste.',
      'Raccourcis clavier et flux de travail automatisés accessibles en un clic.',
    ],
    ctaLabel: 'Lancer Compresser PDF',
    ctaToolId: 'compress',
  },
  mobile: {
    id: 'mobile',
    section: 'Ressources',
    title: 'Travaillez sur le pouce avec l’appli Mobile',
    subtitle:
      'Numérisez vos reçus, signez vos contrats et partagez vos PDF depuis votre smartphone Android ou iOS.',
    highlights: [
      'Capture photo instantanée avec filtre document noir et blanc haute netteté.',
      'Signature tactile directe à l’écran sur iOS et Android.',
      'Interface responsive adaptée aux écrans tactiles dès 44 px par cible.',
    ],
    ctaLabel: 'Ouvrir Numériser au format PDF',
    ctaToolId: 'scan2pdf',
  },
  api: {
    id: 'api',
    section: 'Ressources',
    title: 'API Développeurs & Automatisation',
    subtitle:
      'Intégrez la génération, la conversion, le filigrane et le résumé documentaire dans vos applications.',
    highlights: [
      'Points de terminaison REST simples pour automatiser vos chaînes documentaires.',
      'Modèles JSON structurés et traitement fiable des documents volumineux.',
      'Documentation claire pour Node.js et TypeScript.',
    ],
    ctaLabel: 'Tester Créer un flux de travail',
    ctaToolId: 'workflow',
  },
  enterprise: {
    id: 'enterprise',
    section: 'Solutions',
    title: 'Conçu pour les entreprises',
    subtitle:
      'Automatisez la gestion des documents, standardisez vos archivages PDF/A et sécurisez les échanges d’équipe.',
    highlights: [
      'Caviardage permanent pour la mise en conformité RGPD avant partage externe.',
      'Archivage normalisé ISO 19005-1 (PDF/A-1b) et comparaison de contrats.',
      'Flux de travail multi-étapes réutilisables par tous vos collaborateurs.',
    ],
    ctaLabel: 'Ouvrir Comparer PDF',
    ctaToolId: 'compare',
  },
  education: {
    id: 'education',
    section: 'Solutions',
    title: 'Solutions pour l’Éducation',
    subtitle:
      'Des outils rapides et accessibles pour les étudiants, enseignants et établissements scolaires.',
    highlights: [
      'Fusion de polycopiés, extraction de chapitres et compression pour envoi par e-mail.',
      'Conversion instantanée de présentations PowerPoint et notes Markdown.',
      'Création de formulaires PDF interactifs pour devoirs et questionnaires.',
    ],
    ctaLabel: 'Ouvrir Formulaires PDF',
    ctaToolId: 'pdfforms',
  },
  security: {
    id: 'security',
    section: 'Juridique',
    title: 'Sécurité des données',
    subtitle:
      'Architecture conçue autour du principe de confidentialité par défaut.',
    highlights: [
      'Les fichiers PDF manipulés localement ne quittent pas la mémoire de votre navigateur.',
      'Les URL temporaires générées pour le téléchargement sont automatiquement révoquées.',
      'Censure opaque irréversible des zones sensibles et protection par mot de passe.',
    ],
    ctaLabel: 'Ouvrir Censurer PDF',
    ctaToolId: 'redact',
  },
  privacy: {
    id: 'privacy',
    section: 'Juridique',
    title: 'Politique de confidentialité',
    subtitle:
      'Nous respectons strictement la vie privée de vos documents (traités localement dans votre navigateur) et vous informons de manière transparente sur les annonces Google AdSense.',
    highlights: [
      'Aucun stockage serveur permanent de vos fichiers PDF importés.',
      'Transparence sur l’utilisation de cookies Google AdSense (ca-pub-7807016100432800) avec possibilité de refuser la personnalisation.',
      'Droits RGPD d’accès, de rectification et de suppression via laghribredouane@gmail.com.',
    ],
  },
  terms: {
    id: 'terms',
    section: 'Juridique',
    title: 'Conditions générales d’utilisation',
    subtitle:
      'Règles d’utilisation claires et transparentes de la suite PDFExpress.',
    highlights: [
      'Service utilisable gratuitement pour un usage personnel et professionnel.',
      'Vous conservez l’intégralité des droits sur tous les documents traités.',
      'Vérifiez toujours les PDF générés avant diffusion légale ou archivage critique.',
    ],
  },
  cookies: {
    id: 'cookies',
    section: 'Juridique',
    title: 'Gestion des cookies & stockage local',
    subtitle:
      'Contrôlez les préférences locales essentielles et les cookies publicitaires Google AdSense.',
    highlights: [
      'Stockage local essentiel utilisé pour mémoriser votre thème, votre consentement et votre dernière signature.',
      'Cookies Google AdSense utilisés pour diffuser et mesurer des annonces (personnalisées ou non personnalisées selon votre choix).',
    ],
  },
  accessibility: {
    id: 'accessibility',
    section: 'Juridique',
    title: 'Accessibilité numérique',
    subtitle:
      'Une interface pensée pour la lisibilité, la navigation clavier et les contrastes élevés.',
    highlights: [
      'Navigation complète au clavier avec états de focus visibles sur tous les boutons et liens.',
      'Support des modes clair et sombre avec contraste conforme aux recommandations WCAG.',
      'Étiquettes ARIA explicites sur les fenêtres modales, tiroirs et contrôles interactifs.',
    ],
  },
  about: {
    id: 'about',
    section: 'Entreprise',
    title: 'À propos de PDFExpress',
    subtitle:
      'Rendre la manipulation de documents PDF rapide, fiable et accessible à tous sans installation complexe.',
    highlights: [
      '34 outils spécialisés couvrant l’organisation, l’optimisation, la conversion, la sécurité et l’intelligence documentaire.',
      'Interface soignée pensée pour le travail quotidien sur ordinateur comme sur mobile.',
    ],
  },
  contact: {
    id: 'contact',
    section: 'Entreprise',
    title: 'Contactez-nous',
    subtitle:
      'Une question sur un outil, une suggestion d’amélioration ou un besoin entreprise ?',
    highlights: [
      'Support technique et retours produits : utilisez nos outils directement ou signalez un format particulier.',
      'Demandes de déploiement entreprise et éducation traitées en priorité.',
    ],
  },
  blog: {
    id: 'blog',
    section: 'Entreprise',
    title: 'Blog & Guides pratiques PDF',
    subtitle:
      'Astuces pour réduire le poids de vos dossiers, signer des contrats en ligne et automatiser vos tâches.',
    highlights: [
      'Guide : Comment compresser un dossier administratif sans perdre en lisibilité.',
      'Tutoriel : Convertir un rapport PDF en Markdown propre pour vos bases de connaissances.',
      'Bonnes pratiques : Utiliser le format PDF/A-1b pour la conservation légale.',
    ],
    ctaLabel: 'Essayer PDF en Markdown',
    ctaToolId: 'pdf2md',
  },
  press: {
    id: 'press',
    section: 'Entreprise',
    title: 'Espace Presse & Médias',
    subtitle:
      'Ressources officielles, présentation du produit et informations clés sur PDFExpress.',
    highlights: [
      'Suite tout-en-un de 34 outils PDF accessibles directement depuis le navigateur.',
      'Engagement fort pour la confidentialité locale et la conformité aux standards PDF.',
    ],
  },
  changelog: {
    id: 'changelog',
    section: 'Entreprise',
    title: 'Nouveautés & Mises à jour',
    subtitle:
      'Découvrez les dernières évolutions apportées à la suite PDFExpress.',
    highlights: [
      'Ajout des outils Formulaires PDF, PDF en Markdown, Résumé par IA, Traduction PDF et Flux de travail.',
      'Signature PDF enrichie : tracé fluide, épaisseur réglable et mémorisation automatique.',
      'Navigation complète avec accès rapide aux 34 outils et pages d’information détaillées.',
    ],
    ctaLabel: 'Découvrir Résumé par IA',
    ctaToolId: 'aisummary',
  },
  sitemap: {
    id: 'sitemap',
    section: 'Entreprise',
    title: 'Plan complet de l’application',
    subtitle:
      'Accès structuré aux 8 catégories, aux 34 outils PDF et à toutes les sections d’information de PDFExpress.',
    highlights: [
      '8 catégories : Flux de travail, Organiser, Optimiser, Convertir, Modifier, Sécurité, Intelligence PDF.',
      'Sections d’accueil : Catalogue complet, Travaillez à votre façon, Offre Premium, Édition d’images, Confiance & Sécurité.',
      'Informations & Légal : Fonctionnalités, Tarification, FAQ, Bureau, Mobile, API, Entreprise, Éducation, Sécurité, Confidentialité, CGU, Cookies, Accessibilité.',
    ],
    ctaLabel: 'Explorer Créer un flux de travail',
    ctaToolId: 'workflow',
  },
  solutions_workflow: {
    id: 'solutions_workflow',
    section: 'Solutions',
    title: 'Travaillez à votre façon (Cloud & Bureau)',
    subtitle: 'Adaptez PDFExpress à vos méthodes de travail, que ce soit instantanément dans le navigateur ou hors ligne.',
    highlights: [
      'Traitement 100% local en mémoire vive pour une confidentialité absolue.',
      'Possibilité de travailler hors ligne sans connexion Internet requise.',
      'Raccourcis et intégration transparente avec Google Workspace (Calendar, Gmail).',
    ],
    ctaLabel: 'Essayer Compresser PDF',
    ctaToolId: 'compress',
  },
  solutions_business: {
    id: 'solutions_business',
    section: 'Solutions',
    title: 'Solutions Entreprise & Équipes',
    subtitle: 'Standardisez les flux documentaires de votre organisation avec des outils conformes et sécurisés.',
    highlights: [
      'Caviardage irrévisible et protection des données sensibles (RGPD).',
      'Archivage à long terme au format ISO PDF/A-1b.',
      'Flux de travail multi-étapes automatisés.',
    ],
    ctaLabel: 'Ouvrir Censurer PDF',
    ctaToolId: 'redact',
  },
  solutions_education: {
    id: 'solutions_education',
    section: 'Solutions',
    title: 'Solutions Éducation & Étudiants',
    subtitle: 'Simplifiez la gestion de vos cours, mémoires, thèses et devoirs.',
    highlights: [
      'Fusion de chapitres et compression pour respect des limites d’envoi.',
      'Conversion de présentations PowerPoint et notes Markdown.',
      'Création rapide de formulaires interactifs.',
    ],
    ctaLabel: 'Ouvrir Formulaires PDF',
    ctaToolId: 'pdfforms',
  },
  legal_compliance: {
    id: 'legal_compliance',
    section: 'Juridique',
    title: 'Confiance & Conformité RGPD / ISO',
    subtitle: 'PDFExpress respecte les standards les plus stricts en matière de traitement documentaire.',
    highlights: [
      'Conformité RGPD : aucun stockage serveur persistant de vos documents personnels.',
      'Support du format ISO 19005 (PDF/A) pour les archives officielles.',
      'Transparence totale du code exécuté localement dans votre navigateur.',
    ],
    ctaLabel: 'Ouvrir PDF en PDF/A',
    ctaToolId: 'pdf2pdfa',
  },
};
