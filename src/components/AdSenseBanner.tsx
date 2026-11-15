import { useEffect, useRef } from 'react';
import { Crown, Megaphone } from 'lucide-react';
import {
  type AdSensePlacement,
  ensureAdSenseScriptLoaded,
  getAdSenseClientId,
  getAdSenseSlotId,
} from '../utils/adsense';

interface AdSenseBannerProps {
  placement: AdSensePlacement;
  isAdFree: boolean;
  onUpgradeClick?: () => void;
  className?: string;
}

export function AdSenseBanner({
  placement,
  isAdFree,
  onUpgradeClick,
  className = '',
}: AdSenseBannerProps) {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedSlotRef = useRef<string | null>(null);

  const clientId = getAdSenseClientId();
  const slotId = getAdSenseSlotId(placement);

  useEffect(() => {
    if (isAdFree || !clientId || !slotId) {
      pushedSlotRef.current = null;
      return;
    }

    let cancelled = false;
    void ensureAdSenseScriptLoaded(clientId).then(() => {
      if (cancelled || pushedSlotRef.current === slotId || !insRef.current) {
        return;
      }
      if (insRef.current.getAttribute('data-adsbygoogle-status')) {
        pushedSlotRef.current = slotId;
        return;
      }
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        pushedSlotRef.current = slotId;
      } catch {
        // Ignore blocked or duplicate AdSense push errors cleanly
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAdFree, clientId, slotId]);

  if (isAdFree || !slotId) {
    return null;
  }

  return (
    <aside
      aria-label="Publicité Google AdSense"
      data-adsense-placement={placement}
      className={`w-full rounded-2xl border border-neutral-200/90 dark:border-brand-borderDark bg-white/95 dark:bg-brand-cardDark/95 p-3 sm:p-4 shadow-xs ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          <Megaphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Publicité · Google AdSense (version gratuite)</span>
        </span>
        {onUpgradeClick && (
          <button
            type="button"
            onClick={onUpgradeClick}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-brand-red transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Supprimer la pub · Passer Premium</span>
          </button>
        )}
      </div>

      <div className="w-full min-h-[90px] flex items-center justify-center overflow-hidden rounded-xl bg-neutral-50/90 dark:bg-neutral-900/50">
        <ins
          ref={insRef}
          className="adsbygoogle w-full"
          style={{ display: 'block' }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
