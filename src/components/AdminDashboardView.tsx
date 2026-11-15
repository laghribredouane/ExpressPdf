import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Crown,
  Laptop,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  adminActivateUserPremium,
  adminBanDevice,
  adminReviewPremiumRequest,
  adminSetUserStatus,
  adminUnbanDevice,
  fetchAdminDashboardData,
  type AdminDashboardSnapshot,
} from '../services/saasService';
import type { SubscriptionStatus } from '../types/pdf';
import { AdSenseDiagnosticPanel } from './AdSenseDiagnosticPanel';

interface AdminDashboardViewProps {
  isAdmin: boolean;
  adminUid: string | null;
  onBackHome: () => void;
  onNotify: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type AdminTab = 'requests' | 'users' | 'devices' | 'adsense';

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const styles: Record<SubscriptionStatus, string> = {
    free: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    trial_active:
      'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
    premium_active:
      'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    expired:
      'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
    suspended: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300',
  };
  const labels: Record<SubscriptionStatus, string> = {
    free: 'Gratuit',
    trial_active: 'Essai 7j',
    premium_active: 'Premium Actif',
    expired: 'Expiré',
    suspended: 'Suspendu',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function AdminDashboardView({
  isAdmin,
  adminUid,
  onBackHome,
  onNotify,
}: AdminDashboardViewProps) {
  const [tab, setTab] = useState<AdminTab>('requests');
  const [data, setData] = useState<AdminDashboardSnapshot>({
    users: [],
    devices: [],
    requests: [],
    bannedDevices: [],
  });
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>(
    'all'
  );

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const snapshot = await fetchAdminDashboardData();
      setData(snapshot);
    } catch (err) {
      console.error(err);
      onNotify('Impossible de charger les données administrateur.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, onNotify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Détection multi-comptes par empreinte appareil
  const accountsByFingerprint = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const u of data.users) {
      if (u.lastDeviceFingerprint) {
        if (!map.has(u.lastDeviceFingerprint)) {
          map.set(u.lastDeviceFingerprint, new Set());
        }
        map.get(u.lastDeviceFingerprint)!.add(u.uid);
      }
    }
    for (const d of data.devices) {
      if (d.deviceFingerprint) {
        if (!map.has(d.deviceFingerprint)) {
          map.set(d.deviceFingerprint, new Set());
        }
        map.get(d.deviceFingerprint)!.add(d.userId);
      }
    }
    return map;
  }, [data.users, data.devices]);

  const bannedSet = useMemo(
    () => new Set(data.bannedDevices.map((b) => b.deviceFingerprint)),
    [data.bannedDevices]
  );

  const userEmailByUid = useMemo(() => {
    const map = new Map<string, string>();
    data.users.forEach((u) => map.set(u.uid, u.email));
    return map;
  }, [data.users]);

