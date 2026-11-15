import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Cookie,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  Map as MapIcon,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { CATEGORIES, TOOLS } from '../data/tools';
import type { ToolId } from '../types/pdf';
import {
  type CookieConsentState,
  clearCookieConsent,
  readCookieConsent,
  saveCookieConsent,
  subscribeCookieConsent,
} from '../utils/cookieConsent';

export type LegalPageKey =
  | 'privacy'
  | 'terms'
  | 'cookies'
  | 'security'
  | 'accessibility'
  | 'legal'
  | 'sitemap';

interface LegalPagesViewProps {
  page: LegalPageKey;
  onNavigateLegal: (page: LegalPageKey) => void;
  onNavigateRoute: (path: '/about' | '/contact' | '/faq' | '/tarifs') => void;
  onSelectTool: (toolId: ToolId) => void;
  onBackHome: () => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const LEGAL_NAV_ITEMS: Array<{
  id: LegalPageKey;
  label: string;
  href: string;
}> = [
  { id: 'privacy', label: 'Confidentialité', href: '/confidentialite' },
  { id: 'terms', label: 'Conditions', href: '/conditions' },
  { id: 'cookies', label: 'Cookies', href: '/cookies' },
  { id: 'security', label: 'Sécurité', href: '/securite' },
  { id: 'accessibility', label: 'Accessibilité', href: '/accessibilite' },
  { id: 'legal', label: 'Mentions légales', href: '/mentions-legales' },
  { id: 'sitemap', label: 'Plan du site', href: '/plan-du-site' },
];

const LAST_UPDATED_LABEL = '15 novembre 2026';
const PUBLISHER_DOMAIN = 'pdfexpress.ai.studio';
const CONTACT_EMAIL = 'laghribredouane@gmail.com';
const ADSENSE_PUB_ID = 'ca-pub-7807016100432800';

export function LegalPagesView({
  page,
  onNavigateLegal,
  onNavigateRoute,
  onSelectTool,
  onBackHome,
  onNotify,
}: LegalPagesViewProps) {
  const [consent, setConsent] = useState<CookieConsentState | null>(() =>
    readCookieConsent()
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  useEffect(() => {
    return subscribeCookieConsent(() => {
      setConsent(readCookieConsent());
    });
  }, []);

  const handleCookieChoice = (choice: 'accepted' | 'essential_only') => {
    saveCookieConsent(choice);
    onNotify?.(
      choice === 'accepted'
        ? 'Préférences enregistrées : cookies et annonces standards activés.'
        : 'Préférences enregistrées : cookies essentiels uniquement (annonces non personnalisées).',
      'success'
    );
  };

  const handleResetConsent = () => {
    clearCookieConsent();
    onNotify?.('Consentement réinitialisé.', 'info');
  };

  const renderSectionHeading = (
    kicker: string,
    title: string,
    summary: string
  ) => (
    <header className="pb-8 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span className="font-semibold text-brand-red">{kicker}</span>
        <span aria-hidden="true">·</span>
        <span>Mise à jour : {LAST_UPDATED_LABEL}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono">{PUBLISHER_DOMAIN}</span>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl">
        {summary}
      </p>
    </header>
  );

  return (
    <main className="flex-grow py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8">
      {/* Top Back & Quick Legal Nav */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l’accueil</span>
          </button>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('/about');
              }}
              className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              À propos
            </a>
            <a
              href="/faq"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('/faq');
              }}
              className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('/contact');
              }}
              className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Contact
            </a>
          </div>
        </div>

        {/* Single-line horizontal legal tabs */}
        <nav
          aria-label="Navigation des pages légales et informations"
          className="flex items-center gap-1.5 p-1.5 rounded-xl bg-neutral-100/90 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto"
        >
          {LEGAL_NAV_ITEMS.map((item) => {
            const active = item.id === page;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateLegal(item.id);
                }}
                aria-current={active ? 'page' : undefined}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Page Body */}
      <article className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-10 space-y-8">
        {page === 'privacy' && (
          <>
            {renderSectionHeading(
              'Confidentialité & RGPD',
              'Politique de confidentialité de PDFExpress',
              `La présente politique décrit comment PDFExpress (${PUBLISHER_DOMAIN}) traite vos données personnelles, vos documents PDF et les traceurs publicitaires ou techniques conformément au RGPD et aux exigences de transparence Google AdSense.`
            )}

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                1. Traitement local des fichiers PDF (Architecture Zero-Upload)
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                La quasi-totalité des 34 outils PDF de PDFExpress (fusion, division, compression, rotation, filigrane, signature, formulaires, caviardage, conversion locale) s’exécute directement dans la mémoire vive de votre navigateur via JavaScript et WebAssembly (pdf-lib, PDF.js). Vos fichiers PDF ne sont ni envoyés ni stockés de façon permanente sur nos serveurs.
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Lorsque vous utilisez volontairement une fonctionnalité d’intelligence artificielle (Résumé par IA, Traduction IA, OCR IA ou Générateur social), seul le texte extrait ou les pages soumises explicitement sont transmis via une connexion chiffrée HTTPS à notre serveur applicatif afin de générer la réponse demandée, sans conservation durable après traitement.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                2. Publicité Google AdSense et fournisseurs tiers
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                PDFExpress finance son accès gratuit grâce au programme publicitaire <strong>Google AdSense</strong> (identifiant éditeur{' '}
                <span className="font-mono text-xs">{ADSENSE_PUB_ID}</span>). Dans ce cadre, Google et ses partenaires tiers peuvent déposer et lire des cookies ou utiliser des identifiants d’appareil sur votre navigateur afin de diffuser des annonces adaptées à vos visites antérieures sur ce site ou sur d’autres sites Web.
              </p>
              <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300 list-disc pl-5">
                <li>
                  L’utilisation de cookies publicitaires par Google lui permet, ainsi qu’à ses partenaires, de vous proposer des annonces pertinentes ou non personnalisées selon votre choix de consentement.
                </li>
                <li>
                  Vous pouvez désactiver la publicité personnalisée à tout moment depuis les{' '}
                  <a
                    href="https://adssettings.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-red font-semibold underline underline-offset-4 inline-flex items-center gap-1"
                  >
                    <span>Paramètres des annonces Google</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  ou consulter les{' '}
                  <a
                    href="https://policies.google.com/technologies/ads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-red font-semibold underline underline-offset-4 inline-flex items-center gap-1"
                  >
                    <span>Règles Google relatives à la publicité</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  .
                </li>
                <li>
                  Vous pouvez également configurer votre préférence directement sur notre page dédiée{' '}
                  <a
                    href="/cookies"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateLegal('cookies');
                    }}
                    className="text-brand-red font-semibold underline underline-offset-4"
                  >
                    Gestion des cookies &amp; consentement
                  </a>
                  . Les utilisateurs disposant d’un abonnement Premium actif ne reçoivent aucune requête publicitaire.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                3. Compte utilisateur, historique cloud et Google Workspace
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                La création d’un compte est facultative. Si vous choisissez de vous connecter via Google ou par e-mail (Firebase Authentication), nous collectons uniquement votre nom d’affichage, votre adresse e-mail, le statut de votre abonnement/quota et les métadonnées de votre historique récent si vous utilisez l’espace connecté (Cloud Firestore).
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Si vous autorisez les intégrations Google Workspace (Gmail ou Google Agenda) pour importer une pièce jointe ou planifier un rappel PDF, les jetons OAuth restent strictement en mémoire vive de session et ne sont jamais vendus ni partagés à des tiers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                4. Durée de conservation &amp; droits RGPD
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Vos préférences locales (thème clair/sombre, dernière signature dessinée, choix cookies) demeurent dans le stockage local de votre navigateur jusqu’à ce que vous les effaciez. Conformément au RGPD, vous disposez d’un droit d’accès, de rectification, de portabilité et de suppression de vos données de compte.
              </p>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Pour exercer vos droits ou poser toute question relative à la confidentialité, contactez-nous à{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold text-neutral-900 dark:text-white underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                ou via le{' '}
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateRoute('/contact');
                  }}
                  className="font-semibold text-brand-red underline underline-offset-4"
                >
                  formulaire de contact
                </a>
                .
              </p>
            </section>
          </>
        )}

        {page === 'terms' && (
          <>
            {renderSectionHeading(
              'Conditions d’utilisation',
              'Conditions générales d’utilisation (CGU)',
              `L’utilisation du site ${PUBLISHER_DOMAIN} et de ses outils PDF implique l’acceptation pleine et entière des présentes conditions générales d’utilisation.`
            )}

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                1. Objet du service
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                PDFExpress met à disposition une suite d’outils web et PWA permettant d’organiser, compresser, convertir, modifier, protéger, signer et analyser des documents au format PDF directement depuis un navigateur compatible.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                2. Accès gratuit, quotas et offre Premium
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                L’accès standard aux outils PDF est proposé gratuitement avec affichage d’espaces publicitaires Google AdSense conformes aux règles de l’éditeur. Des formules Premium payantes (sans publicité, quotas étendus et fonctionnalités IA dédiées) sont détaillées sur la page{' '}
                <a
                  href="/tarifs"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateRoute('/tarifs');
                  }}
                  className="font-semibold text-brand-red underline underline-offset-4"
                >
                  Tarification
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                3. Propriété des documents et usage licite
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Vous conservez l’intégralité des droits de propriété intellectuelle et de confidentialité sur les documents traités avec PDFExpress. Vous vous engagez à ne pas utiliser les outils de déverrouillage ou d’édition pour contourner illégalement des droits d’auteur ou traiter des contenus illicites.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                4. Vérification des documents &amp; responsabilité
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Avant toute diffusion juridique, comptable, administrative ou archivage à long terme, l’utilisateur reste responsable de la vérification visuelle et du contenu des fichiers générés (notamment après compression, OCR, traduction ou caviardage). Le service est fourni en l’état avec une obligation de moyens.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                5. Droit applicable &amp; contact
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Pour toute question relative aux présentes conditions, vous pouvez écrire à{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold text-neutral-900 dark:text-white underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                ou utiliser la page{' '}
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateRoute('/contact');
                  }}
                  className="font-semibold text-brand-red underline underline-offset-4"
                >
                  Contact
                </a>
                .
              </p>
            </section>
          </>
        )}

        {page === 'cookies' && (
          <>
            {renderSectionHeading(
              'Cookies & Consentement',
              'Politique de cookies et préférences publicitaires',
              'Transparence complète sur les traceurs fonctionnels et les cookies publicitaires Google AdSense utilisés sur PDFExpress, avec contrôle direct de vos choix.'
            )}

            {/* Interactive Cookie Preference Center */}
            <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/50 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Cookie className="w-5 h-5 text-brand-red shrink-0" />
                  <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                    Centre de gestion du consentement
                  </h2>
                </div>
                <span className="font-mono text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Statut actuel :{' '}
                  {consent?.choice === 'accepted'
                    ? 'Tout accepté (annonces personnalisées autorisées)'
                    : consent?.choice === 'essential_only'
                    ? 'Essentiels uniquement (annonces non personnalisées)'
                    : 'Non défini'}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Choisissez si vous autorisez les cookies publicitaires pour des annonces personnalisées Google AdSense ou si vous préférez limiter le stockage aux éléments strictement nécessaires au fonctionnement du site (avec diffusion d’annonces non personnalisées).
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCookieChoice('accepted')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    consent?.choice === 'accepted'
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'bg-brand-red hover:bg-brand-redHover text-white'
                  }`}
                >
                  Accepter les cookies et annonces personnalisées
                </button>
                <button
                  type="button"
                  onClick={() => handleCookieChoice('essential_only')}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                    consent?.choice === 'essential_only'
                      ? 'border-brand-red text-brand-red bg-red-50/70 dark:bg-red-950/30'
                      : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  Essentiels uniquement (annonces non personnalisées)
                </button>
                {consent && (
                  <button
                    type="button"
                    onClick={handleResetConsent}
                    className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline underline-offset-4 whitespace-nowrap cursor-pointer"
                  >
                    Réinitialiser mon choix
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                Catégories de cookies et stockages utilisés
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400">
                      <th className="py-2.5 pr-4 font-semibold">Catégorie / Nom</th>
                      <th className="py-2.5 pr-4 font-semibold">Fournisseur</th>
                      <th className="py-2.5 font-semibold">Finalité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                    <tr>
                      <td className="py-3 pr-4 font-mono text-xs">
                        pdfexpress-theme, pdfexpress_cookie_consent
                      </td>
                      <td className="py-3 pr-4">PDFExpress (1re partie)</td>
                      <td className="py-3">
                        Mémorisation du thème clair/sombre, de la langue et de votre choix de consentement.
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-mono text-xs">
                        pdfexpress_ad_free, pdfexpress-recent-files
                      </td>
                      <td className="py-3 pr-4">PDFExpress (1re partie)</td>
                      <td className="py-3">
                        Activation du mode sans publicité pour les comptes Premium et raccourci local vers vos derniers fichiers ou signature.
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-4 font-mono text-xs">
                        __gads, __gpi, IDE, NID (Google AdSense)
                      </td>
                      <td className="py-3 pr-4">Google / DoubleClick</td>
                      <td className="py-3">
                        Diffusion, limitation de fréquence, prévention de la fraude aux clics et mesure d’audience publicitaire via{' '}
                        <span className="font-mono text-xs">pagead2.googlesyndication.com</span>.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold text-neutral-900 dark:text-white">
                Contrôle depuis votre navigateur
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                Vous pouvez à tout moment bloquer ou supprimer les cookies depuis les paramètres de Chrome, Firefox, Safari ou Edge, ou gérer la personnalisation Google via{' '}
                <a
                  href="https://adssettings.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-red font-semibold underline underline-offset-4 inline-flex items-center gap-1"
                >
                  <span>Google Ads Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                .
              </p>
            </section>
          </>
        )}

        {page === 'security' && (
          <>
            {renderSectionHeading(
              'Sécurité & Chiffrement',
              'Sécurité des données sur PDFExpress',
              'Protection technique et organisationnelle appliquée à vos documents, connexions et comptes sur pdfexpress.ai.studio.'
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: Lock,
                  title: 'Exécution locale en mémoire vive',
                  body: 'Les outils de manipulation binaire (fusion, division, compression, filigrane, signature, rotation, formulaires) traitent vos octets directement dans le sandbox du navigateur sans téléversement.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Chiffrement HTTPS / TLS permanent',
                  body: 'Toutes les communications entre votre appareil, notre hébergement Cloud Run, Firebase Authentication et les endpoints d’IA sont chiffrées de bout en bout via TLS.',
                },
                {
                  icon: FileText,
                  title: 'Censure irréversible & mots de passe',
                  body: 'L’outil Censurer PDF applique un masquage opaque destructif sur le rendu de page et l’outil Protéger PDF chiffre l’ouverture de vos documents.',
                },
                {
                  icon: Mail,
                  title: 'Signalement de vulnérabilité',
                  body: `Si vous identifiez un problème de sécurité ou une anomalie sur ${PUBLISHER_DOMAIN}, contactez-nous immédiatement à ${CONTACT_EMAIL}.`,
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-2"
                >
                  <div className="flex items-center gap-2.5 text-neutral-900 dark:text-white font-bold text-base">
                    <card.icon className="w-4 h-4 text-brand-red shrink-0" />
                    <span>{card.title}</span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'accessibility' && (
          <>
            {renderSectionHeading(
              'Accessibilité numérique',
              'Déclaration d’accessibilité (WCAG 2.1 AA)',
              'PDFExpress s’engage à rendre l’édition et la conversion de documents PDF utilisables par le plus grand nombre, y compris via clavier et lecteurs d’écran.'
            )}

            <ul className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
              {[
                'Contraste typographique conforme aux seuils WCAG AA en thème clair et en thème sombre.',
                'Navigation complète au clavier avec états de focus visibles sur les boutons, onglets, formulaires et menus.',
                'Raccourcis clavier pratiques (Ctrl+K pour rechercher un outil) et libellés ARIA explicites sur les dialogues et panneaux.',
                'Cibles tactiles dimensionnées pour une utilisation confortable sur mobile (minimum 40 à 44 px) et support du mode mouvement réduit.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              Si vous rencontrez une difficulté d’accès à un outil ou un contenu, écrivez-nous à{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-neutral-900 dark:text-white underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              ou via notre{' '}
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateRoute('/contact');
                }}
                className="font-semibold text-brand-red underline underline-offset-4"
              >
                page Contact
              </a>
              .
            </p>
          </>
        )}

        {page === 'legal' && (
          <>
            {renderSectionHeading(
              'Mentions légales',
              'Mentions légales & Conformité éditoriale',
              'Informations légales officielles relatives à l’éditeur, l’hébergement et la conformité publicitaire de PDFExpress.'
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-neutral-700 dark:text-neutral-300">
              <div className="space-y-2">
                <h2 className="font-display text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand-red shrink-0" />
                  <span>Éditeur du service</span>
                </h2>
                <p>
                  <strong>Nom du service :</strong> PDFExpress
                </p>
                <p>
                  <strong>Domaine officiel :</strong> https://{PUBLISHER_DOMAIN}
                </p>
                <p>
                  <strong>Directeur de publication :</strong> Redouane Laghrib
                </p>
                <p>
                  <strong>Contact :</strong>{' '}
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="underline underline-offset-4"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-base font-bold text-neutral-900 dark:text-white">
                  Hébergement &amp; Régie publicitaire
                </h2>
                <p>
                  <strong>Infrastructure :</strong> Google Cloud Run (Europe West) &amp; Firebase Hosting / Firestore.
                </p>
                <p>
                  <strong>Monétisation :</strong> Google AdSense ({ADSENSE_PUB_ID}), avec fichier d’autorisation vendeur publié sur{' '}
                  <a
                    href="/ads.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs underline underline-offset-4"
                  >
                    /ads.txt
                  </a>
                  .
                </p>
                <p>
                  <strong>Indexation :</strong>{' '}
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs underline underline-offset-4"
                  >
                    /sitemap.xml
                  </a>{' '}
                  et{' '}
                  <a
                    href="/robots.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs underline underline-offset-4"
                  >
                    /robots.txt
                  </a>
                  .
                </p>
              </div>
            </div>
          </>
        )}

        {page === 'sitemap' && (
          <>
            {renderSectionHeading(
              'Navigation complète',
              'Plan du site PDFExpress',
              'Accès direct et structuré à toutes les pages éditoriales, légales et à l’ensemble des 34 outils PDF de PDFExpress.'
            )}

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-brand-red shrink-0" />
                <span>Pages institutionnelles &amp; légales</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                {[
                  { label: 'Accueil — Suite PDFExpress', href: '/', onClick: onBackHome },
                  {
                    label: 'Tarifs & Offre Premium',
                    href: '/tarifs',
                    onClick: () => onNavigateRoute('/tarifs'),
                  },
                  {
                    label: 'À propos de PDFExpress',
                    href: '/about',
                    onClick: () => onNavigateRoute('/about'),
                  },
                  {
                    label: 'Foire aux questions (FAQ)',
                    href: '/faq',
                    onClick: () => onNavigateRoute('/faq'),
                  },
                  {
                    label: 'Contact & Support',
                    href: '/contact',
                    onClick: () => onNavigateRoute('/contact'),
                  },
                  ...LEGAL_NAV_ITEMS.filter((i) => i.id !== 'sitemap').map((item) => ({
                    label: item.label,
                    href: item.href,
                    onClick: () => onNavigateLegal(item.id),
                  })),
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      link.onClick();
                    }}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-brand-red text-neutral-800 dark:text-neutral-200 font-semibold transition-colors"
                  >
                    <span className="truncate">{link.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  </a>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                Tous les outils PDF par catégorie ({TOOLS.length} outils)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CATEGORIES.filter((c) => c.id !== 'all').map((category) => {
                  const categoryTools = TOOLS.filter((tool) => {
                    if (category.id === 'convertir') {
                      return (
                        tool.cat === 'convertir_en' ||
                        tool.cat === 'convertir_depuis'
                      );
                    }
                    return tool.cat === category.id;
                  });
                  if (categoryTools.length === 0) return null;

                  return (
                    <div
                      key={category.id}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3"
                    >
                      <h3 className="font-display text-sm font-extrabold text-neutral-900 dark:text-white">
                        {category.label} ({categoryTools.length})
                      </h3>
                      <ul className="space-y-2 text-xs">
                        {categoryTools.map((tool) => (
                          <li key={tool.id}>
                            <a
                              href={`/?tool=${encodeURIComponent(tool.id)}`}
                              onClick={(e) => {
                                e.preventDefault();
                                onSelectTool(tool.id);
                              }}
                              className="group flex items-baseline justify-between gap-2 text-neutral-700 dark:text-neutral-300 hover:text-brand-red transition-colors"
                            >
                              <span className="font-semibold">{tool.title}</span>
                              <span className="text-[11px] text-neutral-400 group-hover:text-brand-red shrink-0">
                                Ouvrir
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </article>
    </main>
  );
}
