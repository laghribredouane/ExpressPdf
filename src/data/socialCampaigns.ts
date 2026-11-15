import type { SocialPlatformId, SocialThemeId } from '../types/pdf';

export interface SocialCampaignPreset {
  id: string;
  number: string;
  campaignTitle: string;
  networkLabel: string;
  objective: string;
  platformId: SocialPlatformId;
  themeId: SocialThemeId;
  tone: string;
  topic: string;
  adCopy: string;
  hashtags: string;
  slides: Array<{
    badge: string;
    title: string;
    body: string;
    cta: string;
  }>;
}

export const PDFEXPRESS_FIVE_POSTS: SocialCampaignPreset[] = [
  {
    id: 'post-1-linkedin-zero-upload',
    number: 'Post 01',
    campaignTitle: '34 outils PDF gratuits sans transfert serveur',
    networkLabel: 'LinkedIn',
    objective: 'Notoriété B2B & Acquisition',
    platformId: 'linkedin_carousel',
    themeId: 'brand_red',
    tone: 'Professionnel',
    topic:
      'Pourquoi vos contrats confidentiels ne devraient jamais être téléversés sur des sites inconnus',
    adCopy: [
      'Arrêtez d’envoyer vos contrats, devis et bilans financiers sur des serveurs inconnus juste pour fusionner deux PDF.',
      '',
      'Sur PDFExpress, les 34 outils s’exécutent directement dans votre navigateur :',
      '• Fusionner, diviser, réorganiser et compresser en moins d’une seconde',
      '• Signer électroniquement, censurer définitivement et protéger par mot de passe',
      '• 0 installation, 0 filigrane forcé sur vos fichiers locaux, 100 % confidentiel',
      '',
      'Testez gratuitement dès maintenant : https://pdfexpress.ai.studio',
    ].join('\n'),
    hashtags:
      '#PDFExpress #Productivité #Cybersécurité #OutilsPro #RGPD #Bureautique',
    slides: [
      {
        badge: 'CONFIDENTIALITÉ',
        title: 'Vos PDF ne quittent jamais votre navigateur',
        body: 'Fusion, compression, signature et caviardage exécutés localement en mémoire vive, sans téléversement.',
        cta: 'Découvrir les 34 outils →',
      },
      {
        badge: 'GAIN DE TEMPS',
        title: '34 outils réunis au même endroit',
        body: 'Organisez, convertissez (Word, Excel, JPG, Markdown) et modifiez vos dossiers sans installer de logiciel.',
        cta: 'Traitement instantané',
      },
      {
        badge: 'SÉCURITÉ PRO',
        title: 'Censure définitive & archivage PDF/A',
        body: 'Masquez vos données sensibles de façon irréversible avant tout partage client ou administratif.',
        cta: 'Conforme RGPD',
      },
      {
        badge: 'ESSAYER GRATUITEMENT',
        title: 'Disponible maintenant sur pdfexpress.ai.studio',
        body: 'Ouvrez votre navigateur sur ordinateur ou mobile et traitez votre premier PDF en 10 secondes.',
        cta: 'pdfexpress.ai.studio',
      },
    ],
  },
  {
    id: 'post-2-instagram-compress-sign',
    number: 'Post 02',
    campaignTitle: 'Compresser (-70 %) & Signer un PDF en 30 secondes',
    networkLabel: 'Instagram',
    objective: 'Conversion Freelances & RH',
    platformId: 'instagram_square',
    themeId: 'midnight',
    tone: 'Dynamique',
    topic:
      'Compresser un dossier trop lourd et signer un contrat PDF en 30 secondes',
    adCopy: [
      '« Erreur : pièce jointe supérieure à 25 Mo. » Et un contrat à renvoyer signé avant 18h ?',
      '',
      'Réglez les deux problèmes en 30 secondes chrono sur PDFExpress :',
      '1. Compressez votre PDF jusqu’à -70 % tout en gardant un texte parfaitement net',
      '2. Dessinez ou tapez votre signature et enregistrez-la pour vos prochains envois',
      '3. Téléchargez le document prêt à expédier, sans compte obligatoire',
      '',
      'Enregistrez ce post pour votre prochain envoi urgent : https://pdfexpress.ai.studio',
    ].join('\n'),
    hashtags:
      '#Freelance #AstuceProductivité #PDFExpress #SignatureÉlectronique #Entrepreneuriat',
    slides: [
      {
        badge: '30 SECONDES CHRONO',
        title: 'Dossier PDF trop lourd ? Contrat urgent à signer ?',
        body: 'Fini d’imprimer, scanner ou chercher un compresseur payant à la dernière minute.',
        cta: 'La méthode rapide →',
      },
      {
        badge: 'ÉTAPE 01 · OPTIMISER',
        title: 'Réduisez le poids jusqu’à -70 %',
        body: 'Choisissez le niveau de compression (Recommandée, Haute qualité ou Extrême) avec aperçu avant export.',
        cta: 'Passe les filtres e-mail',
      },
      {
        badge: 'ÉTAPE 02 · SIGNER',
        title: 'Apposez votre signature en 1 clic',
        body: 'Tracé manuscrit fluide ou texte typographique mémorisé localement pour vos futurs devis.',
        cta: 'Prêt à envoyer',
      },
      {
        badge: '100 % EN LIGNE',
        title: 'Testez sur pdfexpress.ai.studio',
        body: 'Compatible smartphone, tablette et ordinateur, même sans créer de compte.',
        cta: 'Ouvrir PDFExpress',
      },
    ],
  },
  {
    id: 'post-3-tiktok-reels-ia-ocr',
    number: 'Post 03',
    campaignTitle: 'OCR IA & Résumé automatique de longs PDF',
    networkLabel: 'Reels / TikTok',
    objective: 'Viralité & Démonstration IA',
    platformId: 'instagram_story',
    themeId: 'emerald',
    tone: 'Éducatif',
    topic:
      'Lire 40 pages de PDF scanné en 60 secondes grâce à l’OCR IA et la synthèse automatique',
    adCopy: [
      '45 pages de contrat ou de cours scanné à analyser avant une réunion dans 10 minutes ?',
      '',
      'Ne lisez plus tout ligne par ligne :',
      '• Importez votre scan dans OCR Avancé (IA) pour extraire tout le texte proprement',
      '• Générez un résumé structuré en points clés ou traduisez le document dans votre langue',
      '• Exportez en PDF indexable, Word (.docx) ou Markdown propre pour vos notes',
      '',
      'Gagnez des heures chaque semaine : https://pdfexpress.ai.studio',
    ].join('\n'),
    hashtags:
      '#IntelligenceArtificielle #OCR #PDFExpress #Étudiants #GainDeTemps #IA',
    slides: [
      {
        badge: 'OUTIL IA',
        title: '40 pages de PDF scanné à lire en 2 minutes ?',
        body: 'Transformez n’importe quelle image ou scan illisible en synthèse structurée et exploitable.',
        cta: 'Voir comment →',
      },
      {
        badge: 'OCR HAUTE PRÉCISION',
        title: 'Extrayez le texte de vos scans',
        body: 'Reconnaissance optique multilingue pour rendre vos documents enfin modifiables et indexables.',
        cta: 'Export Word & Markdown',
      },
      {
        badge: 'SYNTHÈSE & TRADUCTION',
        title: 'Résumez et posez vos questions au PDF',
        body: 'Obtenez les points essentiels page par page ou traduisez un rapport entier en un clic.',
        cta: 'Zéro perte de temps',
      },
      {
        badge: 'DISPONIBLE MAINTENANT',
        title: 'Essayez l’IA sur pdfexpress.ai.studio',
        body: 'Déposez votre premier PDF et obtenez votre synthèse en quelques secondes.',
        cta: 'pdfexpress.ai.studio',
      },
    ],
  },
  {
    id: 'post-4-x-pwa-privacy',
    number: 'Post 04',
    campaignTitle: 'Mode Hors-Ligne PWA & Confidentialité Totale',
    networkLabel: 'X (Twitter)',
    objective: 'Différenciation technique & Partages',
    platformId: 'x_post',
    themeId: 'amber_gold',
    tone: 'Annonce',
    topic:
      'PDFExpress fonctionne en WebAssembly local et même hors connexion Internet (PWA)',
    adCopy: [
      'La plupart des sites PDF téléversent vos documents sur un serveur distant.',
      'PDFExpress exécute vos manipulations PDF en local dans votre navigateur et s’installe en PWA pour travailler même hors connexion (train, avion, bureau sécurisé).',
      '',
      '34 outils gratuits · Zéro logiciel lourd · https://pdfexpress.ai.studio',
    ].join('\n'),
    hashtags: '#WebApp #PWA #PDFExpress #Tech #Confidentialité #OpenProductivity',
    slides: [
      {
        badge: 'ARCHITECTURE ZERO-UPLOAD',
        title: 'Vos PDF restent sur votre machine — même hors ligne',
        body: 'Installez PDFExpress en un clic (PWA) et manipulez vos documents dans le train ou sans Wi-Fi.',
        cta: 'pdfexpress.ai.studio',
      },
      {
        badge: 'MOTEUR LOCAL RAPIDE',
        title: 'Fusion, rotation, extraction et protection instantanées',
        body: 'Traitement binaire natif en mémoire vive avec aperçu miniature haute définition.',
        cta: 'Gratuit & sans pub intrusive',
      },
      {
        badge: 'ESSAI IMMÉDIAT',
        title: '34 outils PDF dans un seul onglet',
        body: 'Ouvrez pdfexpress.ai.studio sur desktop ou mobile.',
        cta: 'Lancer maintenant →',
      },
    ],
  },
  {
    id: 'post-5-facebook-convert-workflow',
    number: 'Post 05',
    campaignTitle: 'Conversion universelle & Flux automatisés 1-clic',
    networkLabel: 'Facebook',
    objective: 'Trafic & Adoption PME / Équipes',
    platformId: 'facebook_post',
    themeId: 'ocean',
    tone: 'Professionnel',
    topic:
      'Convertissez Word, Excel, PowerPoint et images en PDF et automatisez vos tâches répétitives',
    adCopy: [
      'Vous répétez toujours les mêmes actions sur vos factures et rapports PDF ?',
      'Fusionner, numéroter les pages, ajouter un filigrane et compresser…',
      '',
      'Avec PDFExpress :',
      '✓ Convertissez dans les deux sens : Word, Excel, PowerPoint, JPG, HTML et Markdown',
      '✓ Créez votre flux de travail automatisé pour enchaîner plusieurs actions en un seul clic',
      '✓ Accessible gratuitement en français sur ordinateur et mobile',
      '',
      'Simplifiez vos démarches dès aujourd’hui : https://pdfexpress.ai.studio',
    ].join('\n'),
    hashtags:
      '#Bureautique #PME #PDFExpress #Automatisation #ConversionPDF #TravailEfficace',
    slides: [
      {
        badge: 'TOUS FORMATS & AUTOMATISATION',
        title: 'Convertissez et automatisez vos PDF en 1 clic',
        body: 'Word, Excel, PowerPoint, JPG, HTML, Markdown + enchaînement automatique de vos étapes favorites.',
        cta: 'Découvrir PDFExpress',
      },
      {
        badge: 'FLUX SUR MESURE',
        title: 'Numéroter + Filigrane + Compresser en une passe',
        body: 'Gagnez de précieuses minutes sur chaque dossier client, facture ou rapport mensuel.',
        cta: 'Flux de travail 1-clic',
      },
      {
        badge: 'ACCÈS GRATUIT',
        title: 'Votre boîte à outils PDF sur pdfexpress.ai.studio',
        body: 'Sans installation requise, compatible Windows, macOS, Android et iOS.',
        cta: 'pdfexpress.ai.studio →',
      },
    ],
  },
];