  const stats = useMemo(() => {
    const pendingReqs = data.requests.filter((r) => r.status === 'pending').length;
    const trialActive = data.users.filter(
      (u) => u.subscriptionStatus === 'trial_active'
    ).length;
    const premiumActive = data.users.filter(
      (u) => u.subscriptionStatus === 'premium_active'
    ).length;
    let multiAccountDevices = 0;
    accountsByFingerprint.forEach((set) => {
      if (set.size > 1) multiAccountDevices += 1;
    });
    return {
      totalUsers: data.users.length,
      trialActive,
      premiumActive,
      pendingReqs,
      multiAccountDevices,
    };
  }, [data.users, data.requests, accountsByFingerprint]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.users.filter((u) => {
      if (statusFilter !== 'all' && u.subscriptionStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q) ||
        (u.lastDeviceFingerprint || '').toLowerCase().includes(q)
      );
    });
  }, [data.users, searchTerm, statusFilter]);

  const filteredDevices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.devices.filter((d) => {
      if (!q) return true;
      const email = (userEmailByUid.get(d.userId) || '').toLowerCase();
      return (
        d.deviceFingerprint.toLowerCase().includes(q) ||
        d.lastIp.toLowerCase().includes(q) ||
        d.os.toLowerCase().includes(q) ||
        d.browser.toLowerCase().includes(q) ||
        email.includes(q)
      );
    });
  }, [data.devices, searchTerm, userEmailByUid]);

  if (!isAdmin || !adminUid) {
    return (
      <main className="flex-grow max-w-2xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/50 text-brand-red flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-neutral-900 dark:text-white">
          Accès Administrateur Restreint
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Cette section est réservée exclusivement au compte administrateur vérifié.
        </p>
        <button
          type="button"
          onClick={onBackHome}
          className="px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-extrabold inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l’accueil</span>
        </button>
      </main>
    );
  }

  const handleActivateUser = async (
    uid: string,
    days: number | null,
    label: string
  ) => {
    setBusyKey(`u_${uid}`);
    try {
      await adminActivateUserPremium(uid, days, `Activation manuelle (${label})`);
      onNotify(`Accès Premium (${label}) activé avec succès !`, 'success');
      await loadData();
    } catch {
      onNotify("Erreur lors de l'activation Premium.", 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const handleSetStatus = async (
    uid: string,
    status: SubscriptionStatus,
    label: string
  ) => {
    setBusyKey(`u_${uid}`);
    try {
      await adminSetUserStatus(uid, status, `Statut modifié : ${label}`);
      onNotify(`Compte mis à jour (${label}).`, 'info');
      await loadData();
    } catch {
      onNotify('Erreur lors de la mise à jour du statut.', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const handleReviewRequest = async (
    requestId: string,
    targetUserId: string,
    decision: 'approved' | 'rejected',
    durationDays: number | null
  ) => {
    setBusyKey(`r_${requestId}`);
    try {
      await adminReviewPremiumRequest({
        requestId,
        targetUserId,
        decision,
        durationDays,
        reviewerUid: adminUid,
      });
      onNotify(
        decision === 'approved'
          ? 'Demande approuvée et accès Premium activé !'
          : 'Demande marquée comme refusée.',
        decision === 'approved' ? 'success' : 'info'
      );
      await loadData();
    } catch {
      onNotify('Erreur lors du traitement de la demande.', 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleBan = async (fp: string) => {
    setBusyKey(`d_${fp}`);
    try {
      if (bannedSet.has(fp)) {
        await adminUnbanDevice(fp);
        onNotify(`Appareil ${fp.slice(0, 12)}... débanni.`, 'info');
      } else {
        await adminBanDevice(
          fp,
          'Multi-comptes / Abus détecté par administrateur',
          adminUid
        );
        onNotify(`Appareil ${fp.slice(0, 12)}... banni.`, 'success');
      }
      await loadData();
    } catch {
      onNotify("Impossible de modifier le bannissement de l'appareil.", 'error');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="flex-grow w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-brand-red"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à PDFExpress</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-brand-red shrink-0" />
            <span>Tableau de Bord Administrateur SaaS</span>
          </h1>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void loadData()}
          className="min-h-[44px] px-4 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-extrabold inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          {
            label: 'Utilisateurs',
            value: stats.totalUsers,
            icon: Users,
            accent: 'text-neutral-800 dark:text-white',
          },
          {
            label: 'Essais 7j actifs',
            value: stats.trialActive,
            icon: Clock,
            accent: 'text-sky-600 dark:text-sky-400',
          },
          {
            label: 'Premium actifs',
            value: stats.premiumActive,
            icon: Crown,
            accent: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Demandes en attente',
            value: stats.pendingReqs,
            icon: ShieldCheck,
            accent: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Appareils multi-comptes',
            value: stats.multiAccountDevices,
            icon: AlertTriangle,
            accent: 'text-brand-red',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-4"
          >
            <div className="flex items-center justify-between text-neutral-400 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon className="w-4 h-4" />
            </div>
            <p className={`text-2xl font-extrabold tabular-nums ${card.accent}`}>
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {/* Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex overflow-x-auto no-scrollbar rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1 max-w-full">
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              tab === 'requests'
                ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Demandes Premium ({stats.pendingReqs})
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              tab === 'users'
                ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Utilisateurs ({data.users.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('devices')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              tab === 'devices'
                ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Appareils &amp; Anti-Abus ({data.devices.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('adsense')}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
              tab === 'adsense'
                ? 'bg-white dark:bg-neutral-900 text-brand-red shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300'
            }`}
          >
            Liaison AdSense
          </button>
        </div>

        {(tab === 'users' || tab === 'devices') && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher e-mail, nom, FP, IP..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark text-xs outline-none focus:border-brand-red"
              />
            </div>

            {tab === 'users' && (
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | SubscriptionStatus)
                }
                aria-label="Filtrer par statut"
                className="px-3 py-2 rounded-xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark text-xs font-bold outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="free">Gratuit</option>
                <option value="trial_active">Essai 7j</option>
                <option value="premium_active">Premium actif</option>
                <option value="expired">Expiré</option>
                <option value="suspended">Suspendu</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Tab 1: Demandes Premium */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {data.requests.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-8 text-center text-sm text-neutral-500">
              Aucune demande d’activation Premium reçue pour le moment.
            </div>
          ) : (
            data.requests.map((req) => {
              const busy = busyKey === `r_${req.id}`;
              return (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
                        {req.reference}
                      </span>
                      <span className="text-sm font-extrabold text-neutral-900 dark:text-white">
                        {req.planLabel} ({req.cycle === 'annual' ? 'Annuel' : 'Mensuel'}) —{' '}
                        <span className="text-brand-red">{req.formattedAmount}</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : req.status === 'rejected'
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {req.status === 'approved'
                          ? 'Approuvée'
                          : req.status === 'rejected'
                          ? 'Refusée'
                          : 'En attente'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300">
                      Client : <strong>{req.payerName}</strong> ({req.payerEmail}) · Banque :{' '}
                      <strong>{req.bankOrigin || 'Non précisée'}</strong> · Date virement :{' '}
                      <strong>{req.transferDate}</strong>
                    </p>
                    {req.note && (
                      <p className="text-[11px] text-neutral-500">Note : {req.note}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {[
                      { label: '+30 jours', days: 30 },
                      { label: '+90 jours', days: 90 },
                      { label: '+365 jours', days: 365 },
                      { label: 'Illimité', days: null },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleReviewRequest(
                            req.id,
                            req.userId,
                            'approved',
                            opt.days
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                    {req.status === 'pending' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleReviewRequest(req.id, req.userId, 'rejected', 0)
                        }
                        className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-brand-red hover:bg-red-100 text-[11px] font-bold disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Tableau des Utilisateurs (encapsulé dans overflow-x-auto) */}
      {tab === 'users' && (
        <div className="w-full overflow-x-auto rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-brand-borderDark bg-neutral-50/80 dark:bg-neutral-900/50 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                <th className="py-3.5 px-4">Utilisateur</th>
                <th className="py-3.5 px-3">E-mail</th>
                <th className="py-3.5 px-3">Statut</th>
                <th className="py-3.5 px-3">Expiration</th>
                <th className="py-3.5 px-3">Empreinte Appareil</th>
                <th className="py-3.5 px-4 text-right">Actions rapides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-neutral-500">
                    Aucun utilisateur trouvé pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const busy = busyKey === `u_${u.uid}`;
                  const fp = u.lastDeviceFingerprint;
                  const sharedCount = fp
                    ? accountsByFingerprint.get(fp)?.size || 1
                    : 0;
                  const isFpBanned = fp ? bannedSet.has(fp) : false;

                  return (
                    <tr
                      key={u.uid}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-neutral-900 dark:text-white">
                            {u.displayName}
                          </span>
                          {u.role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded bg-brand-red text-white text-[10px] font-extrabold uppercase">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500">{u.email}</p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {u.emailVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Vérifié
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <XCircle className="w-3.5 h-3.5" /> Non vérifié
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={u.subscriptionStatus} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap tabular-nums font-semibold text-neutral-700 dark:text-neutral-200">
                        {u.subscriptionStatus === 'premium_active' &&
                        u.premiumExpiresAt === 0
                          ? 'Illimitée'
                          : u.premiumExpiresAt > 0
                          ? new Date(u.premiumExpiresAt).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
                            {fp ? `${fp.slice(0, 16)}...` : '—'}
                          </span>
                          {sharedCount > 1 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-brand-red text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              Multi ({sharedCount})
                            </span>
                          )}
                          {isFpBanned && (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-bold">
                              Banni
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          {[
                            { label: '+30j', days: 30 },
                            { label: '+90j', days: 90 },
                            { label: '+365j', days: 365 },
                            { label: 'Illimité', days: null },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleActivateUser(u.uid, opt.days, opt.label)
                              }
                              className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-50 whitespace-nowrap"
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleSetStatus(u.uid, 'free', 'Gratuit')
                            }
                            className="px-2 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-200 text-[11px] font-bold disabled:opacity-50 whitespace-nowrap"
                          >
                            Gratuit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleSetStatus(u.uid, 'suspended', 'Suspendu')
                            }
                            className="px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-brand-red text-[11px] font-bold disabled:opacity-50 whitespace-nowrap"
                          >
                            Suspendre
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Tableau des Appareils & Empreintes matérielles (encapsulé dans overflow-x-auto) */}
      {tab === 'devices' && (
        <div className="w-full overflow-x-auto rounded-2xl bg-white dark:bg-brand-cardDark border border-neutral-200 dark:border-brand-borderDark">
          <table className="w-full min-w-[920px] text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-brand-borderDark bg-neutral-50/80 dark:bg-neutral-900/50 text-[11px] font-extrabold uppercase tracking-wider text-neutral-500">
                <th className="py-3.5 px-4">Empreinte Appareil (Fingerprint)</th>
                <th className="py-3.5 px-3">Compte lié</th>
                <th className="py-3.5 px-3">OS / Navigateur</th>
                <th className="py-3.5 px-3">Résolution</th>
                <th className="py-3.5 px-3">Dernière IP</th>
                <th className="py-3.5 px-4 text-right">Sécurité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-neutral-500">
                    Aucun appareil enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((dev) => {
                  const busy = busyKey === `d_${dev.deviceFingerprint}`;
                  const isBanned = bannedSet.has(dev.deviceFingerprint);
                  const sharedCount =
                    accountsByFingerprint.get(dev.deviceFingerprint)?.size || 1;
                  const ownerEmail = userEmailByUid.get(dev.userId) || dev.userId;

                  return (
                    <tr
                      key={dev.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="font-mono text-[11px] font-extrabold text-neutral-900 dark:text-white">
                            {dev.deviceFingerprint.slice(0, 22)}...
                          </span>
                          {sharedCount > 1 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-brand-red text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              {sharedCount} comptes
                            </span>
                          )}
                          {isBanned && (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-bold">
                              BANNI
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-200 max-w-[200px] truncate">
                        {ownerEmail}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-neutral-600 dark:text-neutral-300">
                        {dev.os} · {dev.browser}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums text-neutral-500">
                        {dev.screenResolution}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
                        {dev.lastIp}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleToggleBan(dev.deviceFingerprint)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50 ${
                            isBanned
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-brand-red border border-red-200 dark:border-red-900/50'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{isBanned ? 'Débannir' : 'Bannir'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Diagnostic Google AdSense */}
      {tab === 'adsense' && <AdSenseDiagnosticPanel onNotify={onNotify} />}
    </main>
  );
}
