import type { ToolId } from '../types/pdf';

export interface ToolDocumentationItem {
  toolId: ToolId;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  options: { name: string; description: string }[];
  proTips: string[];
}

export const TOOL_DOCUMENTATIONS: Record<ToolId, ToolDocumentationItem> = {
  merge: {
    toolId: 'merge',
    title: 'Fusionner PDF',
    category: 'Organiser PDF',
    summary: 'Combinez plusieurs fichiers PDF en un seul document ordonné.',
    steps: [
      'Glissez-déposez vos fichiers PDF ou cliquez sur le bouton de sélection.',
      'Réorganisez l’ordre des fichiers en les déplaçant ou en utilisant les flèches.',
      'Cliquez sur "Fusionner PDF" pour lancer l’assemblage instantané dans votre navigateur.',
      'Téléchargez votre nouveau document combiné.',
    ],
    options: [
      { name: 'Nom du fichier final', description: 'Personnalisez le nom du PDF fusionné (ex: MonDossier.pdf).' },
      { name: 'Ordre des fichiers', description: 'Glissez les cartes pour ajuster l’ordre d’assemblage.' },
    ],
    proTips: [
      'Vous pouvez combiner des PDF de tailles et d’orientations différentes.',
      'Le traitement est 100% local : vos documents confidentiels ne quittent jamais votre appareil.',
    ],
  },
  split: {
    toolId: 'split',
    title: 'Diviser PDF',
    category: 'Organiser PDF',
    summary: 'Séparez un grand PDF en plusieurs fichiers distincts par pages ou intervalles.',
    steps: [
      'Importez le fichier PDF à diviser.',
      'Choisissez le mode de division : par intervalle personnalisé (ex: 1-3, 5) ou extraction de chaque page.',
      'Cliquez sur "Diviser PDF" pour générer les fichiers.',
      'Récupérez vos documents séparés individuellement ou sous forme d’archive ZIP.',
    ],
    options: [
      { name: 'Mode Plage de pages', description: 'Définissez des intervalles précis (ex: 1-4, 6-10).' },
      { name: 'Mode Toutes les pages', description: 'Sépare chaque page du document en un PDF indépendant.' },
    ],
    proTips: [
      'Idéal pour isoler un chapitre ou un bulletin spécifique d’un rapport volumineux.',
    ],
  },
  removepages: {
    toolId: 'removepages',
    title: 'Supprimer des pages',
    category: 'Organiser PDF',
    summary: 'Éliminez les pages indésirables d’un document grâce à un aperçu visuel miniature.',
    steps: [
      'Chargez votre fichier PDF.',
      'Cliquez sur les miniatures des pages que vous souhaitez supprimer (elles seront marquées en rouge).',
      'Cliquez sur "Supprimer les pages" pour enregistrer le document épuré.',
    ],
    options: [
      { name: 'Aperçu haute résolution', description: 'Visualisez chaque page avant suppression pour éviter les erreurs.' },
    ],
    proTips: [
      'Vous devez conserver au moins une page dans le document final.',
    ],
  },
  extractpages: {
    toolId: 'extractpages',
    title: 'Extraire des pages',
    category: 'Organiser PDF',
    summary: 'Sélectionnez et isolez uniquement les pages qui vous intéressent.',
    steps: [
      'Importez le PDF source.',
      'Sélectionnez les pages à conserver en cliquant sur leurs miniatures.',
      'Choisissez le mode d’export (fichier unique ou archive ZIP pour plusieurs fichiers distincts).',
      'Validez pour télécharger.',
    ],
    options: [
      { name: 'Format d’export', description: 'Regrouper en un seul PDF ou extraire chaque page en fichier séparé.' },
    ],
    proTips: [
      'Parfait pour extraire des annexes ou des tableaux de bord spécifiques.',
    ],
  },
  organizepages: {
    toolId: 'organizepages',
    title: 'Organiser PDF',
    category: 'Organiser PDF',
    summary: 'Combinez jusqu’à 15 fichiers PDF, puis réagencez par glisser-déposer, pivotez, triez, dupliquez ou supprimez des pages dans une vue grille complète.',
    steps: [
      'Chargez un ou plusieurs fichiers PDF (jusqu’à 15 fichiers) pour afficher toutes leurs pages avec repères couleur.',
      'Glissez-déposez les miniatures directement dans la grille ou utilisez les flèches de la barre latérale pour déplacer des documents complets.',
      'Filtrez par fichier, triez de A à Z, groupez, inversez l’ordre ou pivotez chaque page selon vos besoins.',
      'Cliquez sur "Enregistrer l’ordre" pour générer le PDF combiné et réorganisé.',
    ],
    options: [
      { name: 'Jusqu’à 15 fichiers PDF', description: 'Importez jusqu’à 15 PDF avec code couleur par fichier source et réordonnancement de documents entiers.' },
      { name: 'Glisser-déposer & Tri rapide', description: 'Déplacez les pages librement à la souris, triez A→Z, groupez par fichier ou inversez en un clic.' },
      { name: 'Rotation & Duplication', description: 'Pivotez individuellement ou globalement (+90°) et dupliquez n’importe quelle page.' },
    ],
    proTips: [
      'Utilisez le filtre par fichier en haut de la grille pour inspecter rapidement un document précis parmi les 15 PDF chargés.',
    ],
  },
  scan2pdf: {
    toolId: 'scan2pdf',
    title: 'Numériser au format PDF',
    category: 'Organiser PDF',
    summary: 'Transformez des photos de documents ou des prises de vue de caméra en PDF professionnel.',
    steps: [
      'Cliquez pour importer des photos ou activez votre caméra pour photographier un document.',
      'Ajustez le filtre (Noir & Blanc net ou Couleur naturelle).',
      'Ajoutez plusieurs pages si nécessaire.',
      'Cliquez sur "Générer le PDF scanné".',
    ],
    options: [
      { name: 'Filtre de scan', description: 'Mode N&B (haute lisibilité texte) ou Couleur.' },
    ],
    proTips: [
      'Parfait pour numériser des reçus, des contrats signés ou des notes manuscrites depuis un smartphone.',
    ],
  },
  compress: {
    toolId: 'compress',
    title: 'Compresser PDF',
    category: 'Optimiser le PDF',
    summary: 'Réduisez considérablement la taille de vos fichiers PDF pour faciliter leur envoi par e-mail.',
    steps: [
      'Sélectionnez un ou plusieurs fichiers PDF.',
      'Choisissez le niveau de compression (Extrême, Recommandée, Basse ou Sans perte).',
      'Lancez la compression et téléchargez vos fichiers allégés.',
    ],
    options: [
      { name: 'Niveaux de compression', description: 'Recommandée (équilibre parfait taille/qualité) ou Extrême (poids minimal).' },
    ],
    proTips: [
      'Idéal pour contourner les limites de taille des pièces jointes d’e-mail.',
    ],
  },
  repair: {
    toolId: 'repair',
    title: 'Réparer PDF',
    category: 'Optimiser le PDF',
    summary: 'Restaurez la structure et lisez des fichiers PDF endommagés ou corrompus.',
    steps: [
      'Importez le fichier PDF corrompu ou illisible.',
      'Laissez l’outil analyser et reconstruire l’arborescence des objets du fichier.',
      'Téléchargez le PDF réparé.',
    ],
    options: [
      { name: 'Reconstruction automatique', description: 'Répare les tables de références croisées (xref) endommagées.' },
    ],
    proTips: [
      'Permet souvent de récupérer des documents refusés par d’autres visionneuses.',
    ],
  },
  ocr: {
    toolId: 'ocr',
    title: 'OCR PDF',
    category: 'Optimiser le PDF',
    summary: 'Rendez les PDF scannés (images) interrogeables et sélectionnables grâce à la reconnaissance optique.',
    steps: [
      'Importez votre PDF image / scanné.',
      'Sélectionnez la langue principale du document.',
      'Lancez la reconnaissance OCR pour superposer une couche de texte invisible.',
      'Téléchargez votre PDF désormais consultable et copiable.',
    ],
    options: [
      { name: 'Sélection de langue', description: 'Améliore la précision de reconnaissance pour le français, l’anglais, etc.' },
    ],
    proTips: [
      'Permet de rechercher des mots-clés dans des documents papier numérisés.',
    ],
  },
  jpg2pdf: {
    toolId: 'jpg2pdf',
    title: 'JPG en PDF',
    category: 'Convertir en PDF',
    summary: 'Convertissez vos images (JPG, PNG, WebP) en documents PDF de haute qualité.',
    steps: [
      'Sélectionnez une ou plusieurs images.',
      'Définissez l’orientation (Portrait, Paysage ou Ajusté) et les marges.',
      'Cliquez sur "Convertir en PDF".',
      'Téléchargez le document résultant.',
    ],
    options: [
      { name: 'Orientation', description: 'Portrait, Paysage ou Ajustement automatique à la taille de l’image.' },
      { name: 'Marges', description: 'Sans marge (plein cadre) ou avec marges blanches élégantes.' },
    ],
    proTips: [
      'Pratique pour regrouper des photos de vacances ou des captures d’écran en un seul PDF.',
    ],
  },
  word2pdf: {
    toolId: 'word2pdf',
    title: 'Word en PDF',
    category: 'Convertir en PDF',
    summary: 'Convertissez vos fichiers Word (.docx) ou texte en PDF structuré.',
    steps: [
      'Importez votre fichier .docx ou .txt.',
      'Vérifiez l’aperçu du contenu textuel et de la mise en forme.',
      'Cliquez sur "Convertir WORD en PDF".',
      'Téléchargez le PDF généré.',
    ],
    options: [
      { name: 'Mise en page', description: 'Respect des polices, titres et paragraphes du document source.' },
    ],
    proTips: [
      'Idéal pour figer la mise en forme d’un CV ou d’un rapport avant diffusion.',
    ],
  },
  ppt2pdf: {
    toolId: 'ppt2pdf',
    title: 'PowerPoint en PDF',
    category: 'Convertir en PDF',
    summary: 'Transformez vos présentations PowerPoint en PDF faciles à projeter et partager.',
    steps: [
      'Sélectionnez votre fichier .pptx ou texte de présentation.',
      'Lancez la conversion.',
      'Téléchargez votre PDF de présentation.',
    ],
    options: [
      { name: 'Format diapositives', description: 'Conserve la structure des slides pour une lecture fluide.' },
    ],
    proTips: [
      'Permet de s’assurer que vos polices et graphiques s’afficheront parfaitement sur n’importe quel appareil.',
    ],
  },
  excel2pdf: {
    toolId: 'excel2pdf',
    title: 'Excel en PDF',
    category: 'Convertir en PDF',
    summary: 'Convertissez vos feuilles de calcul Excel (.xlsx, .csv) en tableaux PDF propres.',
    steps: [
      'Importez votre fichier Excel ou CSV.',
      'L’outil convertit les cellules et tableaux en pages PDF lisibles.',
      'Téléchargez le fichier.',
    ],
    options: [
      { name: 'Mise en page tabulaire', description: 'Ajustement automatique des colonnes pour éviter les coupures.' },
    ],
    proTips: [
      'Parfait pour imprimer ou archiver des bilans financiers et des tableaux de données.',
    ],
  },
  html2pdf: {
    toolId: 'html2pdf',
    title: 'HTML en PDF',
    category: 'Convertir en PDF',
    summary: 'Convertissez du code HTML brut ou des pages web en documents PDF formatés.',
    steps: [
      'Collez ou importez votre code HTML dans l’éditeur intégré.',
      'Visualisez le rendu en temps réel.',
      'Cliquez sur "Convertir HTML en PDF".',
      'Téléchargez le fichier.',
    ],
    options: [
      { name: 'Éditeur HTML', description: 'Modifiez directement le balisage pour ajuster styles et tableaux.' },
    ],
    proTips: [
      'Idéal pour générer des reçus, factures ou certificats dynamiques.',
    ],
  },
  pdf2jpg: {
    toolId: 'pdf2jpg',
    title: 'PDF en JPG',
    category: 'Convertir depuis PDF',
    summary: 'Convertissez chaque page d’un PDF en images JPG haute définition.',
    steps: [
      'Importez le fichier PDF.',
      'Ajustez la résolution/échelle d’export.',
      'Lancez la conversion pour récupérer toutes les pages en images séparées.',
    ],
    options: [
      { name: 'Échelle de rendu', description: 'Définissez la netteté et la résolution des images JPG générées.' },
    ],
    proTips: [
      'Parfait pour insérer des pages de PDF dans des présentations ou réseaux sociaux.',
    ],
  },
  pdf2word: {
    toolId: 'pdf2word',
    title: 'PDF en Word',
    category: 'Convertir depuis PDF',
    summary: 'Extrayez et convertissez le texte et la structure d’un PDF en document modifiable (.docx).',
    steps: [
      'Sélectionnez votre PDF.',
      'Lancez l’extraction et la conversion.',
      'Téléchargez le fichier Word prêt à l’édition.',
    ],
    options: [
      { name: 'Conservation du texte', description: 'Extraction propre des paragraphes et titres.' },
    ],
    proTips: [
      'Permet de récupérer le contenu textuel d’un document verrouillé ou scanné.',
    ],
  },
  pdf2ppt: {
    toolId: 'pdf2ppt',
    title: 'PDF en PowerPoint',
    category: 'Convertir depuis PDF',
    summary: 'Transformez un document PDF en diapositives modifiables PowerPoint (.pptx).',
    steps: [
      'Importez le PDF source.',
      'Convertissez en présentation.',
      'Téléchargez votre fichier .pptx.',
    ],
    options: [
      { name: 'Génération de slides', description: 'Sépare le contenu par sections et pages.' },
    ],
    proTips: [
      'Gagnez un temps précieux pour reprendre un support de cours ou un rapport en présentation.',
    ],
  },
  pdf2excel: {
    toolId: 'pdf2excel',
    title: 'PDF en Excel',
    category: 'Convertir depuis PDF',
    summary: 'Extrayez les tableaux et données chiffrées d’un PDF vers une feuille de calcul Excel (.xlsx).',
    steps: [
      'Chargez le PDF contenant des tableaux.',
      'Extrayez les données tabulaires.',
      'Téléchargez le fichier Excel.',
    ],
    options: [
      { name: 'Extraction tabulaire', description: 'Détecte les lignes et colonnes pour les structurer en cellules.' },
    ],
    proTips: [
      'Indispensable pour analyser des statistiques ou bilans publiés au format PDF.',
    ],
  },
  pdf2pdfa: {
    toolId: 'pdf2pdfa',
    title: 'PDF en PDF/A',
    category: 'Convertir depuis PDF',
    summary: 'Convertissez votre PDF au format ISO standardisé (PDF/A-1b) pour un archivage pérenne.',
    steps: [
      'Importez le PDF.',
      'Convertissez au format d’archivage normalisé.',
      'Téléchargez le fichier conforme.',
    ],
    options: [
      { name: 'Conformité ISO 19005', description: 'Garantit l’intégrité et la lisibilité à long terme sans dépendre des polices externes.' },
    ],
    proTips: [
      'Obligatoire pour les archives administratives, notariales et comptables à long terme.',
    ],
  },
  pdf2md: {
    toolId: 'pdf2md',
    title: 'PDF en Markdown',
    category: 'Convertir depuis PDF',
    summary: 'Convertissez le contenu d’un PDF en fichier Markdown (.md) structuré.',
    steps: [
      'Importez le PDF.',
      'Extrayez le texte formaté en Markdown.',
      'Téléchargez le fichier .md.',
    ],
    options: [
      { name: 'Balisage Markdown', description: 'Génère automatiquement les titres (#, ##), listes et citations.' },
    ],
    proTips: [
      'Idéal pour alimenter des wikis, Obsidian, Notion ou des bases de connaissances IA.',
    ],
  },
  rotate: {
    toolId: 'rotate',
    title: 'Faire pivoter PDF',
    category: 'Modifier PDF',
    summary: 'Pivotez toutes les pages ou des pages spécifiques de votre PDF à 90°, 180° ou 270°.',
    steps: [
      'Importez le PDF.',
      'Choisissez d’appliquer la rotation à toutes les pages ou cliquez sur des pages individuelles.',
      'Enregistrez et téléchargez le document redressé.',
    ],
    options: [
      { name: 'Rotation globale ou ciblée', description: 'Redressez un document scanné à l’envers en un clic.' },
    ],
    proTips: [
      'Très utile pour corriger instantanément des PDF numérisés en mode paysage.',
    ],
  },
  pagenumbers: {
    toolId: 'pagenumbers',
    title: 'Numéros de pages',
    category: 'Modifier PDF',
    summary: 'Ajoutez des numéros de page élégants à votre document avec choix de position et de format.',
    steps: [
      'Importez le PDF.',
      'Sélectionnez la position (bas, haut, gauche, centre, droite) et le format de numérotation.',
      'Appliquez et téléchargez le PDF numéroté.',
    ],
    options: [
      { name: 'Positions', description: 'Bas de page (centre, droite, gauche) ou haut de page.' },
      { name: 'Formats', description: 'Chiffre simple (1) ou mention (Page X sur Y).' },
    ],
    proTips: [
      'Indispensable pour structurer des rapports et thèses avant impression.',
    ],
  },
  watermark: {
    toolId: 'watermark',
    title: 'Filigrane',
    category: 'Modifier PDF',
    summary: 'Appliquez un filigrane textuel personnalisé (ex: CONFIDENTIEL, BROUILLON) avec angle et opacité.',
    steps: [
      'Importez le PDF.',
      'Saisissez votre texte de filigrane.',
      'Ajustez la couleur, l’angle de rotation et la transparence.',
      'Appliquez et téléchargez le fichier filigrané.',
    ],
    options: [
      { name: 'Opacité et Angle', description: 'Contrôlez la discrétion et l’orientation du filigrane.' },
    ],
    proTips: [
      'Protégez la propriété intellectuelle de vos documents partagés en externe.',
    ],
  },
  crop: {
    toolId: 'crop',
    title: 'Rogner PDF',
    category: 'Modifier PDF',
    summary: 'Réduisez les marges superflues ou ciblez une zone spécifique de vos pages PDF.',
    steps: [
      'Importez le PDF.',
      'Définissez les marges de rognage (haut, bas, gauche, droite).',
      'Prévisualisez et appliquez pour télécharger le document recadré.',
    ],
    options: [
      { name: 'Marges personnalisées', description: 'Ajustez précisément la zone utile de chaque page.' },
    ],
    proTips: [
      'Parfait pour éliminer les en-têtes/pieds de page inutiles ou adapter un PDF à un écran de liseuse.',
    ],
  },
  editpdf: {
    toolId: 'editpdf',
    title: 'Modifier PDF',
    category: 'Modifier PDF',
    summary: 'Ajoutez du texte, des surlignages colorés et des notes directement sur vos pages PDF.',
    steps: [
      'Importez le PDF.',
      'Sélectionnez l’outil d’annotation (Texte, Surlignage, Couleur).',
      'Cliquez sur la page pour insérer vos modifications.',
      'Enregistrez et téléchargez le PDF annoté.',
    ],
    options: [
      { name: 'Surlignage & Texte', description: 'Personnalisez la couleur, la taille et le contenu textuel.' },
    ],
    proTips: [
      'Idéal pour corriger une coquille ou annoter un contrat à la volée.',
    ],
  },
  pdfforms: {
    toolId: 'pdfforms',
    title: 'Formulaires PDF',
    category: 'Modifier PDF',
    summary: 'Créez ou remplissez des formulaires interactifs avec champs de texte, cases à cocher et listes déroulantes.',
    steps: [
      'Importez le PDF.',
      'Sélectionnez le type de champ interactif à ajouter (Texte, Case à cocher, Liste).',
      'Placez le champ sur le document.',
      'Exportez votre formulaire interactif prêt à être rempli.',
    ],
    options: [
      { name: 'Types de champs', description: 'Champs de texte, cases à cocher et listes à options.' },
    ],
    proTips: [
      'Parfait pour concevoir des questionnaires administratifs ou des bons de commande.',
    ],
  },
  unlock: {
    toolId: 'unlock',
    title: 'Déverrouiller PDF',
    category: 'Sécurité PDF',
    summary: 'Retirez la protection par mot de passe d’un PDF si vous possédez les accréditations nécessaires.',
    steps: [
      'Importez le PDF protégé.',
      'Saisissez le mot de passe requis pour déverrouiller le document.',
      'Générez et téléchargez le PDF sans restriction.',
    ],
    options: [
      { name: 'Saisie du mot de passe', description: 'Permet de lever les restrictions d’impression et de copie.' },
    ],
    proTips: [
      'Facilite la consultation de vos propres documents sécurisés sur tous vos appareils.',
    ],
  },
  protect: {
    toolId: 'protect',
    title: 'Protéger PDF',
    category: 'Sécurité PDF',
    summary: 'Chiffrez et sécurisez vos documents PDF avec un mot de passe robuste.',
    steps: [
      'Importez le PDF.',
      'Saisissez un mot de passe fort.',
      'Appliquez la protection et téléchargez le fichier chiffré.',
    ],
    options: [
      { name: 'Chiffrement par mot de passe', description: 'Empêche l’ouverture du document par des tiers non autorisés.' },
    ],
    proTips: [
      'Indispensable pour l’envoi de bulletins de paie, contrats ou données financières confidentielles.',
    ],
  },
  sign: {
    toolId: 'sign',
    title: 'Signer PDF',
    category: 'Sécurité PDF',
    summary: 'Dessinez ou tapez votre signature électronique et positionnez-la sur vos documents.',
    steps: [
      'Importez le PDF.',
      'Créez votre signature en la dessinant à la souris/tactile ou en la tapant au clavier.',
      'Cliquez sur l’endroit souhaité du document pour y apposer votre signature.',
      'Téléchargez votre contrat signé.',
    ],
    options: [
      { name: 'Tracé tactile ou textuel', description: 'Mémorisation automatique de votre signature pour vos prochains documents.' },
    ],
    proTips: [
      'Vos signatures sont mémorisées localement dans votre navigateur pour un accès instantané.',
    ],
  },
  redact: {
    toolId: 'redact',
    title: 'Censurer PDF',
    category: 'Sécurité PDF',
    summary: 'Masquez définitivement les informations confidentielles ou personnelles sous des rectangles noirs opaques.',
    steps: [
      'Importez le PDF.',
      'Sélectionnez les zones de texte ou données sensibles à caviarder.',
      'Appliquez la censure définitive pour télécharger le document sécurisé.',
    ],
    options: [
      { name: 'Caviardage irréversible', description: 'Supprime et masque définitivement les données sous-jacentes.' },
    ],
    proTips: [
      'Conforme aux exigences RGPD pour la transmission de pièces d’identité ou de données bancaires.',
    ],
  },
  compare: {
    toolId: 'compare',
    title: 'Comparer PDF',
    category: 'Sécurité PDF',
    summary: 'Comparez deux versions d’un document PDF côte à côte et générez un rapport de modifications.',
    steps: [
      'Importez le premier fichier PDF.',
      'Chargez le second fichier PDF à comparer.',
      'Visualisez les différences textuelles et téléchargez le rapport de comparaison.',
    ],
    options: [
      { name: 'Rapport comparatif', description: 'Met en évidence les ajouts et suppressions entre les deux versions.' },
    ],
    proTips: [
      'Idéal pour valider des modifications de contrats ou de clauses juridiques.',
    ],
  },
  aisummary: {
    toolId: 'aisummary',
    title: 'Générateur de résumé par IA',
    category: 'Intelligence PDF',
    summary: 'Générez un résumé intelligent et structuré de vos rapports, articles et thèses.',
    steps: [
      'Importez le PDF.',
      'Choisissez le style de résumé souhaité (synthèse courte, points clés ou rapport détaillé).',
      'Lancez l’analyse IA et consultez le résultat.',
    ],
    options: [
      { name: 'Styles de résumé', description: 'Bullet points, résumé court ou analyse détaillée.' },
    ],
    proTips: [
      'Gagnez des heures de lecture sur des documents de recherche ou des livres blancs volumineux.',
    ],
  },
  translatepdf: {
    toolId: 'translatepdf',
    title: 'Traduire le PDF',
    category: 'Intelligence PDF',
    summary: 'Traduisez vos documents PDF dans la langue de votre choix tout en préservant la mise en page.',
    steps: [
      'Importez le PDF.',
      'Sélectionnez la langue cible (Anglais, Espagnol, Arabe, Allemand, etc.).',
      'Lancez la traduction et téléchargez le document traduit.',
    ],
    options: [
      { name: 'Langues multiples', description: 'Traduction contextuelle fidèle au document d’origine.' },
    ],
    proTips: [
      'Permet d’assimiler des documentations techniques ou articles étrangers instantanément.',
    ],
  },
  aiocr: {
    toolId: 'aiocr',
    title: 'OCR Avancé (IA)',
    category: 'Intelligence PDF',
    summary: 'Extrayez et reconnaissez du texte complexe, manuscrit ou de faible qualité grâce à l’intelligence artificielle.',
    steps: [
      'Importez un PDF scanné ou des images.',
      'Lancez l’OCR intelligent.',
      'Téléchargez le document indexé et modifiable.',
    ],
    options: [
      { name: 'Reconnaissance intelligente', description: 'Idéal pour les documents anciens ou photographiés dans de mauvaises conditions.' },
    ],
    proTips: [
      'Dépasse les performances des OCR traditionnels sur les polices atypiques.',
    ],
  },
  socialpost: {
    toolId: 'socialpost',
    title: 'Posts Réseaux Sociaux',
    category: 'Intelligence PDF',
    summary: 'Transformez un PDF ou une idée en carrousels LinkedIn et visuels prêts pour les réseaux sociaux.',
    steps: [
      'Importez un PDF source ou saisissez votre thématique.',
      'Personnalisez le design, les couleurs et le texte des slides.',
      'Exportez vos visuels et carrousels pour LinkedIn, Instagram ou X.',
    ],
    options: [
      { name: 'Formats multiples', description: 'Carrousel LinkedIn, story Instagram ou post illustré.' },
    ],
    proTips: [
      'Idéal pour transformer un rapport d’entreprise en contenu viral et percutant.',
    ],
  },
  workflow: {
    toolId: 'workflow',
    title: 'Créer un flux de travail',
    category: 'Flux de travail',
    summary: 'Enchaînez plusieurs actions (ex: Fusionner -> Numéroter -> Compresser) en un seul clic.',
    steps: [
      'Sélectionnez vos fichiers PDF.',
      'Configurez la chaîne d’actions (les étapes successives à exécuter).',
      'Lancez le flux de travail automatisé.',
      'Téléchargez le résultat final ayant subi toutes les transformations.',
    ],
    options: [
      { name: 'Séquence personnalisable', description: 'Combinez fusion, numérotation, filigrane et compression.' },
    ],
    proTips: [
      'Le gain de productivité ultime pour vos tâches documentaires récurrentes.',
    ],
  },
  stampgenerator: {
    toolId: 'stampgenerator',
    title: 'Générateur de cachet',
    category: 'Modifier PDF',
    summary: 'Créez et apposez des cachets officiels personnalisés sur vos documents PDF.',
    steps: [
      'Importez votre fichier PDF.',
      'Personnalisez la forme du cachet (circulaire, rectangulaire, badge), les textes et la couleur d’encre.',
      'Choisissez la position sur la page et le mode d’application.',
      'Générez et téléchargez votre PDF cacheté.',
    ],
    options: [
      { name: 'Formes et Couleurs', description: 'Formes circulaires ou rectangulaires avec encres professionnelles.' },
      { name: 'Textes et Date', description: 'Personnalisez l’en-tête, le texte central et la date officielle.' },
    ],
    proTips: [
      'Idéal pour valider des factures, contrats, devis et attestations administratives.',
    ],
  },
};
