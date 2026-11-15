import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, HelpCircle } from 'lucide-react';

interface FaqViewProps {
  onBackHome: () => void;
}

export function FaqView({ onBackHome }: FaqViewProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Mes documents PDF sont-ils envoyés sur un serveur distant ?',
      a: 'Non, absolument pas. PDFExpress utilise des technologies de traitement local directement dans votre navigateur (via JavaScript et WebAssembly). Vos documents confidentiels ne quittent jamais votre appareil.',
    },
    {
      q: 'Puis-je utiliser PDFExpress hors connexion (sans Internet) ?',
      a: 'Oui ! PDFExpress est une Progressive Web App (PWA). Une fois la page chargée ou installée sur votre bureau/mobile, vous pouvez manipuler, fusionner et compresser vos fichiers hors connexion.',
    },
    {
      q: 'Comment fonctionne la mémorisation de la signature électronique ?',
      a: 'Lorsque vous créez ou dessinez votre signature dans l’outil "Signer PDF", celle-ci est enregistrée localement dans le stockage de votre navigateur (localStorage). Elle reste disponible instantanément pour vos futurs documents.',
    },
    {
      q: 'Y a-t-il une limite de taille pour les fichiers importés ?',
      a: 'En mode gratuit, la taille maximale recommandée est de 200 Mo par fichier. Le plan Premium permet de traiter des lots volumineux sans aucune restriction.',
    },
    {
      q: 'Comment fonctionne l’essai gratuit de 7 jours ?',
      a: 'En créant un compte et en confirmant votre adresse e-mail, vous bénéficiez immédiatement de 7 jours d’accès complet à toutes les fonctionnalités avancées (OCR par IA, conversion PDF/A, requêtes illimitées).',
    },
    {
      q: 'Quels formats de fichiers sont pris en charge pour la conversion ?',
      a: 'PDFExpress convertit vos fichiers PDF en Word (.docx), PowerPoint (.pptx), Excel/CSV, images JPG, Markdown (.md) et inversement (JPG, PNG, WebP, DOCX, XLSX, HTML vers PDF).',
    },
  ];

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      <div className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l’accueil</span>
        </button>
      </div>

      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 text-xs font-extrabold uppercase tracking-wider mb-3">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Foire Aux Questions</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-4">
          Tout ce que vous devez savoir
        </h1>
        <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
          Trouvez rapidement des réponses claires sur la sécurité, le fonctionnement local et l’utilisation de PDFExpress.
        </p>
      </div>

      {/* Modern Dark Design Accordion */}
      <div className="space-y-4 mb-12">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark shadow-sm overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-bold text-neutral-900 dark:text-white hover:text-brand-red dark:hover:text-brand-red transition-colors"
              >
                <span className="text-base sm:text-lg">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-neutral-400 transition-transform duration-200 shrink-0 ${
                    isOpen ? 'rotate-180 text-brand-red' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-6 pt-1 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed border-t border-neutral-100 dark:border-neutral-800">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center pt-4">
        <button
          type="button"
          onClick={onBackHome}
          className="px-8 py-3.5 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-extrabold text-sm hover:bg-brand-red dark:hover:bg-brand-red dark:hover:text-white transition-colors shadow-lg"
        >
          Retour à l’accueil
        </button>
      </div>
    </main>
  );
}
