const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'tempail.com',
  '10minutemail.com',
  '10minutemail.net',
  '10minmail.com',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.de',
  'sharklasers.com',
  'grr.la',
  'pokemail.net',
  'spam4.me',
  'mailinator.com',
  'mailinator.net',
  'mailinator2.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'trash-mail.com',
  'getnada.com',
  'nada.email',
  'dispostable.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'mohmal.com',
  'emailondeck.com',
  'mintemail.com',
  'mytemp.email',
  'burnermail.io',
  'tempr.email',
  'discard.email',
  'dropmail.me',
  'harakirimail.com',
  'mailnesia.com',
  'spamgourmet.com',
  'crazymailing.com',
  'mailcatch.com',
  'inboxbear.com',
  'anonbox.net',
  'moakt.com',
  'tmail.ws',
  'tmailor.com',
]);

export function extractEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) {
      return true;
    }
  }
  return false;
}

export function assertNonDisposableEmail(email: string): void {
  if (isDisposableEmail(email)) {
    throw new Error(
      "Les adresses e-mail temporaires ou jetables (ex. yopmail, temp-mail, 10minutemail) ne sont pas autorisées. Utilisez une adresse e-mail permanente."
    );
  }
}
