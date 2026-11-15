import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';

interface ContactViewProps {
  onBackHome: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function ContactView({ onBackHome, onNotify }: ContactViewProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      onNotify('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      onNotify('Message envoyé avec succès ! Nous vous répondrons sous 24h.', 'success');
    }, 800);
  };

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
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

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-brand-red text-xs font-extrabold uppercase tracking-wider mb-3">
          <Mail className="w-3.5 h-3.5" />
          <span>Contactez-nous</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-3">
          Nous sommes à votre écoute
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300">
          Une question sur un outil, une suggestion ou un besoin entreprise ? Remplissez le formulaire ci-dessous.
        </p>
      </div>

      <div className="bg-white dark:bg-brand-cardDark rounded-3xl border border-neutral-200 dark:border-brand-borderDark shadow-xl p-6 sm:p-10">
        {isSubmitted ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Message bien envoyé !
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
              Merci pour votre message. Notre équipe support vous répondra dans les plus brefs délais (généralement sous 24h).
            </p>
            <div className="pt-6">
              <button
                type="button"
                onClick={onBackHome}
                className="px-6 py-3 rounded-xl bg-brand-red text-white font-bold text-sm hover:bg-red-700 transition-colors shadow-md"
              >
                Retour à l’accueil
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-2">
                  Votre nom <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Redouane Laghrib"
                  className="w-full h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-2">
                  Votre e-mail <span className="text-brand-red">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@domaine.com"
                  className="w-full h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-2">
                Sujet de votre demande
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Question sur l’offre entreprise ou un outil PDF"
                className="w-full h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-neutral-700 dark:text-neutral-300 mb-2">
                Votre message <span className="text-brand-red">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre besoin ou votre question en détail..."
                className="w-full p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-red resize-y"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={onBackHome}
                className="px-6 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Retour à l’accueil
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3.5 rounded-xl bg-brand-red hover:bg-red-700 text-white font-extrabold text-sm inline-flex items-center gap-2 transition-colors shadow-lg disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Envoi en cours...' : 'Envoyer le message'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
