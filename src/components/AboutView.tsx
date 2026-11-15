import { useEffect } from 'react';
import { ArrowLeft, Award, Cpu, Heart, ShieldCheck, Users } from 'lucide-react';

interface AboutViewProps {
  onBackHome: () => void;
}

export function AboutView({ onBackHome }: AboutViewProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const teamMembers = [
    {
      name: 'Redouane Laghrib',
      role: 'Fondateur & Lead Architect',
      desc: 'Expert en architectures web et traitement binaire haute performance.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    },
    {
      name: 'Sarah Benali',
      role: 'Lead Front-End Engineer',
      desc: 'Spécialiste UI/UX et interfaces réactives fluides sous React & Tailwind.',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    },
    {
      name: 'Yassine Alami',
      role: 'Spécialiste Moteur PDF & IA',
      desc: 'Ingénieur en traitement documentaire et intégration des modèles d’intelligence artificielle.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    },
  ];

  const technologies = [
    { name: 'React & TypeScript', desc: 'Interface modulaire typée pour une robustesse maximale et une maintenance aisée.' },
    { name: 'pdf-lib & PDF.js', desc: 'Manipulation binaire directe et rendu haute résolution dans le navigateur.' },
    { name: 'Tailwind CSS', desc: 'Design system moderne, responsive et adapté au mode sombre.' },
    { name: 'Web Crypto & Local Storage', desc: 'Sécurité et chiffrement garantis sans téléversement sur des serveurs distants.' },
  ];

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
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

      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-brand-red text-xs font-extrabold uppercase tracking-wider mb-4">
          <Heart className="w-3.5 h-3.5 fill-brand-red" />
          <span>Notre Mission</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-6">
          Rendre les outils PDF simples, rapides et 100% sécurisés
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
          PDFExpress est né d’un constat simple : éditer, fusionner, convertir ou signer un document PDF ne devrait jamais nécessiter l’installation de logiciels lourds ni le transfert de données confidentielles sur des serveurs tiers inconnus.
        </p>
      </div>

      {/* Mission Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/50 text-brand-red flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
            Confidentialité Totale
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Vos documents sont traités directement dans la mémoire vive de votre navigateur. Vos données financières et juridiques ne quittent jamais votre poste.
          </p>
        </div>

        <div className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
            Performance Native
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Grâce aux technologies WebAssembly et JavaScript modernes, les opérations de fusion et compression s’exécutent en une fraction de seconde.
          </p>
        </div>

        <div className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
            Simplicité Universelle
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Une interface intuitive et responsive accessible sur ordinateur, tablette et smartphone pour tous vos besoins professionnels.
          </p>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-neutral-200 dark:border-brand-borderDark p-8 mb-16">
        <h2 className="text-2xl font-extrabold text-neutral-900 dark:text-white mb-6 text-center">
          Technologie & Architecture
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {technologies.map((tech) => (
            <div key={tech.name} className="bg-white dark:bg-brand-cardDark rounded-2xl p-5 border border-neutral-200 dark:border-brand-borderDark">
              <h4 className="text-base font-bold text-neutral-900 dark:text-white mb-1.5">
                {tech.name}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {tech.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Section */}
      <div className="mb-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-extrabold uppercase tracking-wider mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>L’équipe</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
            Rencontrez les fondateurs & ingénieurs
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <div key={member.name} className="bg-white dark:bg-brand-cardDark rounded-2xl border border-neutral-200 dark:border-brand-borderDark p-6 text-center flex flex-col items-center">
              <img
                src={member.avatar}
                alt={member.name}
                className="w-24 h-24 rounded-full object-cover mb-4 ring-4 ring-neutral-100 dark:ring-neutral-800 shadow-md"
              />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                {member.name}
              </h3>
              <p className="text-xs font-bold text-brand-red mb-3">
                {member.role}
              </p>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {member.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-6">
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
