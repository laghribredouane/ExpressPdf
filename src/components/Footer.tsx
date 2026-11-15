import { ArrowUpRight, Globe, Heart, Laptop, Smartphone } from 'lucide-react';
import {
  FOOTER_COLUMNS,
  FOOTER_POPULAR_TOOLS,
  FOOTER_QUICK_CATEGORIES,
  STORE_PLATFORMS,
  type FooterAction,
} from '../data/siteLinks';
import type { CategoryId, ToolId } from '../types/pdf';

interface FooterProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  onGoHome: () => void;
  onSelectTool: (id: ToolId) => void;
  onSelectCategory: (cat: CategoryId) => void;
  onNavigateSection: (sectionId: string) => void;
  onOpenInfoPage: (pageId: string) => void;
  onOpenPremium: () => void;
  onOpenPricing?: () => void;
  onOpenDocs?: () => void;
  onOpenAdSenseTester?: () => void;
}

export function Footer({
  language,
  onLanguageChange,
  onGoHome,
  onSelectTool,
  onSelectCategory,
  onNavigateSection,
  onOpenInfoPage,
  onOpenPremium,
  onOpenPricing,
  onOpenDocs,
  onOpenAdSenseTester,
}: FooterProps) {
  const handleAction = (action: FooterAction) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (action.type === 'home') {
      onGoHome();
    } else if (action.type === 'tool') {
      onSelectTool(action.toolId);
    } else if (action.type === 'category') {
      onSelectCategory(action.categoryId);
    } else if (action.type === 'info') {
      onOpenInfoPage(action.pageId);
    } else if (action.type === 'scroll') {
      onNavigateSection(action.elementId);
    } else if (action.type === 'premium') {
      onOpenPremium();
    } else if (action.type === 'pricing') {
      onOpenPricing?.();
    }
  };

  return (
    <footer className="bg-neutral-900 dark:bg-neutral-950 text-neutral-300 border-t border-neutral-800 pt-14 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Identité & accès rapide aux sections et catégories du SPA */}
        <div className="pb-10 mb-10 border-b border-neutral-800 flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <div className="max-w-sm">
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-1.5 font-display text-xl font-extrabold tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              <span>PDF</span>
              <Heart
                className="w-5 h-5 fill-brand-red text-brand-red shrink-0"
                aria-hidden="true"
              />
              <span>Express</span>
            </button>
            <p className="mt-3 text-xs text-neutral-400 leading-relaxed">
              Suite complète de 34 outils PDF dans votre navigateur : organisation, compression, conversion, formulaires, signature électronique et intelligence documentaire.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {[
                { label: 'Catalogue', sectionId: 'tools-catalog' },
                { label: 'Travaillez à votre façon', sectionId: 'work-your-way' },
                { label: 'Premium', sectionId: 'premium-section' },
                { label: 'Images', sectionId: 'image-editing' },
                { label: 'Sécurité', sectionId: 'trust-security' },
              ].map((sec) => (
                <button
                  key={sec.sectionId}
                  type="button"
                  onClick={() => onNavigateSection(sec.sectionId)}
                  className="text-neutral-300 hover:text-white underline underline-offset-4 decoration-neutral-700 hover:decoration-brand-red transition-colors"
                >
                  {sec.label}
                </button>
              ))}
              {onOpenDocs && (
                <button
                  type="button"
                  onClick={onOpenDocs}
                  className="text-brand-red hover:text-red-400 font-bold underline underline-offset-4 transition-colors"
                >
                  📚 Documentation des 34 outils
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-grow lg:max-w-2xl">
            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 mb-3">
                Catégories du catalogue
              </h3>
              <div className="flex flex-wrap gap-x-3.5 gap-y-2 text-xs">
                {FOOTER_QUICK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.categoryId}
                    type="button"
                    onClick={() => onSelectCategory(cat.categoryId)}
                    className="text-neutral-300 hover:text-white hover:underline underline-offset-4 transition-colors text-left"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 mb-3">
                Accès direct aux outils phares
              </h3>
              <div className="flex flex-wrap gap-x-3.5 gap-y-2 text-xs">
                {FOOTER_POPULAR_TOOLS.map((item) => (
                  <button
                    key={item.toolId}
                    type="button"
                    onClick={() => onSelectTool(item.toolId)}
                    className="inline-flex items-center gap-0.5 text-neutral-300 hover:text-white hover:underline underline-offset-4 transition-colors text-left"
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight className="w-3 h-3 text-neutral-500" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5 colonnes de liens & pages d'information */}
        <nav
          aria-label="Navigation de pied de page"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 pb-10 border-b border-neutral-800"
        >
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">
                {col.heading}
              </h3>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((link) => {
                  const infoHrefMap: Record<string, string> = {
                    about: '/about',
                    contact: '/contact',
                    faq: '/faq',
                    privacy: '/confidentialite',
                    terms: '/conditions',
                    cookies: '/cookies',
                    security: '/securite',
                    accessibility: '/accessibilite',
                    sitemap: '/plan-du-site',
                    legal_compliance: '/mentions-legales',
                  };
                  const href =
                    link.action.type === 'info'
                      ? infoHrefMap[link.action.pageId]
                      : link.action.type === 'pricing'
                      ? '/tarifs'
                      : link.action.type === 'home'
                      ? '/'
                      : link.action.type === 'tool'
                      ? `/?tool=${encodeURIComponent(link.action.toolId)}`
                      : undefined;

                  return (
                    <li key={link.label}>
                      {href ? (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            handleAction(link.action);
                          }}
                          className="text-neutral-400 hover:text-white transition-colors duration-200 text-left inline-block"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAction(link.action)}
                          className="text-neutral-400 hover:text-white transition-colors duration-200 text-left cursor-pointer"
                        >
                          {link.label}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Plateformes & Applications + Langue */}
        <div className="py-8 border-b border-neutral-800 flex flex-wrap items-center justify-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {STORE_PLATFORMS.map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => onOpenInfoPage(store.pageId)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-left flex items-center gap-2.5 transition-colors"
              >
                {store.pageId === 'mobile' ? (
                  <Smartphone className="w-4 h-4 text-neutral-300 shrink-0" />
                ) : (
                  <Laptop className="w-4 h-4 text-neutral-300 shrink-0" />
                )}
                <div>
                  <span className="block text-[10px] text-neutral-400 leading-none">
                    {store.sub}
                  </span>
                  <span className="block text-xs font-bold text-white mt-0.5">
                    {store.label}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Sélecteur de langue */}
          <div className="flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 min-h-[44px]">
            <Globe className="w-4 h-4 text-neutral-400" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              aria-label="Choisir la langue"
              className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer"
            >
              <option value="fr" className="bg-neutral-900">
                Français (FR)
              </option>
              <option value="en" className="bg-neutral-900">
                English (EN)
              </option>
              <option value="ar" className="bg-neutral-900">
                العربية (AR)
              </option>
            </select>
          </div>
        </div>

        {/* Barre inférieure : Copyright, Liens juridiques directs & Réseaux */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1.5">
            <p>© PDFExpress 2026 — Votre éditeur PDF complet dans le navigateur</p>
            <span className="hidden sm:inline text-neutral-700" aria-hidden="true">
              |
            </span>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                { label: 'Confidentialité', pageId: 'privacy', href: '/confidentialite' },
                { label: 'Conditions', pageId: 'terms', href: '/conditions' },
                { label: 'Cookies', pageId: 'cookies', href: '/cookies' },
                { label: 'Sécurité', pageId: 'security', href: '/securite' },
                { label: 'Accessibilité', pageId: 'accessibility', href: '/accessibilite' },
                { label: 'Mentions légales', pageId: 'legal_compliance', href: '/mentions-legales' },
                { label: 'Plan du site', pageId: 'sitemap', href: '/plan-du-site' },
              ].map((legal) => (
                <a
                  key={legal.pageId}
                  href={legal.href}
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    onOpenInfoPage(legal.pageId);
                  }}
                  className="hover:text-white transition-colors"
                >
                  {legal.label}
                </a>
              ))}
              {onOpenAdSenseTester && (
                <button
                  type="button"
                  onClick={onOpenAdSenseTester}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Test AdSense
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {[
              { label: 'À propos', pageId: 'about', href: '/about' },
              { label: 'FAQ', pageId: 'faq', href: '/faq' },
              { label: 'Blog', pageId: 'blog', href: undefined },
              { label: 'API', pageId: 'api', href: undefined },
              { label: 'Contact', pageId: 'contact', href: '/contact' },
            ].map((soc) =>
              soc.href ? (
                <a
                  key={soc.label}
                  href={soc.href}
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    onOpenInfoPage(soc.pageId);
                  }}
                  className="hover:text-white transition-colors font-medium"
                >
                  {soc.label}
                </a>
              ) : (
                <button
                  key={soc.label}
                  type="button"
                  onClick={() => onOpenInfoPage(soc.pageId)}
                  className="hover:text-white transition-colors font-medium cursor-pointer"
                >
                  {soc.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
